import 'dotenv/config';
import Fastify from "fastify"
import routes from "./app/routes/index.js";
import client from './app/modules/discord/index.js'
import mongodb from './app/modules/mongodb/index.js';


const fastify = Fastify({
    logger: true
})

fastify.register(routes);

const start = async () => {
    try {
        // Connect to MongoDB first (required for chat history)
        await mongodb.connect();
        
        // Then start Discord bot
        client.login(process.env.DISCORD_SECRET_KEY)
        
        // Start Fastify server
        await fastify.listen({ port: process.env.PORT, host:'0.0.0.0'});
        console.log('Application started')
    } catch (error) {
       fastify.log.error(error);
       process.exit(1);
    }
}

start()