# Configurando o EventBridge Scheduler (passo a passo)

Fluxo: **seu servidor** cria schedules na AWS → no horário, **EventBridge Scheduler** chama a **Lambda** → a **Lambda** faz POST na sua API.

---

## 1. Pré-requisitos

- Conta AWS
- URL pública da sua API (ex: `https://api-itenorio.squareweb.app`) acessível pela internet
- AWS CLI instalado e configurado (`aws configure`) — opcional; dá para fazer tudo pelo Console

---

## 2. Criar a Lambda (routine-trigger)

### 2.1 Role de execução da Lambda

A Lambda precisa de uma **role** para rodar (e, no nosso caso, só faz HTTP; não precisa de permissão extra).

**Console:**

1. IAM → Roles → Create role
2. Trusted entity: **AWS service** → **Lambda**
3. Next → (não precisa anexar política; pode usar `AWSLambdaBasicExecutionRole` para logs no CloudWatch)
4. Nome: ex. `routine-trigger-lambda-role` → Create role
5. Anote o **ARN** (ex: `arn:aws:iam::123456789012:role/routine-trigger-lambda-role`)

**CLI:**

```bash
# Criar role com trust policy para Lambda
aws iam create-role \
  --role-name routine-trigger-lambda-role \
  --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}'

# Anexar política básica (logs)
aws iam attach-role-policy \
  --role-name routine-trigger-lambda-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
```

### 2.2 Fazer o zip e criar a função

No seu projeto:

```bash
cd lambdas/routine-trigger
zip -r ../routine-trigger.zip index.js package.json
```

**Console:**

1. Lambda → Create function
2. Nome: `routine-trigger`
3. Runtime: **Node.js 18.x**
4. Execution role: **Use an existing role** → `routine-trigger-lambda-role`
5. Create function
6. Em **Code** → **Upload from** → **.zip file** → escolha `lambdas/routine-trigger.zip`
7. **Configuration** → **General configuration** → **Edit** → Handler: `index.handler` (já deve estar)
8. **Configuration** → **Environment variables** → **Edit** → Add:
   - Key: `ROUTINE_TRIGGER_URL`
   - Value: `https://sua-api.com` (URL base da sua API, sem barra no final)
9. Save
10. Anote o **ARN da função** (ex: `arn:aws:lambda:us-east-1:123456789012:function:routine-trigger`)

**CLI:**

```bash
# Troque REGION, ACCOUNT_ID e a URL da sua API
aws lambda create-function \
  --function-name routine-trigger \
  --runtime nodejs18.x \
  --handler index.handler \
  --zip-file fileb://lambdas/routine-trigger.zip \
  --role arn:aws:iam::ACCOUNT_ID:role/routine-trigger-lambda-role \
  --environment "Variables={ROUTINE_TRIGGER_URL=https://sua-api.com}" \
  --region us-east-1
```

---

## 3. Role para o EventBridge Scheduler invocar a Lambda

O Scheduler não usa a sua conta “direto”; ele assume uma **role**. Essa role precisa de permissão para **invocar a Lambda**.

**Console:**

1. IAM → Roles → Create role
2. Trusted entity: **AWS service** → **EventBridge Scheduler** (ou “Scheduler”)
3. Next → Attach policy: **Create policy** (abre nova aba)
   - JSON:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "lambda:InvokeFunction",
      "Resource": "arn:aws:lambda:REGION:ACCOUNT_ID:function:routine-trigger"
    }
  ]
}
```

   - Troque `REGION` e `ACCOUNT_ID` pelo da sua conta (e pelo nome da função, se mudou)
   - Nome da policy: ex. `EventBridgeSchedulerInvokeRoutineTrigger`
   - Create policy
4. Volte na criação da role → Refresh na lista de policies → selecione `EventBridgeSchedulerInvokeRoutineTrigger`
5. Next → Nome: ex. `eventbridge-scheduler-routine-role` → Create role
6. Anote o **ARN** (ex: `arn:aws:iam::123456789012:role/eventbridge-scheduler-routine-role`)

**CLI:**

```bash
# Troque REGION e ACCOUNT_ID
export ACCOUNT_ID=123456789012
export REGION=us-east-1

# Policy que permite invocar a Lambda
aws iam create-policy \
  --policy-name EventBridgeSchedulerInvokeRoutineTrigger \
  --policy-document "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Action\":\"lambda:InvokeFunction\",\"Resource\":\"arn:aws:lambda:${REGION}:${ACCOUNT_ID}:function:routinesNexusTrigger\"}]}"

# Role que o Scheduler vai usar
aws iam create-role \
  --role-name eventbridge-scheduler-routine-role \
  --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"scheduler.amazonaws.com"},"Action":"sts:AssumeRole"}]}'

# Anexar a policy na role (substitua ACCOUNT_ID)
aws iam attach-role-policy \
  --role-name eventbridge-scheduler-routine-role \
  --policy-arn arn:aws:iam::355781466175:policy/EventBridgeSchedulerInvokeRoutineTrigger
