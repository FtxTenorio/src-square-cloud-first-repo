import 'dotenv/config';
import Fastify from "fastify"
import routes from "./app/routes/index.js";
import nexus from './app/modules/nexus/index.js'
import mongodb from './app/modules/mongodb/index.js';
import * as levelService from './app/modules/nexus/services/levelService.js';
import * as chatHistoryService from './app/modules/nexus/services/chatHistoryService.js';

const { logger } = nexus;

const fastify = Fastify({
    logger: false // Disable fastify default logger, using our custom one
})

fastify.register(routes);

const start = async () => {
    try {
        // Connect to MongoDB first (required for chat history)
        logger.info('MONGO', '🍃 Conectando ao MongoDB...');
        await mongodb.connect();
        logger.db.connected('square-cloud');
        
        // Initialize and start Nexus
        await nexus.init({
            levelService,
            chatHistoryService
        });
        
        await nexus.start(process.env.DISCORD_SECRET_KEY);
        
        // Start Fastify server
        await fastify.listen({ port: process.env.PORT, host:'0.0.0.0'});
        logger.http.request('LISTEN', `http://0.0.0.0:${process.env.PORT}`, 200, 0);
        
    } catch (error) {
       logger.fatal('SYSTEM', 'Erro fatal na inicialização', error.message);
       process.exit(1);
    }
}

start()