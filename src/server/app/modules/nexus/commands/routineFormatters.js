/**
 * Formatação padronizada de rotinas (listar e detalhe).
 * Usado por rotina_listar e pelas tools de DM da IA.
 */

const TIMEZONE_CHOICES = [
    { name: '🇧🇷 São Paulo', value: 'America/Sao_Paulo' },
    { name: '🇬🇧 Londres', value: 'Europe/London' },
    { name: '🇺🇸 Nova York', value: 'America/New_York' },
    { name: '🇫🇷 Paris', value: 'Europe/Paris' },
    { name: '🇩🇪 Berlim', value: 'Europe/Berlin' },
    { name: 'UTC', value: 'UTC' }
];

/** Cron (min hr * * dow) → { horario: "08:00", repetir: "Segunda a Sexta" } */
function cronToHuman(cron) {
    if (!cron || typeof cron !== 'string') return { horario: '—', repetir: '—' };
    const parts = cron.trim().split(/\s+/);
    if (parts.length < 5) return { horario: cron, repetir: '—' };
    const [min, hr] = parts;
    const dow = parts[4];
    const hour = parseInt(hr, 10);
    const minute = parseInt(min, 10);
    const horario = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    const dowLabels = {
        '*': 'Todo dia',
        '1-5': 'Segunda a Sexta',
        '0,6': 'Fim de semana (Sáb e Dom)',
        '0': 'Domingo', '1': 'Segunda', '2': 'Terça', '3': 'Quarta',
        '4': 'Quinta', '5': 'Sexta', '6': 'Sábado'
    };
    const repetir = dow.includes(',')
        ? dow.split(',').map(n => dowLabels[n.trim()] || n).filter(Boolean).join(', ')
        : (dowLabels[dow] ?? dow);
    return { horario, repetir };
}

/** IANA timezone → nome curto para exibição */
function timezoneToLabel(tz) {
    if (!tz) return '—';
    const found = TIMEZONE_CHOICES.find(c => c.value === tz);
    return found ? found.name : tz.split('/').pop()?.replace(/_/g, ' ') ?? tz;
}

/**
 * Bloco de uma rotina na lista (mesmo estilo do /rotina_listar).
 * @param {object} routine - Documento da rotina
 * @param {string} userId - ID do usuário que está vendo
 * @param {object} [opts] - { baseUrl?, index?, isDesativada? }
 */
function formatRoutineBlock(routine, userId, opts = {}) {
    const baseUrl = opts.baseUrl ?? (process.env.PUBLIC_API_URL || '').replace(/\/$/, '');
    const index = opts.index ?? 1;
    const isDesativada = opts.isDesativada ?? (routine.enabled === false);
    const editPath = (id) => `/routines/${id}/edit?userId=${userId}`;
    const deletePath = (id) => `/routines/${id}/delete?userId=${userId}`;

    const { horario, repetir } = cronToHuman(routine.cron);
    const repetirLabel = routine.oneTime ? 'Uma vez só' : repetir;
    const fuso = timezoneToLabel(routine.timezone);
    const itens = (routine.items || []).length;
    const itensStr = itens === 0 ? 'Nenhum item' : itens === 1 ? '1 item' : `${itens} itens`;
    const isOwner = routine.userId === userId;
    const isParticipant = Array.isArray(routine.participantIds) && routine.participantIds.includes(userId);
    const roleLine = isOwner
        ? '├ 👤 Dono: você'
        : (isParticipant ? '├ 👥 Você foi incluído nesta rotina por outro usuário' : null);
    let actionsLine = null;
    if (baseUrl) {
        if (isOwner) {
            actionsLine = `└ ✏️ [Editar](${baseUrl}${editPath(routine._id)})  ·  🗑️ [Apagar](${baseUrl}${deletePath(routine._id)})`;
        } else if (isParticipant) {
            const leavePath = `/routines/${routine._id}/leave?userId=${userId}`;
            actionsLine = `└ 🚪 [Sair desta rotina](${baseUrl}${leavePath})`;
        }
    } else {
        if (isOwner) {
            actionsLine = `└ ✏️ \`${editPath(routine._id)}\`  ·  🗑️ \`${deletePath(routine._id)}\``;
        } else if (isParticipant) {
            const leavePath = `/routines/${routine._id}/leave?userId=${userId}`;
            actionsLine = `└ 🚪 \`${leavePath}\``;
        }
    }
    const title = isDesativada ? `**~~${index}. ${routine.name}~~**` : `**${index}. ${routine.name}**`;
    return [
        title,
        `├ 🕐 ${horario}  ·  ${repetirLabel}`,
        `├ 🌍 ${fuso}  ·  ${itensStr}`,
        roleLine,
        routine.oneTime ? '└ ⏰ Uma vez só' : null,
        routine.enabled ? '└ ✅ Ativa' : '└ ❌ Desativada',
        routine.scheduleId ? '└ ⏰ Agendada' : null,
        actionsLine
    ].filter(Boolean).join('\n');
}

/**
 * Detalhe de uma rotina (mesmo estilo da tela "Ver detalhes" do /rotina_listar).
 * @param {object} routine - Documento da rotina
 * @param {string} userId - ID do usuário que está vendo
 * @returns {string} Texto formatado (descrição + itens)
 */
