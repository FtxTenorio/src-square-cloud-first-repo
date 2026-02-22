/**
 * Lambda: EventBridge Scheduler -> POST para sua API
 * Env: ROUTINE_TRIGGER_URL = URL base da API
 * Input do Scheduler: { "routineId": "<mongo_id>" }
 */

import https from 'https';
import http from 'http';

const TRIGGER_PATH = '/events/routine-trigger';

export const handler = async (event) => {
    const url = process.env.ROUTINE_TRIGGER_URL;
    if (!url) throw new Error('ROUTINE_TRIGGER_URL nao definido');
    const routineId = event.routineId || (event.detail && event.detail.routineId);
    if (!routineId) throw new Error('routineId nao encontrado no evento');

    const base = url.replace(/\/$/, '');
    const targetUrl = base + (TRIGGER_PATH.startsWith('/') ? TRIGGER_PATH : '/' + TRIGGER_PATH);
    const parsed = new URL(targetUrl);
    const isHttps = parsed.protocol === 'https:';
    const body = JSON.stringify({ routineId: String(routineId) });

    const options = {
        hostname: parsed.hostname,
        port: parsed.port || (isHttps ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    };

    return new Promise((resolve, reject) => {
        const req = (isHttps ? https : http).request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) resolve({ statusCode: res.statusCode, body: data });
                else reject(new Error('API ' + res.statusCode + ': ' + data));
            });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
};
