import Fastify from "fastify"
import routes from "./app/routes/index.js";

const fastify = Fastify({
    logger: true
})

fastify.register(routes);

const start = async () => {
    try {
        await fastify.listen({ port: process.env.PORT, host:'0.0.0.0'});
        console.log('Application started')
    } catch (error) {
       fastify.log.error(error);
       process.exit(1);
    }
}

start()