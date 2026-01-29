import Fastify from "fastify"

const fastify = Fastify({
    logger: true
})

fastify.get('/', (req, res) => {
    res.send({ hello: 'worlds'})
})

const start = async () => {
    try {
        await fastify.listen({ port: process.env.PORT });
    } catch (error) {
       fastify.log.error(error);
       process.exit(1);
    }
}

start()