/**
 * cmdhub - View Service
 * Gera HTML simples para respostas de rotinas (ex.: página de confirmação de exclusão).
 * CSS inline para não depender de arquivos externos.
 */

const BASE_STYLES = [
    'font-family: system-ui, -apple-system, sans-serif',
    'max-width: 420px',
    'margin: 2rem auto',
    'padding: 1.5rem',
    'text-align: center',
    'border-radius: 8px',
    'box-shadow: 0 2px 8px rgba(0,0,0,0.08)'
].join('; ');

const SUCCESS_STYLES = [
    BASE_STYLES,
    'background: #f0fdf4',
    'border: 1px solid #86efac',
    'color: #166534'
].join('; ');

const ERROR_STYLES = [
    BASE_STYLES,
    'background: #fef2f2',
    'border: 1px solid #fca5a5',
    'color: #991b1b'
].join('; ');

/**
 * Gera HTML da página de resultado ao apagar uma rotina (sucesso ou erro).
 * @param {object} options
 * @param {boolean} options.success - true = sucesso, false = erro
 * @param {string} options.message - Mensagem principal (ex.: "Rotina X apagada." ou mensagem de erro)
 * @param {string} [options.routineName] - Nome da rotina (apenas em caso de sucesso)
 * @returns {string} HTML completo com CSS inline
 */
