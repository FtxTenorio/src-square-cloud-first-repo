# Mapeamento de logs na aplicação

## Como os logs são feitos atualmente

### Logger central

- **Arquivo:** `src/server/app/modules/nexus/utils/logger.js`
- **Uso:** Logger customizado com cores (ANSI), níveis e módulos nomeados.

### API do logger

| Método | Uso |
|--------|-----|
| `logger.debug(module, message, data?)` | Detalhes para desenvolvimento |
| `logger.info(module, message, data?)` | Fluxo normal (requests, ações) |
| `logger.success(module, message, data?)` | Sucesso (conexões, carregamento) |
| `logger.warn(module, message, data?)` | Avisos (não encontrado, rate limit) |
| `logger.error(module, message, data?)` | Erros (exceções, falhas) |
| `logger.fatal(module, message, data?)` | Erro fatal (inicialização) |

Helpers por domínio:

- **HTTP:** `logger.http.request(method, path, status, timeMs)`
- **DB:** `logger.db.connected(name)`, `logger.db.disconnected()`, `logger.db.error(err)`, `logger.db.query(collection, operation, time)`
- **Redis:** `logger.redis.connected()`, `logger.redis.error(err)`
- **AI:** `logger.ai.request(userId, provider)`, `logger.ai.response(chars, time)`, `logger.ai.error(err)`, `logger.ai.fallback()`
- **Nexus:** `logger.nexus.ready(botName, guildCount)`, `logger.nexus.moduleLoaded(name, count)`
- **Discord:** `logger.discord.command(name, userName, guildName)`, `logger.discord.message(...)`, `logger.discord.error(err)`
- **Sistema:** `logger.system.start()`, `logger.system.ready()`, `logger.system.shutdown()`

### Níveis e módulos

- **Nível atual:** definido por `process.env.LOG_LEVEL` (default: `DEBUG`). Valores: `DEBUG`, `INFO`, `SUCCESS`, `WARN`, `ERROR`, `FATAL`.
- **Módulos usados:** `CMDHUB`, `NEXUS`, `MONGO`, `HTTP`, `AI`, `LEVEL`, `MOD`, `DISCORD`, `SYSTEM`, `REDIS`, etc. (cores diferentes por módulo).

### Onde o logger já é usado

| Módulo | Arquivo | Exemplos |
|--------|---------|----------|
| CMDHub | `commandController.js` | info por rota, http.request, error em catch |
| CMDHub | `commandService.js` | info/debug/error em CRUD, sync, deploy, cache |
| CMDHub | `rateLimiter.js` | warn em rate limit, error em falhas |
| CMDHub | `routes/index.js` | info ao registrar rotas |
| Nexus | `ai/index.js` | debug/error para humor e IA |
| Nexus | `core/loader.js` | warn/error ao carregar comandos/eventos/serviços |
| Nexus | `chatHistoryService.js` | (parcial; tinha console.error) |
| Server | `main.js` | info/success/fatal na inicialização |
| DB | `mongodb/index.js` | debug/success/error na conexão |

### Onde havia `console.*` (substituído por logger)

- `src/server/app/routes/index.js` — cache Redis (GET /)
- `src/server/database/redis/index.js` — conexão/erro Redis
- `src/server/app/modules/nexus/services/moderationService.js` — falha ao salvar mod log
- `src/server/app/modules/nexus/services/utilityService.js` — erro ao encerrar poll
- `src/server/app/modules/nexus/services/chatHistoryService.js` — erro ao salvar histórico

### Lugares úteis com logs adicionais

- **customCommands.js:** execução de comandos sensíveis (personality, humor) e erros em `execute` (debug/error).
- **Rotas principais:** cache HIT/MISS e erros Redis já passam a usar logger com módulo `HTTP`/`REDIS`.

### Padrão recomendado

```js
import logger from '../../nexus/utils/logger.js';  // ajustar caminho

// Request/operação importante
logger.info('MODULE', `Descrição curta key=${value}`);

// Sucesso relevante
logger.success('MODULE', 'Operação concluída');

// Aviso (não é erro)
logger.warn('MODULE', 'Condição esperada', detail);

// Erro em catch
logger.error('MODULE', 'Contexto do erro', error.message);

// HTTP (controller)
logger.http.request('GET', '/path', 200, durationMs);
```

Evitar `console.log`/`console.error` em código de aplicação; usar sempre o logger para nível, módulo e formato unificado.
