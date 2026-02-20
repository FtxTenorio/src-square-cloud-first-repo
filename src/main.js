import 'dotenv/config';
import Fastify from "fastify"
import routes from "./app/routes/index.js";
import client from './app/modules/discord/index.js'
import mongodb from './app/modules/mongodb/index.js';
import logger from './app/modules/discord/services/loggerService.js';


const fastify = Fastify({
    logger: false // Disable fastify default logger, using our custom one
})

fastify.register(routes);

const start = async () => {
    try {
        // Show banner
        logger.banner('Square Cloud Bot', '2.0.0');
        logger.system.start();
        
        // Connect to MongoDB first (required for chat history)
        logger.info('MONGO', '🍃 Conectando ao MongoDB...');
        await mongodb.connect();
        logger.db.connected('square-cloud');
        
        // Then start Discord bot
        logger.info('DISCORD', '🤖 Iniciando bot do Discord...');
        client.login(process.env.DISCORD_SECRET_KEY)
        
        // Start Fastify server
        await fastify.listen({ port: process.env.PORT, host:'0.0.0.0'});
        logger.http.request('LISTEN', `http://0.0.0.0:${process.env.PORT}`, 200, 0);
        
        logger.system.ready();
        logger.divider('SISTEMA ONLINE');
    } catch (error) {
       logger.fatal('SYSTEM', 'Erro fatal na inicialização', error.message);
       process.exit(1);
    }
}

start()