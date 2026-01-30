function routes(fastify, options) {
    fastify.get('/', async (req, res) => {
        console.log('Hello world')
        return { hello: 'world' }
    })
}

export default routes;