export function renderRoutineDeletePage({ success, message, routineName }) {
    const title = success ? 'Rotina apagada' : 'Erro';
    const emoji = success ? '✅' : '❌';
    const cardStyle = success ? SUCCESS_STYLES : ERROR_STYLES;
    const displayMessage = message || (success ? 'Rotina removida com sucesso.' : 'Ocorreu um erro.');

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
</head>
<body style="margin:0; background: #f8fafc;">
  <div style="${cardStyle}">
    <p style="font-size: 2rem; margin: 0 0 0.5rem;">${emoji}</p>
    <h1 style="font-size: 1.25rem; font-weight: 600; margin: 0 0 0.5rem;">${title}</h1>
    <p style="margin: 0; opacity: 0.9;">${escapeHtml(displayMessage)}</p>
    ${routineName ? `<p style="margin: 0.75rem 0 0; font-size: 0.875rem; opacity: 0.8;">"${escapeHtml(routineName)}"</p>` : ''}
  </div>
</body>
</html>`;
}

function escapeHtml(text) {
    if (typeof text !== 'string') return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

const REPETIR_OPTIONS = [
    { value: 'uma_vez', label: 'Uma vez só (não repetir)' },
    { value: 'todo_dia', label: 'Todo dia' },
    { value: 'seg_a_sex', label: 'Segunda a Sexta' },
    { value: 'fim_de_semana', label: 'Fim de semana (Sáb e Dom)' },
    { value: 'segunda', label: 'Segunda' }, { value: 'terca', label: 'Terça' }, { value: 'quarta', label: 'Quarta' },
    { value: 'quinta', label: 'Quinta' }, { value: 'sexta', label: 'Sexta' }, { value: 'sabado', label: 'Sábado' }, { value: 'domingo', label: 'Domingo' }
];
const TIMEZONE_OPTIONS = [
    { value: 'America/Sao_Paulo', label: 'São Paulo' },
    { value: 'Europe/London', label: 'Londres' },
    { value: 'America/New_York', label: 'Nova York' },
    { value: 'Europe/Paris', label: 'Paris' },
    { value: 'Europe/Berlin', label: 'Berlim' },
    { value: 'UTC', label: 'UTC' }
];

/**
 * Gera HTML do formulário de edição de rotina.
 * @param {object} routine - { _id, name, cron, timezone, items, oneTime }
 * @param {object} formData - { horario, repetir } (extraídos do cron para o form)
 * @param {string} actionUrl - URL para submit (ex.: /routines/:id)
 * @param {string} userId - Discord user ID
 */
export function renderRoutineEditForm(routine, formData, actionUrl, userId) {
    const name = escapeHtml(routine.name || '');
    const horario = escapeHtml(formData.horario || '08:00');
    const repetir = formData.repetir || 'todo_dia';
    const timezone = routine.timezone || 'Europe/London';
    const itensStr = Array.isArray(routine.items) && routine.items.length
        ? routine.items.map(i => `${escapeHtml(i.label)}|${escapeHtml(i.condition || 'always')}`).join(', ')
        : '';
    const oneTimeChecked = routine.oneTime ? ' checked' : '';

    const repetirOptions = REPETIR_OPTIONS.map(o => `<option value="${escapeHtml(o.value)}"${o.value === repetir ? ' selected' : ''}>${escapeHtml(o.label)}</option>`).join('');
    const timezoneOptions = TIMEZONE_OPTIONS.map(o => `<option value="${escapeHtml(o.value)}"${o.value === timezone ? ' selected' : ''}>${escapeHtml(o.label)}</option>`).join('');

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Editar rotina</title>
</head>
<body style="margin:0; background: #f8fafc; font-family: system-ui, -apple-system, sans-serif;">
  <div style="max-width: 420px; margin: 2rem auto; padding: 1.5rem; background: #fff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
    <h1 style="font-size: 1.25rem; margin: 0 0 1rem;">✏️ Editar rotina</h1>
    <form method="post" action="${escapeHtml(actionUrl)}" style="display: flex; flex-direction: column; gap: 1rem;">
      <input type="hidden" name="userId" value="${escapeHtml(userId)}">
      <label style="display: flex; flex-direction: column; gap: 0.25rem;">
        <span style="font-weight: 500;">Nome</span>
        <input type="text" name="name" value="${name}" required maxlength="100" style="padding: 0.5rem; border: 1px solid #e2e8f0; border-radius: 4px;">
      </label>
      <label style="display: flex; flex-direction: column; gap: 0.25rem;">
        <span style="font-weight: 500;">Horário (ex: 08:00)</span>
        <input type="text" name="horario" value="${horario}" required pattern="[0-9]{1,2}:[0-9]{2}" placeholder="08:00" style="padding: 0.5rem; border: 1px solid #e2e8f0; border-radius: 4px;">
      </label>
      <label style="display: flex; flex-direction: column; gap: 0.25rem;">
        <span style="font-weight: 500;">Repetir</span>
        <select name="repetir" style="padding: 0.5rem; border: 1px solid #e2e8f0; border-radius: 4px;">${repetirOptions}</select>
      </label>
      <label style="display: flex; flex-direction: column; gap: 0.25rem;">
        <span style="font-weight: 500;">Fuso</span>
        <select name="timezone" style="padding: 0.5rem; border: 1px solid #e2e8f0; border-radius: 4px;">${timezoneOptions}</select>
      </label>
      <label style="display: flex; flex-direction: column; gap: 0.25rem;">
        <span style="font-weight: 500;">Itens (um por linha ou separados por vírgula; use "Label|condição")</span>
        <textarea name="itens" rows="4" style="padding: 0.5rem; border: 1px solid #e2e8f0; border-radius: 4px;">${itensStr}</textarea>
      </label>
      <label style="display: flex; align-items: center; gap: 0.5rem;">
        <input type="checkbox" name="oneTime" value="1"${oneTimeChecked}>
        <span>Uma vez só (não repetir)</span>
      </label>
      <div style="display: flex; gap: 0.5rem;">
        <button type="submit" style="padding: 0.5rem 1rem; background: #5865F2; color: #fff; border: none; border-radius: 4px; cursor: pointer;">Salvar</button>
        <a href="${escapeHtml(actionUrl)}" style="padding: 0.5rem 1rem; color: #64748b;">Cancelar</a>
      </div>
    </form>
  </div>
</body>
</html>`;
}

/**
 * Página HTML de sucesso após editar rotina.
 */
export function renderRoutineEditSuccess(routineName) {
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Rotina atualizada</title>
</head>
<body style="margin:0; background: #f8fafc;">
  <div style="${SUCCESS_STYLES}">
    <p style="font-size: 2rem; margin: 0 0 0.5rem;">✅</p>
    <h1 style="font-size: 1.25rem; font-weight: 600; margin: 0 0 0.5rem;">Rotina atualizada</h1>
    <p style="margin: 0; opacity: 0.9;">"${escapeHtml(routineName)}" foi salva.</p>
  </div>
</body>
</html>`;
}

export default { renderRoutineDeletePage, renderRoutineEditForm, renderRoutineEditSuccess };
