import Fastify from "fastify"

const fastify = Fastify({
    logger: true
})

fastify.get('/', (req, res) => {
    console.log('Hello world')
    res.send({ hello: 'worlds'})
})

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