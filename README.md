# Notification & Delivery

> Serviço de Notification & Delivery da Operaon para entrega, templates e rastreamento de notificações.

| Item | Referência |
|---|---|
| Documentação | [docs/INDEX.md](docs/INDEX.md) |
| Segurança | [SECURITY.md](SECURITY.md) |
| Contribuição | [CONTRIBUTING.md](CONTRIBUTING.md) |
| Processo de release | [docs/release-process.md](docs/release-process.md) |

---

Standalone responsável por **inbox de notificações**, entregas por canal, preferências de usuário, Web Push, SMTP configurável e processamento assíncrono com retry e dead-letter. O serviço possui banco PostgreSQL próprio e não depende do banco da API gateway em runtime.

## Execução local

Copie `.env.example` para `.env` e informe as configurações do ambiente. As chaves `SERVICE_API_KEY`, `JWT_SECRET`, `VAPID_PRIVATE_KEY` e `SMTP_PASSWORD` devem ser fornecidas pelo ambiente de execução; não use placeholders em produção.

```bash
npm install
npm run migrate
npm test
npm start
```

O serviço atende por padrão em `http://localhost:4720`, com `GET /health` público e `GET /ready` verificando a conexão com o banco. O worker é habilitado por `NOTIFICATION_WORKER_ENABLED=true` e utiliza lease, retry exponencial, limite de tentativas e dead-letter para evitar duplicação e perda silenciosa.

## Contrato e segurança

As rotas de negócio exigem simultaneamente o header `X-Service-Key` e um access token JWT emitido pelo Identity. O token deve conter `tokenType=access`, issuer `operaon-identity`, audience compatível com `operaon-api` e `operaon-notification`, além de `tenantId` quando a operação estiver dentro de um tenant.

A autorização para criar notificações para outro usuário é dinâmica: o produtor precisa apresentar a permissão `notifications:send`, fornecida pelo Identity/RBAC. O serviço não fixa papéis de negócio no código. Consultas, mutações, preferências e push sempre são limitados pelo usuário autenticado e pelo contexto de tenant.

| Namespace | Finalidade | Compatibilidade |
|---|---|---|
| `/api/notifications` | Inbox, leitura, deduplicação, leitura e preferências | Mantém o contrato principal legado |
| `/api/notification-requests` | Solicitação protegida de notificações para produtores autorizados | Novo contrato interno |
| `/api/push` | Inscrição, remoção e publicação da chave pública VAPID | Compatível com Web Push |
| `/health` e `/ready` | Liveness e readiness operacional | Público |

## Migração controlada

O script `scripts/backfill-legacy.js` é **somente-aditivo** e possui `BACKFILL_DRY_RUN=true` por padrão. Ele lê as tabelas legadas `notifications`, `push_subscriptions` e `user_notification_preferences`, preserva os IDs, registra a origem nos metadados e não apaga nem altera a API central.

Para executar primeiro uma simulação, forneça a conexão do banco legado fora do repositório:

```bash
export LEGACY_DATABASE_URL='postgres://usuario:senha@host:5432/velyon_api'
BACKFILL_DRY_RUN=true npm run backfill:legacy
```

Depois de revisar os totais, a escrita pode ser habilitada explicitamente:

```bash
BACKFILL_DRY_RUN=false npm run backfill:legacy
```

O backfill cria a entrega `in_app` como `sent` para notificações já existentes e importa as inscrições de push no novo formato. A API gateway mantém `/api/notifications` e `/api/push` durante o cutover; o novo adapter fica em `/api/notification-standalone`.

## Canais e operação

O canal `in_app` é persistido no banco. O canal `web_push` usa VAPID e remove inscrições expiradas. O canal `email` utiliza SMTP e permanece desabilitado por padrão até que o ambiente forneça as credenciais e o feature flag correspondente. Falhas de provider são registradas em `notification_delivery_attempts`, com status, erro sanitizado, duração e número de tentativa.

Nenhum segredo real deve ser versionado. Os valores locais podem ser carregados por um arquivo `.env` não rastreado ou por secret manager do ambiente de execução.

<!-- OPERAON-DOCUMENTATION-LINK -->
## Documentação

A documentação técnica padronizada está em [docs/INDEX.md](docs/INDEX.md). Ela inclui arquitetura, responsabilidades, segurança, contratos, operação, testes, runbooks e decisões.
