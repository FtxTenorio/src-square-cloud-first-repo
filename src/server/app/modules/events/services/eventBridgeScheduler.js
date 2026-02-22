/**
 * events - EventBridge Scheduler integration
 * Cria/remove schedules que disparam no horário da rotina.
 * Target: Lambda (env EVENTBRIDGE_LAMBDA_ARN). A Lambda faz POST para ROUTINE_TRIGGER_URL.
 */

import { SchedulerClient, CreateScheduleCommand, DeleteScheduleCommand } from '@aws-sdk/client-scheduler';
import logger from '../../nexus/utils/logger.js';

let client = null;

function getClient() {
    if (!process.env.AWS_REGION) {
        throw new Error('AWS_REGION é obrigatório para EventBridge Scheduler');
    }
    if (!client) {
        client = new SchedulerClient({
            region: process.env.AWS_REGION,
            ...(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
                ? {
                    credentials: {
                        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
                    }
                }
                : {})
        });
    }
    return client;
}

/**
 * Converte cron de 5 campos (min hour dom month dow) para expressão AWS Scheduler (6 campos).
 * AWS day-of-week: 1=Dom, 2=Seg, ..., 7=Sab. Nosso: 0=Dom, 1=Seg, ..., 6=Sab → AWS = nosso+1 (0→1).
 */
export function cronToAwsScheduleExpression(cron5) {
    const parts = (cron5 || '').trim().split(/\s+/);
    if (parts.length < 5) throw new Error('Cron inválido (esperado 5 campos)');
    const [min, hr, dom, month, dow] = parts;
    const toAws = (n) => (n === 0 ? 1 : n + 1);
    let dowAws = '*';
    if (dow !== '*') {
        dowAws = dow.split(',').map(part => {
            const t = part.trim();
            if (t.includes('-')) {
                const [a, b] = t.split('-').map(x => toAws(parseInt(x.trim(), 10)));
                return `${a}-${b}`;
            }
            return String(toAws(parseInt(t, 10)));
        }).join(',');
    }
    const domSafe = dom === '*' ? '?' : dom;
    return `cron(${min} ${hr} ${domSafe} * ${dowAws} *)`;
}

/**
 * Cria um schedule no EventBridge Scheduler.
 * Nome: routine_{routineId} (sanitizado para permitir apenas [a-zA-Z0-9_-]).
 * @param {string} routineId - MongoDB ObjectId da rotina
 * @param {string} cron5 - Expressão cron 5 campos (min hour * * dow)
 * @param {string} timezone - IANA timezone (ex: Europe/London)
 * @returns {Promise<string>} Nome do schedule criado
 */
export async function createSchedule(routineId, cron5, timezone) {
    const lambdaArn = process.env.EVENTBRIDGE_LAMBDA_ARN;
    if (!lambdaArn) {
        logger.warn('EVENTS', 'EVENTBRIDGE_LAMBDA_ARN não definido; schedule não criado');
        return null;
    }
    const group = process.env.EVENTBRIDGE_SCHEDULE_GROUP || 'default';
    const name = `routine_${String(routineId).replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    const scheduleExpression = cronToAwsScheduleExpression(cron5);
    const scheduleExpressionTimezone = timezone || 'UTC';

    await getClient().send(new CreateScheduleCommand({
        Name: name,
        GroupName: group,
        ScheduleExpression: scheduleExpression,
        ScheduleExpressionTimezone: scheduleExpressionTimezone,
        FlexibleTimeWindow: { Mode: 'OFF' },
        Target: {
            Arn: lambdaArn,
            RoleArn: process.env.EVENTBRIDGE_SCHEDULER_ROLE_ARN,
            Input: JSON.stringify({ routineId: String(routineId) })
        }
    }));

    logger.info('EVENTS', `Schedule criado: ${name} (${scheduleExpression} ${scheduleExpressionTimezone})`);
    return name;
}

/**
 * Remove um schedule pelo nome.
 */
export async function deleteSchedule(scheduleName) {
    if (!scheduleName) return;
    const group = process.env.EVENTBRIDGE_SCHEDULE_GROUP || 'default';
    try {
        await getClient().send(new DeleteScheduleCommand({
            Name: scheduleName,
            GroupName: group
        }));
        logger.info('EVENTS', `Schedule removido: ${scheduleName}`);
    } catch (err) {
        if (err.name !== 'ResourceNotFoundException') {
            logger.error('EVENTS', `Erro ao remover schedule ${scheduleName}`, err.message);
            throw err;
        }
    }
}

export function isConfigured() {
    return Boolean(process.env.AWS_REGION && process.env.EVENTBRIDGE_LAMBDA_ARN && process.env.EVENTBRIDGE_SCHEDULER_ROLE_ARN);
}

export default {
    createSchedule,
    deleteSchedule,
    cronToAwsScheduleExpression,
    isConfigured
};
