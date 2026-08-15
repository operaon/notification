# Operaon Notification & Delivery — Especificação técnica

## Objetivo e fronteira

O standalone Notification & Delivery é responsável pela inbox de notificações do usuário, preferências de comunicação, inscrições Web Push, estado de entrega, tentativas, retry, deduplicação e adapters de canal. Regras clínicas, agendamento, identidade, RBAC, billing, catálogo e a decisão de negócio que origina cada evento permanecem nos respectivos domínios.

Referências externas como `userId`, `tenantId`, `relatedEntityId` e `sourceEventId` são identificadores opacos. O banco do serviço não cria foreign keys para tabelas de Identity, Clinical, Agend ou outros standalones.

## Modelo de execução

A criação de uma notificação grava a mensagem e as intenções de entrega dentro do mesmo domínio. O dispatcher persistente em PostgreSQL adquire entregas pendentes por lease, executa o adapter de canal e atualiza os estados `queued`, `processing`, `sent`, `failed`, `skipped` ou `dead_letter`. O worker utiliza backoff configurável, limite de tentativas, lease para recuperar processos interrompidos e expiração de mensagens.

A escolha inicial evita uma dependência obrigatória de Redis, Bull ou broker externo. Essa decisão reduz o custo operacional da primeira extração e mantém uma rota de evolução para broker dedicado caso a escala justifique a mudança.

| Alternativa | Benefícios | Trade-offs |
|---|---|---|
| Dispatcher persistente em PostgreSQL | Durabilidade, auditoria e recuperação com a infraestrutura já existente | Throughput menor que um broker dedicado |
| Entrega síncrona no request | Setup simples | Aumenta latência e perde robustez em falhas de provider |
| Broker dedicado | Alto throughput e recursos avançados de fila | Acrescenta operação, credenciais e complexidade |

## Canais

O corte inicial cobre `in_app` e `web_push`, que já existiam na API central. O adapter `email` é configurável, porém desabilitado por padrão quando o SMTP não estiver disponível. SMS, WhatsApp e webhook permanecem fora do primeiro corte e podem ser adicionados sem alterar o modelo de entrega.

Durante a transição, o realtime continua terminando no gateway para preservar clientes atuais. O Notification standalone persiste o evento e o status por canal; a retirada do Socket.IO legado ocorrerá somente em uma etapa posterior de cutover.

## Contrato HTTP

As rotas de negócio exigem simultaneamente `X-Service-Key` e bearer JWT emitido pelo Identity. O token deve conter `tokenType=access`, issuer `operaon-identity` e audience exclusiva `operaon-notification`, além de `tenantId` quando o recurso for tenant-scoped. Se `X-Tenant-Id` for enviado, ele deve coincidir com o claim do token. Tokens de serviço não recebem privilégios implícitos: operações fora do contexto autenticado exigem a permissão dinâmica correspondente.

| Método | Rota | Finalidade |
|---|---|---|
| `GET` | `/health` | Liveness público |
| `GET` | `/ready` | Readiness com banco disponível |
| `GET` | `/api/notifications` | Inbox paginada |
| `GET` | `/api/notifications/unread` | Notificações não lidas |
| `GET` | `/api/notifications/count` | Contagem de não lidas |
| `PUT` | `/api/notifications/:id/read` | Marcar uma notificação como lida |
| `PUT` | `/api/notifications/all/read` | Marcar todas como lidas |
| `DELETE` | `/api/notifications/:id` | Remover uma notificação |
| `DELETE` | `/api/notifications/read` | Remover notificações lidas |
| `GET` | `/api/notifications/preferences` | Ler preferências |
| `PUT` | `/api/notifications/preferences` | Atualizar preferências |
| `GET` | `/api/push/vapid-public-key` | Publicar chave pública VAPID |
| `POST` | `/api/push/subscribe` | Registrar dispositivo Web Push |
| `POST` | `/api/push/unsubscribe` | Remover dispositivo Web Push |
| `POST` | `/api/notification-requests` | Solicitar entrega por evento |

A rota de solicitação para outro usuário exige a permissão dinâmica `notifications:send`. Essa autorização é fornecida pelo Identity/RBAC e não é substituída por papéis fixos no código.

## Schema e isolamento

O banco próprio contém `notifications`, `notification_deliveries`, `notification_delivery_attempts`, `push_subscriptions`, `user_notification_preferences` e `notification_audit_events`. Entregas são separadas do inbox para que uma falha de SMTP ou Web Push não remova nem esconda a notificação in-app.

Todas as tabelas têm timestamps. Recursos tenant-scoped possuem índices por `tenantId` e `userId`; entregas possuem `channel`, `status`, `provider`, `dedupeKey`, `nextAttemptAt`, `attemptCount`, `lockedUntil`, `expiresAt`, `lastErrorCode` e `lastErrorMessage`. A deduplicação é aplicada por tenant, usuário, evento e canal.

## Migração e rollback

A primeira etapa utiliza banco novo e namespace paralelo no gateway. O adapter é registrado como provider `notification` e encaminha chamadas por `/api/notification-standalone`, enquanto `/api/notifications` e `/api/push` legados permanecem ativos. O backfill em `scripts/backfill-legacy.js` é somente-aditivo, começa em `BACKFILL_DRY_RUN=true`, preserva IDs e registra a origem nos metadados.

O rollback consiste em retornar o consumidor para as rotas legadas, desabilitar o worker novo e manter as tabelas antigas intactas até reconciliação final. Models, rotas e migrations legados não devem ser removidos antes de uma janela de observação, ausência de divergências e aprovação explícita do cutover.
