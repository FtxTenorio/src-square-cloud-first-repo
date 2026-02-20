import { fork } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const URL = 'https://api-itenorio.squareweb.app/';

// Opções de quantidade de requests (com delay ajustado para evitar rate limit)
// delay em ms entre cada request por worker
const OPTIONS = {
    1: { requests: 100, workers: 10, delayMs: 100 },      // ~10 req/s por worker
    2: { requests: 1000, workers: 20, delayMs: 50 },      // ~20 req/s por worker  
    3: { requests: 10000, workers: 50, delayMs: 20 },     // ~50 req/s por worker
    4: { requests: 100000, workers: 100, delayMs: 10 },   // ~100 req/s por worker
    5: { requests: 1000000, workers: 200, delayMs: 5 }    // stress test
};

// Verifica se foi passado argumento direto
const arg = process.argv[2];
if (arg && OPTIONS[arg]) {
    const opt = OPTIONS[arg];
    runBenchmark(opt.requests, opt.workers, opt.delayMs);
} else {
    showMenu();
}

function showMenu() {
    console.log('\n========== BENCHMARK SELECTOR ==========');
    console.log('1) 100 requests      (10 workers, 100ms delay)');
    console.log('2) 1,000 requests    (20 workers, 50ms delay)');
    console.log('3) 10,000 requests   (50 workers, 20ms delay)');
    console.log('4) 100,000 requests  (100 workers, 10ms delay)');
    console.log('5) 1,000,000 requests (200 workers, 5ms delay)');
    console.log('=========================================\n');

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    rl.question('Escolha uma opção (1-5): ', (answer) => {
        rl.close();
        const option = OPTIONS[answer];
        if (option) {
            runBenchmark(option.requests, option.workers, option.delayMs);
        } else {
            console.log('Opção inválida!');
            process.exit(1);
        }
    });
}

function runBenchmark(totalRequests, workerCount, delayMs = 50) {
    console.log(`\n🚀 Iniciando benchmark: ${totalRequests.toLocaleString()} requests com ${workerCount} workers (${delayMs}ms delay)...\n`);
    
    const results = {
        hit: 0,
        miss: 0,
        error: 0,
        rateLimit: 0,
        retries: 0,
        times: []
    };

    let completed = 0;
    const startTime = Date.now();
    const requestsPerWorker = Math.ceil(totalRequests / workerCount);

    // Cria workers
    for (let i = 0; i < workerCount; i++) {
        const worker = fork(path.join(__dirname, 'worker.js'));
        
        // Último worker pode ter menos requests para fechar o total exato
        const count = Math.min(requestsPerWorker, totalRequests - (i * requestsPerWorker));
        if (count <= 0) continue;
        
        worker.send({ url: URL, count, workerId: i, silent: totalRequests > 1000, delayMs, maxRetries: 3 });
        
        worker.on('message', (msg) => {
            if (msg.type === 'result') {
                results.hit += msg.hit;
                results.miss += msg.miss;
                results.error += msg.error;
                results.rateLimit += msg.rateLimit || 0;
                results.retries += msg.retries || 0;
                results.times.push(...msg.times);
                completed++;
                
                // Progress update
                if (totalRequests >= 10000) {
                    const progress = ((completed / workerCount) * 100).toFixed(0);
                    process.stdout.write(`\rProgress: ${progress}% (${completed}/${workerCount} workers done)`);
                }
                
                if (completed === workerCount) {
                    printResults(totalRequests, workerCount, results, startTime, delayMs);
                }
            }
        });
    }
}

function printResults(totalRequests, workerCount, results, startTime, delayMs) {
    const totalTime = Date.now() - startTime;
    const avgTime = results.times.length > 0 
        ? results.times.reduce((a, b) => a + b, 0) / results.times.length 
        : 0;
    const minTime = results.times.length > 0 ? Math.min(...results.times) : 0;
    const maxTime = results.times.length > 0 ? Math.max(...results.times) : 0;
    const successRate = ((results.hit / totalRequests) * 100).toFixed(1);
    
    console.log('\n\n========== BENCHMARK RESULTS ==========');
    console.log(`Total Requests: ${totalRequests.toLocaleString()}`);
    console.log(`Workers: ${workerCount} | Delay: ${delayMs}ms`);
    console.log(`Total Time: ${(totalTime / 1000).toFixed(2)}s`);
    console.log(`Requests/sec: ${(totalRequests / (totalTime / 1000)).toFixed(2)}`);
    console.log('');
    console.log(`✅ Success (2xx): ${results.hit.toLocaleString()} (${successRate}%)`);
    console.log(`🔄 Cache MISS: ${results.miss.toLocaleString()}`);
    console.log(`⚠️  Rate Limited (429): ${results.rateLimit.toLocaleString()}`);
    console.log(`🔁 Retries: ${results.retries.toLocaleString()}`);
    console.log(`❌ Errors: ${results.error.toLocaleString()}`);
    console.log('');
    console.log(`Avg Response Time: ${avgTime.toFixed(2)}ms`);
    console.log(`Min Response Time: ${minTime}ms`);
    console.log(`Max Response Time: ${maxTime}ms`);
    console.log('========================================\n');
    
    process.exit(0);
}