function formatRoutineDetail(routine, userId) {
    const { horario, repetir } = cronToHuman(routine.cron);
    const repetirLabel = routine.oneTime ? 'Uma vez só' : repetir;
    const fuso = timezoneToLabel(routine.timezone);
    const itens = (routine.items || []).length;
    const itensList = (routine.items || []).map((item, i) => `${i + 1}. ${item.label} \`(${item.condition || 'always'})\``).join('\n') || '_Nenhum item._';
    const isOwner = routine.userId === userId;
    const isParticipant = Array.isArray(routine.participantIds) && routine.participantIds.includes(userId);

    const lines = [];
    lines.push(`🕐 **Horário:** ${horario} (${repetirLabel})`);
    lines.push(`🌍 **Fuso:** ${fuso}`);
    lines.push(`⚙️ **Uma vez só:** ${routine.oneTime ? 'Sim' : 'Não'}`);
    lines.push(`✅ **Status:** ${routine.enabled ? 'Ativa' : 'Desativada'}`);
    if (routine.scheduleId) lines.push('⏰ **Agendada:** Sim');
    if (isOwner) lines.push('👤 **Dono:** você');
    else if (isParticipant) lines.push('👥 **Você foi incluído por outro usuário**');

    return lines.join('\n') + `\n\n**Itens (${itens})**\n${itensList}`;
}

const EMBED_COLOR = 0x5865F2;

/**
 * Dados para embed de lista (mesmo estilo do /rotina_listar). Para DM/IA.
 * @param {object[]} routines - Lista de rotinas
 * @param {string} userId - ID do usuário
 * @param {{ baseUrl?: string }} [opts] - baseUrl para links Editar/Apagar (ex: PUBLIC_API_URL)
 * @returns {{ title: string, description: string, footer: string, color: number }}
 */
function buildListEmbedData(routines, userId, opts = {}) {
    const baseUrl = opts.baseUrl ?? (process.env.PUBLIC_API_URL || '').replace(/\/$/, '');
    const blocks = routines.map((r, i) =>
        formatRoutineBlock(r, userId, { baseUrl, index: i + 1, isDesativada: r.enabled === false })
    );
    const active = routines.filter(r => r.enabled !== false).length;
    const desativadas = routines.length - active;
    return {
        title: '📋 Suas rotinas',
        description: blocks.join('\n\n') || 'Nenhuma rotina.',
        footer: `${routines.length} rotina(s) · ${active} ativa(s), ${desativadas} desativada(s)`,
        color: EMBED_COLOR
    };
}

/**
 * Dados para embed de detalhe (mesmo estilo "Ver detalhes" do /rotina_listar). Para DM/IA.
 * @param {object} routine - Documento da rotina
 * @param {string} userId - ID do usuário
 * @param {{ baseUrl?: string }} [opts] - baseUrl para links Editar/Apagar
 * @returns {{ title: string, description: string, fields: { name: string, value: string }[], color: number }}
 */
function buildDetailEmbedData(routine, userId, opts = {}) {
    const baseUrl = opts.baseUrl ?? (process.env.PUBLIC_API_URL || '').replace(/\/$/, '');
    const { horario, repetir } = cronToHuman(routine.cron);
    const repetirLabel = routine.oneTime ? 'Uma vez só' : repetir;
    const fuso = timezoneToLabel(routine.timezone);
    const itens = (routine.items || []).length;
    const itensList = (routine.items || []).map((item, i) => `${i + 1}. ${item.label} \`(${item.condition || 'always'})\``).join('\n') || '_Nenhum item._';
    const isOwner = routine.userId === userId;
    const isParticipant = Array.isArray(routine.participantIds) && routine.participantIds.includes(userId);

    const lines = [];
    lines.push(`🕐 **Horário:** ${horario} (${repetirLabel})`);
    lines.push(`🌍 **Fuso:** ${fuso}`);
    lines.push(`⚙️ **Uma vez só:** ${routine.oneTime ? 'Sim' : 'Não'}`);
    lines.push(`✅ **Status:** ${routine.enabled ? 'Ativa' : 'Desativada'}`);
    if (routine.scheduleId) lines.push('⏰ **Agendada:** Sim');
    if (isOwner) lines.push('👤 **Dono:** você');
    else if (isParticipant) lines.push('👥 **Você foi incluído por outro usuário**');
    if (baseUrl && isOwner) {
        const editPath = `/routines/${routine._id}/edit?userId=${userId}`;
        const deletePath = `/routines/${routine._id}/delete?userId=${userId}`;
        lines.push(`✏️ [Editar](${baseUrl}${editPath})  ·  🗑️ [Apagar](${baseUrl}${deletePath})`);
    }

    return {
        title: `🔍 ${routine.name}`,
        description: lines.join('\n'),
        fields: [{ name: `Itens (${itens})`, value: itensList }],
        color: EMBED_COLOR
    };
}

export {
    TIMEZONE_CHOICES,
    cronToHuman,
    timezoneToLabel,
    formatRoutineBlock,
    formatRoutineDetail,
    buildListEmbedData,
    buildDetailEmbedData
};