```

---

## 4. (Opcional) Schedule group

Por padrão o código usa o group **default**. Se quiser um group próprio (ex: `life-sync`):

**Console:** EventBridge → Scheduler → Schedule groups → Create → Nome: `life-sync`

**CLI:**

```bash
aws scheduler create-schedule-group --name life-sync --region us-east-1
```

Se criar um group, use no servidor a env `EVENTBRIDGE_SCHEDULE_GROUP=life-sync`.

---

## 4.5 Credenciais do servidor para criar schedules

Quando o servidor roda **fora da AWS** (local, Square Cloud, etc.), ele precisa de **Access Key + Secret** de um usuário IAM com permissão para criar/remover schedules e fazer **PassRole** da role do Scheduler. Sem isso aparece: *"The security token included in the request is invalid"* (credenciais ausentes/inválidas) ou *Access Denied* (credenciais ok, falta permissão).

**Passos:**

1. **IAM** → **Users** → Create user (ex: `nexus-eventbridge-app`) → **Next**.
2. **Attach policies directly** → **Create policy** (aba nova) → **JSON** e cole (troque `ACCOUNT_ID` e o ARN da role se for outro):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "scheduler:CreateSchedule",
        "scheduler:DeleteSchedule",
        "scheduler:GetSchedule"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": "iam:PassRole",
      "Resource": "arn:aws:iam::ACCOUNT_ID:role/eventbridge-scheduler-routine-role",
      "Condition": {
        "StringEquals": { "iam:PassedToService": "scheduler.amazonaws.com" }
      }
    }
  ]
}
```

3. Nome da policy: ex. `EventBridgeSchedulerManageSchedules` → **Create policy**.
4. Volte no usuário → **Add permissions** → anexe `EventBridgeSchedulerManageSchedules`.
5. **Security credentials** → **Create access key** → **Application running outside AWS** → anote **Access key ID** e **Secret access key** (o secret só aparece uma vez).
6. No `.env` do servidor defina:
   - `AWS_ACCESS_KEY_ID=<access key id>`
   - `AWS_SECRET_ACCESS_KEY=<secret access key>`

Se aparecer *invalid token* de novo: a chave pode ter sido desativada/rotacionada — crie uma nova access key no mesmo usuário e atualize o `.env`.

---

## 5. Variáveis de ambiente no seu servidor

No `.env` do projeto (ou onde o servidor lê as env):

```env
# Obrigatórias para o Scheduler criar schedules
AWS_REGION=us-east-1
EVENTBRIDGE_LAMBDA_ARN=arn:aws:lambda:us-east-1:355781466175:function:routinesNexusTrigger
EVENTBRIDGE_SCHEDULER_ROLE_ARN=arn:aws:iam::355781466175:role/eventbridge-scheduler-routine-role

# Opcional: se criou um schedule group
# EVENTBRIDGE_SCHEDULE_GROUP=life-sync

# Obrigatório quando o servidor roda fora da AWS (local, Square Cloud, etc.)
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
```

Substitua região, account ID, ARNs e as credenciais pelos seus (usuário IAM com a policy da seção 4.5).

---

## 6. Testar

1. **Subir o servidor** com as env configuradas.
2. No Discord, usar **/rotina_criar** (nome, horário, repetir, etc.).
3. No Mongo a rotina deve aparecer com `scheduleId` preenchido (ex: `routine_6742abc...`).
4. No AWS: **EventBridge** → **Scheduler** → **Schedules** → deve existir um schedule com esse nome.
5. Para testar o trigger sem esperar o horário:
   - Lambda → **routine-trigger** → Test → criar evento de teste com `{ "routineId": "ID_DE_UMA_ROTINA_NO_MONGO" }` → executar.
   - Ou: `curl -X POST https://sua-api/events/routine-trigger -H "Content-Type: application/json" -d '{"routineId":"ID_MONGO"}'`

Se algo falhar: CloudWatch → Log groups → `/aws/lambda/routine-trigger` para ver logs da Lambda; e logs do seu servidor no POST `/events/routine-trigger`.

---

## Resumo rápido

| Onde | O que |
|------|--------|
| **Lambda** | Função `routine-trigger`, Node 18, env `ROUTINE_TRIGGER_URL` = URL base da API |
| **Role da Lambda** | Permissão básica (ex: logs); anotar ARN |
| **Role do Scheduler** | Trust `scheduler.amazonaws.com` + policy `lambda:InvokeFunction` na sua Lambda; anotar ARN |
| **Servidor** | `AWS_REGION`, `EVENTBRIDGE_LAMBDA_ARN`, `EVENTBRIDGE_SCHEDULER_ROLE_ARN`; fora da AWS: `AWS_ACCESS_KEY_ID` e `AWS_SECRET_ACCESS_KEY` (usuário IAM com policy da seção 4.5) |

Depois disso, ao criar/deletar rotina pelo Discord, o servidor cria/remove o schedule na AWS e no horário a Lambda chama sua API.
