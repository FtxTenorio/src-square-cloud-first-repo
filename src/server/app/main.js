import 'dotenv/config';
import Fastify from "fastify";
import cors from "@fastify/cors";
import routes from "./routes/index.js";
import nexus from './modules/nexus/index.js'
import mongodb from './modules/mongodb/index.js';
import cmdhub from './modules/cmdhub/index.js';
import * as levelService from './modules/nexus/services/levelService.js';
import * as chatHistoryService from './modules/nexus/services/chatHistoryService.js';

const { logger } = nexus;

const fastify = Fastify({
    logger: false // Disable fastify default logger, using our custom one
});

const allowedOrigins = [
    "https://itenorio.squareweb.app",
    "https://api-itenorio.squareweb.app",
];

await fastify.register(cors, {
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
    allowedHeaders: ["Content-Type", "Authorization", "X-User-Id", "Accept", "Origin", "X-Requested-With"],
    credentials: true,
    preflightContinue: false,
});

// Garante CORS em todas as respostas (incluindo erros/timeouts do app)
fastify.addHook("onSend", (request, reply, payload, done) => {
    const origin = request.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
        reply.header("Access-Control-Allow-Origin", origin);
        reply.header("Access-Control-Allow-Credentials", "true");
    }
    done(null, payload);
});

fastify.register(routes);

const start = async () => {
    try {
        // Connect to MongoDB first (required for chat history)
        logger.info('MONGO', '🍃 Conectando ao MongoDB...');
        await mongodb.connect();
        logger.db.connected('square-cloud');
        
        // Initialize cmdhub with Discord token for REST API
        cmdhub.init(process.env.DISCORD_SECRET_KEY);
        
        // Initialize and start Nexus
        await nexus.init({
            levelService,
            chatHistoryService
        });
        
        await nexus.start(process.env.DISCORD_SECRET_KEY);
        
        // Porta: PORT (plataforma, ex. 80) ou SERVER_PORT (.env)
        const port = Number(process.env.PORT) || Number(process.env.SERVER_PORT) || 8081;
        await fastify.listen({ port, host: '0.0.0.0' });
        logger.http.request('LISTEN', `http://0.0.0.0:${port}`, 200, 0);
        
    } catch (error) {
       logger.fatal('SYSTEM', 'Erro fatal na inicialização', error.message);
       process.exit(1);
    }
}

start()