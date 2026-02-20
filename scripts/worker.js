// Worker process - executa as requisições
const results = {
    hit: 0,
    miss: 0,
    error: 0,
    rateLimit: 0,
    retries: 0,
    times: []
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

process.on('message', async (msg) => {
    const { url, count, workerId, silent = false, delayMs = 50, maxRetries = 3 } = msg;
    
    for (let i = 0; i < count; i++) {
        let retryCount = 0;
        let backoffMs = delayMs;
        
        while (retryCount <= maxRetries) {
            const start = Date.now();
            try {
                const response = await fetch(url);
                const time = Date.now() - start;
                
                // Rate limited - backoff exponencial e retry
                if (response.status === 429) {
                    results.rateLimit++;
                    retryCount++;
                    
                    if (retryCount <= maxRetries) {
                        // Pega o retry-after header se disponível
                        const retryAfter = response.headers.get('retry-after');
                        const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : backoffMs * Math.pow(2, retryCount);
                        
                        if (!silent) {
                            console.log(`Worker ${workerId} | Request ${i + 1}/${count} | 429 - Aguardando ${waitTime}ms (retry ${retryCount}/${maxRetries})`);
                        }
                        
                        await sleep(waitTime);
                        results.retries++;
                        continue;
                    } else {
                        if (!silent) {
                            console.log(`Worker ${workerId} | Request ${i + 1}/${count} | RATE LIMITED - Max retries atingido`);
                        }
                        results.times.push(time);
                        break;
                    }
                }
                
                results.times.push(time);
                
                // Tenta pegar o header X-Cache (case insensitive)
                const cacheHeader = response.headers.get('x-cache') || response.headers.get('X-Cache');
                
                if (cacheHeader?.toUpperCase() === 'HIT') {
                    results.hit++;
                } else if (cacheHeader?.toUpperCase() === 'MISS') {
                    results.miss++;
                } else if (response.ok) {
                    results.hit++;
                }
                
                if (!silent) {
                    console.log(`Worker ${workerId} | Request ${i + 1}/${count} | ${time}ms | X-Cache: ${cacheHeader || 'N/A'} | Status: ${response.status}`);
                }
                
                break; // Sucesso, sai do loop de retry
                
            } catch (error) {
                results.error++;
                results.times.push(Date.now() - start);
                if (!silent) {
                    console.log(`Worker ${workerId} | Request ${i + 1}/${count} | ERROR: ${error.message}`);
                }
                break;
            }
        }
        
        // Delay entre requests para não triggar rate limit
        if (i < count - 1) {
            await sleep(delayMs);
        }
    }
    
    process.send({ type: 'result', ...results });
});
