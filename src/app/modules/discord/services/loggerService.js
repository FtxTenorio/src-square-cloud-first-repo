/**
 * Logger Service - Beautiful colored console logs
 * Provides structured, colorful, and readable logging
 */

// ANSI color codes
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    underscore: '\x1b[4m',
    blink: '\x1b[5m',
    reverse: '\x1b[7m',
    hidden: '\x1b[8m',

    // Foreground colors
    black: '\x1b[30m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    gray: '\x1b[90m',

    // Bright foreground colors
    brightRed: '\x1b[91m',
    brightGreen: '\x1b[92m',
    brightYellow: '\x1b[93m',
    brightBlue: '\x1b[94m',
    brightMagenta: '\x1b[95m',
    brightCyan: '\x1b[96m',
    brightWhite: '\x1b[97m',

    // Background colors
    bgBlack: '\x1b[40m',
    bgRed: '\x1b[41m',
    bgGreen: '\x1b[42m',
    bgYellow: '\x1b[43m',
    bgBlue: '\x1b[44m',
    bgMagenta: '\x1b[45m',
    bgCyan: '\x1b[46m',
    bgWhite: '\x1b[47m'
};

// Log level configurations
const LOG_LEVELS = {
    DEBUG: { color: colors.gray, icon: '🔍', label: 'DEBUG', priority: 0 },
    INFO: { color: colors.brightCyan, icon: '📘', label: 'INFO ', priority: 1 },
    SUCCESS: { color: colors.brightGreen, icon: '✅', label: 'OK   ', priority: 2 },
    WARN: { color: colors.brightYellow, icon: '⚠️ ', label: 'WARN ', priority: 3 },
    ERROR: { color: colors.brightRed, icon: '❌', label: 'ERROR', priority: 4 },
    FATAL: { color: colors.red + colors.bgWhite, icon: '💀', label: 'FATAL', priority: 5 }
};

// Module/category colors for visual distinction
const MODULE_COLORS = {
    DISCORD: colors.brightBlue,
    MONGO: colors.brightGreen,
    REDIS: colors.brightRed,
    AI: colors.brightMagenta,
    LEVEL: colors.brightYellow,
    MOD: colors.brightCyan,
    FUN: colors.magenta,
    HTTP: colors.cyan,
    SYSTEM: colors.white,
    DEFAULT: colors.gray
};

// Current log level (can be configured via env)
const currentLogLevel = process.env.LOG_LEVEL || 'DEBUG';

/**
 * Format timestamp for logs
 */
function getTimestamp() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const ms = String(now.getMilliseconds()).padStart(3, '0');
    return `${hours}:${minutes}:${seconds}.${ms}`;
}

/**
 * Format date for daily markers
 */
function getDateStamp() {
    const now = new Date();
    return now.toLocaleDateString('pt-BR', { 
        weekday: 'short', 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    });
}

/**
 * Create a boxed header for important logs
 */
function createBox(title, content = null) {
    const width = 50;
    const line = '═'.repeat(width);
    const emptyLine = '║' + ' '.repeat(width) + '║';
    
    let box = `\n${colors.brightCyan}╔${line}╗${colors.reset}\n`;
    box += `${colors.brightCyan}║${colors.reset}${colors.bright} ${title.padEnd(width - 1)}${colors.reset}${colors.brightCyan}║${colors.reset}\n`;
    
    if (content) {
        box += `${colors.brightCyan}╠${line}╣${colors.reset}\n`;
        const lines = content.split('\n');
        for (const l of lines) {
            box += `${colors.brightCyan}║${colors.reset} ${l.padEnd(width - 1)}${colors.brightCyan}║${colors.reset}\n`;
        }
    }
    
    box += `${colors.brightCyan}╚${line}╝${colors.reset}\n`;
    return box;
}

/**
 * Main log function
 */
