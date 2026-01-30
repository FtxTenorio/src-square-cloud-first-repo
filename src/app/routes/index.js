function routes(fastify, options) {
    fastify.get('/', async (req, res) => {
        console.log('Hello world')
        return { hello: 'world' }
    })
    
    fastify.post('/', async (req, res) => {
        if(req.body?.name) {
            return {response: req.body.name}
        } else {
            return {error: 'No Valid Body Was Sent!'}
        }
    })
}

export default routes;