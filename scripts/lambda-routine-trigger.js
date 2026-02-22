/**
 * Lambda proxy: EventBridge Scheduler → esta função → POST para sua API
 *
 * Configurar na Lambda:
 * - Variável de ambiente ROUTINE_TRIGGER_URL = URL base da API (ex: https://api-itenorio.squareweb.app)
 *
 * O Scheduler envia no Target.Input: { "routineId": "<mongo_id>" }
 * Esta função repassa em POST para ROUTINE_TRIGGER_URL/events/routine-trigger
 */

const https = require('https');
const http = require('http');

const TRIGGER_PATH = '/events/routine-trigger';

exports.handler = async (event) => {
    const url = process.env.ROUTINE_TRIGGER_URL;
    if (!url) {
        throw new Error('ROUTINE_TRIGGER_URL não definido');
    }
    const routineId = event.routineId || (event.detail && event.detail.routineId);
    if (!routineId) {
        throw new Error('routineId não encontrado no evento');
    }

    const base = url.replace(/\/$/, '');
    const targetUrl = `${base}${TRIGGER_PATH.startsWith('/') ? TRIGGER_PATH : '/' + TRIGGER_PATH}`;
    const parsed = new URL(targetUrl);
    const isHttps = parsed.protocol === 'https:';
    const body = JSON.stringify({ routineId: String(routineId) });

    const options = {
        hostname: parsed.hostname,
        port: parsed.port || (isHttps ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body)
        }
    };

    return new Promise((resolve, reject) => {
        const req = (isHttps ? https : http).request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve({ statusCode: res.statusCode, body: data });
                } else {
                    reject(new Error(`API retornou ${res.statusCode}: ${data}`));
                }
            });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
};