function log(level, module, message, data = null) {
    const levelConfig = LOG_LEVELS[level] || LOG_LEVELS.INFO;
    const moduleColor = MODULE_COLORS[module?.toUpperCase()] || MODULE_COLORS.DEFAULT;
    
    // Check log level priority
    const currentPriority = LOG_LEVELS[currentLogLevel.toUpperCase()]?.priority || 0;
    if (levelConfig.priority < currentPriority) return;

    const timestamp = `${colors.gray}[${getTimestamp()}]${colors.reset}`;
    const levelStr = `${levelConfig.color}${colors.bright}${levelConfig.icon} ${levelConfig.label}${colors.reset}`;
    const moduleStr = module ? `${moduleColor}[${module.toUpperCase().padEnd(7)}]${colors.reset}` : '';
    
    let output = `${timestamp} ${levelStr} ${moduleStr} ${message}`;
    
    console.log(output);
    
    // Print additional data if provided
    if (data !== null && data !== undefined) {
        if (typeof data === 'object') {
            const dataStr = JSON.stringify(data, null, 2);
            const lines = dataStr.split('\n');
            for (const line of lines) {
                console.log(`${colors.gray}    │ ${line}${colors.reset}`);
            }
        } else {
            console.log(`${colors.gray}    └─ ${data}${colors.reset}`);
        }
    }
}

/**
 * Convenience methods for each log level
 */
