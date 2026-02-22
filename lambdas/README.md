# Lambdas (Life-Sync Engine)

## routine-trigger

Lambda invocada pelo **EventBridge Scheduler** no horário da rotina. Ela faz POST para a sua API (`/events/routine-trigger`).

### Variáveis de ambiente (na Lambda)

| Nome | Obrigatório | Descrição |
|------|-------------|-----------|
| `ROUTINE_TRIGGER_URL` | Sim | URL base da API (ex: `https://api-itenorio.squareweb.app`) |

### Deploy (AWS CLI)

```bash
cd lambdas/routine-trigger
zip -r ../routine-trigger.zip index.js package.json
aws lambda create-function \
  --function-name routine-trigger \
  --runtime nodejs18.x \
  --handler index.handler \
  --zip-file fileb://../routine-trigger.zip \
  --role arn:aws:iam::ACCOUNT_ID:role/LAMBDA_EXECUTION_ROLE \
  --environment "Variables={ROUTINE_TRIGGER_URL=https://sua-api.com}"
```

Para atualizar:

```bash
zip -r ../routine-trigger.zip index.js package.json
aws lambda update-function-code --function-name routine-trigger --zip-file fileb://../routine-trigger.zip
```

### Payload do EventBridge Scheduler

O servidor envia no `Target.Input`: `{ "routineId": "<mongo_id>" }`. A Lambda repassa esse body no POST para `ROUTINE_TRIGGER_URL/events/routine-trigger`.
