# EventBridge Scheduler (Life-Sync Engine)

O Scheduler dispara no horário da rotina e chama uma **Lambda**; a Lambda faz POST para a sua API.

Fluxo: `EventBridge Scheduler -> Lambda -> POST sua API (ROUTINE_TRIGGER_URL)`

## Env no servidor

- `AWS_REGION` – obrigatório se usar Scheduler (ex: us-east-1)
- `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` – opcional (default credential chain)
- `EVENTBRIDGE_LAMBDA_ARN` – ARN da Lambda proxy (obrigatório para criar schedules)
- `EVENTBRIDGE_SCHEDULER_ROLE_ARN` – Role com permissão para invocar a Lambda
- `EVENTBRIDGE_SCHEDULE_GROUP` – opcional (default: default)

Se `EVENTBRIDGE_LAMBDA_ARN` não estiver definido, rotinas são salvas no Mongo mas nenhum schedule é criado.

## Endpoint

A Lambda deve fazer POST para: `{URL_BASE}/events/routine-trigger` com body `{ "routineId": "<mongo_id>" }`.

## Lambda (uma vez)

1. Criar função Node 18+ que recebe o evento e faz POST para ROUTINE_TRIGGER_URL.
2. Na Lambda: env `ROUTINE_TRIGGER_URL` = URL base da sua API.
3. Código: pasta `lambdas/routine-trigger/` (ver `lambdas/README.md`).
4. No servidor: `EVENTBRIDGE_LAMBDA_ARN` = ARN da função; `EVENTBRIDGE_SCHEDULER_ROLE_ARN` = role com lambda:InvokeFunction.

## Testar sem AWS

```bash
curl -X POST https://sua-api/events/routine-trigger -H "Content-Type: application/json" -d '{"routineId":"<id_mongo>"}'
```