const logger = {
    debug: (module, message, data) => log('DEBUG', module, message, data),
    info: (module, message, data) => log('INFO', module, message, data),
    success: (module, message, data) => log('SUCCESS', module, message, data),
    warn: (module, message, data) => log('WARN', module, message, data),
    error: (module, message, data) => log('ERROR', module, message, data),
    fatal: (module, message, data) => log('FATAL', module, message, data),

    /**
     * Log a startup banner
     */
    banner: (appName, version = '1.0.0') => {
        const banner = `
${colors.brightMagenta}${colors.bright}
    ███████╗ ██████╗ ██╗   ██╗ █████╗ ██████╗ ███████╗
    ██╔════╝██╔═══██╗██║   ██║██╔══██╗██╔══██╗██╔════╝
    ███████╗██║   ██║██║   ██║███████║██████╔╝█████╗  
    ╚════██║██║▄▄ ██║██║   ██║██╔══██║██╔══██╗██╔══╝  
    ███████║╚██████╔╝╚██████╔╝██║  ██║██║  ██║███████╗
    ╚══════╝ ╚══▀▀═╝  ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝
${colors.reset}
${colors.cyan}    ⚡ ${appName} v${version}${colors.reset}
${colors.gray}    📅 ${getDateStamp()}${colors.reset}
${colors.gray}    ${'─'.repeat(52)}${colors.reset}
`;
        console.log(banner);
    },

    /**
     * Log a section divider
     */
    divider: (title = '') => {
        const line = '─'.repeat(50);
        if (title) {
            const padding = Math.floor((50 - title.length - 2) / 2);
            const paddedTitle = '─'.repeat(padding) + ` ${title} ` + '─'.repeat(50 - padding - title.length - 2);
            console.log(`\n${colors.cyan}${paddedTitle}${colors.reset}\n`);
        } else {
            console.log(`\n${colors.gray}${line}${colors.reset}\n`);
        }
    },

    /**
     * Log a boxed message (for important notices)
     */
    box: (title, content = null) => {
        console.log(createBox(title, content));
    },

    /**
     * Log Discord-specific events
     */
    discord: {
        ready: (botName, guildCount) => {
            logger.box(`🤖 BOT ONLINE`, `Nome: ${botName}\nServidores: ${guildCount}\nStatus: Operacional`);
        },
        command: (commandName, userName, guildName) => {
            logger.info('DISCORD', `/${colors.brightYellow}${commandName}${colors.reset} executado por ${colors.brightCyan}${userName}${colors.reset} em ${colors.gray}${guildName}${colors.reset}`);
        },
        message: (userName, channelName, preview) => {
            const shortPreview = preview.length > 30 ? preview.substring(0, 30) + '...' : preview;
            logger.debug('DISCORD', `💬 ${colors.brightCyan}${userName}${colors.reset} em #${channelName}: "${shortPreview}"`);
        },
        join: (userName, guildName) => {
            logger.info('DISCORD', `👋 ${colors.brightGreen}${userName}${colors.reset} entrou em ${guildName}`);
        },
        leave: (userName, guildName) => {
            logger.info('DISCORD', `👋 ${colors.brightRed}${userName}${colors.reset} saiu de ${guildName}`);
        },
        error: (error) => {
            logger.error('DISCORD', `Erro: ${error.message || error}`);
        }
    },

    /**
     * Log database events
     */
    db: {
        connected: (dbName) => {
            logger.success('MONGO', `🍃 Conectado ao banco: ${colors.brightGreen}${dbName}${colors.reset}`);
        },
        disconnected: () => {
            logger.warn('MONGO', '🍃 Desconectado do banco de dados');
        },
        error: (error) => {
            logger.error('MONGO', `Erro de conexão: ${error.message || error}`);
        },
        query: (collection, operation, time) => {
            logger.debug('MONGO', `📊 ${operation} em ${colors.yellow}${collection}${colors.reset} (${time}ms)`);
        }
    },

    /**
     * Log Redis events  
     */
    redis: {
        connected: () => {
            logger.success('REDIS', `🔴 Conectado ao Redis`);
        },
        error: (error) => {
            logger.error('REDIS', `Erro: ${error.message || error}`);
        }
    },

    /**
     * Log AI events
     */
    ai: {
        request: (userId, model) => {
            logger.debug('AI', `🤖 Requisição de ${colors.cyan}${userId}${colors.reset} usando ${model}`);
        },
        response: (tokens, time) => {
            logger.debug('AI', `✨ Resposta gerada (${tokens} tokens, ${time}ms)`);
        },
        error: (error) => {
            logger.error('AI', `Erro na IA: ${error.message || error}`);
        }
    },

    /**
     * Log level/XP events
     */
    level: {
        xpGain: (userName, xp, total) => {
            logger.debug('LEVEL', `⭐ ${colors.brightYellow}${userName}${colors.reset} +${xp}XP (Total: ${total})`);
        },
        levelUp: (userName, newLevel) => {
            logger.info('LEVEL', `🎉 ${colors.brightYellow}${userName}${colors.reset} subiu para nível ${colors.brightGreen}${newLevel}${colors.reset}!`);
        },
        badge: (userName, badge) => {
            logger.info('LEVEL', `🏅 ${colors.brightYellow}${userName}${colors.reset} desbloqueou: ${badge}`);
        }
    },

    /**
     * Log moderation events
     */
    mod: {
        action: (action, moderator, target, reason) => {
            logger.warn('MOD', `🔨 ${colors.brightRed}${action.toUpperCase()}${colors.reset}: ${target} por ${moderator} - "${reason || 'Sem motivo'}"`);
        },
        warn: (moderator, target) => {
            logger.info('MOD', `⚠️ ${target} advertido por ${moderator}`);
        }
    },

    /**
     * Log HTTP/API events
     */
    http: {
        request: (method, path, status, time) => {
            const statusColor = status >= 500 ? colors.brightRed : 
                               status >= 400 ? colors.brightYellow : 
                               status >= 300 ? colors.cyan : colors.brightGreen;
            logger.info('HTTP', `${method} ${path} ${statusColor}${status}${colors.reset} (${time}ms)`);
        },
        error: (method, path, error) => {
            logger.error('HTTP', `${method} ${path} - ${error}`);
        }
    },

    /**
     * Log system events
     */
    system: {
        start: () => {
            logger.info('SYSTEM', '🚀 Iniciando aplicação...');
        },
        ready: () => {
            logger.success('SYSTEM', '✨ Aplicação pronta!');
        },
        shutdown: () => {
            logger.warn('SYSTEM', '🛑 Encerrando aplicação...');
        },
        env: (key, value) => {
            const masked = value ? '****' + value.slice(-4) : 'não definido';
            logger.debug('SYSTEM', `🔧 ${key}: ${colors.gray}${masked}${colors.reset}`);
        }
    },

    // Export colors for custom usage
    colors
};

export default logger;
export { logger, colors, LOG_LEVELS };
