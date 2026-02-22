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

export default { renderRoutineDeletePage };
