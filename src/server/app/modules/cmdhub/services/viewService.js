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
    { value: 'varios_dias', label: 'Vários dias (ex: segunda, sexta)' },
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

const CONDITION_OPTIONS = [
    { value: 'always', label: 'Sempre' }
];

function buildItemRow(label = '', condition = 'always') {
    const opts = CONDITION_OPTIONS.map(o => `<option value="${escapeHtml(o.value)}"${o.value === condition ? ' selected' : ''}>${escapeHtml(o.label)}</option>`).join('');
    return `<div class="item-row" style="display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.5rem;">
        <input type="text" class="item-label" placeholder="Ex: Tarefa do checklist" value="${escapeHtml(label)}" maxlength="200" autocomplete="off" style="flex: 1; padding: 0.5rem; border: 1px solid #e2e8f0; border-radius: 4px;">
        <select class="item-condition" style="width: 100px; padding: 0.5rem; border: 1px solid #e2e8f0; border-radius: 4px;">${opts}</select>
        <button type="button" class="btn-remove" title="Remover" style="padding: 0.35rem 0.5rem; background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; border-radius: 4px; cursor: pointer;">−</button>
      </div>`;
}

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
    const diasValue = escapeHtml((formData.dias || '').trim());
    const timezone = routine.timezone || 'Europe/London';
    const items = Array.isArray(routine.items) ? routine.items : [];
    const hasInitialItems = items.length > 0;
    const oneTimeChecked = routine.oneTime ? ' checked' : '';

    const repetirOptions = REPETIR_OPTIONS.map(o => `<option value="${escapeHtml(o.value)}"${o.value === repetir ? ' selected' : ''}>${escapeHtml(o.label)}</option>`).join('');
    const timezoneOptions = TIMEZONE_OPTIONS.map(o => `<option value="${escapeHtml(o.value)}"${o.value === timezone ? ' selected' : ''}>${escapeHtml(o.label)}</option>`).join('');

    const initialRows = hasInitialItems
        ? items.map(i => buildItemRow(i.label || '', i.condition || 'always')).join('')
        : '';

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Editar rotina</title>
</head>
<body style="margin:0; background: #f8fafc; font-family: system-ui, -apple-system, sans-serif;">
  <div style="max-width: 480px; margin: 2rem auto; padding: 1.5rem; background: #fff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); text-align: left;">
    <h1 style="font-size: 1.25rem; margin: 0 0 1rem;">✏️ Editar rotina</h1>
    <form id="form-edit" method="post" action="${escapeHtml(actionUrl)}" autocomplete="off" style="display: flex; flex-direction: column; gap: 1rem;">
      <input type="hidden" name="userId" value="${escapeHtml(userId)}">
      <input type="hidden" name="itens" id="itens-value" value="">
      <label style="display: flex; flex-direction: column; gap: 0.25rem;">
        <span style="font-weight: 500;">Nome</span>
        <input type="text" name="name" value="${name}" required maxlength="100" autocomplete="off" style="padding: 0.5rem; border: 1px solid #e2e8f0; border-radius: 4px;">
      </label>
      <label style="display: flex; flex-direction: column; gap: 0.25rem;">
        <span style="font-weight: 500;">Horário</span>
        <input type="time" name="horario" value="${horario}" required autocomplete="off" style="padding: 0.5rem; border: 1px solid #e2e8f0; border-radius: 4px;">
      </label>
      <label style="display: flex; flex-direction: column; gap: 0.25rem;">
        <span style="font-weight: 500;">Repetir</span>
        <select name="repetir" id="repetir-select" autocomplete="off" style="padding: 0.5rem; border: 1px solid #e2e8f0; border-radius: 4px;">${repetirOptions}</select>
      </label>
      <div id="dias-wrap" style="display: ${repetir === 'varios_dias' ? 'block' : 'none'};">
        <label style="display: flex; flex-direction: column; gap: 0.25rem;">
          <span style="font-weight: 500;">Quais dias? (separados por vírgula)</span>
          <input type="text" name="dias" value="${diasValue}" placeholder="segunda, sexta ou segunda, terça, quinta, domingo" autocomplete="off" style="padding: 0.5rem; border: 1px solid #e2e8f0; border-radius: 4px;">
        </label>
      </div>
      <label style="display: flex; flex-direction: column; gap: 0.25rem;">
        <span style="font-weight: 500;">Fuso</span>
        <select name="timezone" autocomplete="off" style="padding: 0.5rem; border: 1px solid #e2e8f0; border-radius: 4px;">${timezoneOptions}</select>
      </label>
      <div class="itens-wrap" style="margin: 0;">
        <p style="font-weight: 500; margin: 0 0 0.5rem;">Quer adicionar itens à rotina?</p>
        <button type="button" id="btn-show-itens" style="padding: 0.5rem 0.75rem; background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; border-radius: 4px; cursor: pointer; font-size: 0.875rem;" ${hasInitialItems ? ' hidden' : ''}>+ Adicionar itens</button>
        <div id="itens-section" style="margin-top: 0.5rem; ${hasInitialItems ? '' : 'display: none;'}">
          <div id="itens-rows">${initialRows}</div>
          <button type="button" id="btn-add-row" style="padding: 0.35rem 0.6rem; margin-top: 0.25rem; background: #e0e7ff; color: #4338ca; border: 1px solid #c7d2fe; border-radius: 4px; cursor: pointer; font-size: 1rem;">+</button>
        </div>
      </div>
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
  <script>
(function() {
  var repetirSelect = document.getElementById('repetir-select');
  var diasWrap = document.getElementById('dias-wrap');
  if (repetirSelect && diasWrap) {
    repetirSelect.addEventListener('change', function() {
      diasWrap.style.display = this.value === 'varios_dias' ? 'block' : 'none';
    });
  }
  var form = document.getElementById('form-edit');
  var itensValue = document.getElementById('itens-value');
  var itensSection = document.getElementById('itens-section');
  var itensRows = document.getElementById('itens-rows');
  var btnShow = document.getElementById('btn-show-itens');
  var btnAdd = document.getElementById('btn-add-row');

  var rowTemplate = ${JSON.stringify(buildItemRow('', 'always'))};

  function syncItens() {
    var rows = itensRows.querySelectorAll('.item-row');
    var parts = [];
    for (var i = 0; i < rows.length; i++) {
      var label = (rows[i].querySelector('.item-label').value || '').trim();
      if (label) {
        var cond = (rows[i].querySelector('.item-condition').value || 'always').trim();
        parts.push(label + '|' + cond);
      }
    }
    itensValue.value = parts.join(', ');
  }

  function addRow(label, condition) {
    var div = document.createElement('div');
    div.className = 'item-row';
    div.style.cssText = 'display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.5rem;';
    div.innerHTML = '<input type="text" class="item-label" placeholder="Ex: Tarefa do checklist" value="' + (label || '').replace(/"/g, '&quot;') + '" maxlength="200" autocomplete="off" style="flex: 1; padding: 0.5rem; border: 1px solid #e2e8f0; border-radius: 4px;">' +
      '<select class="item-condition" style="width: 100px; padding: 0.5rem; border: 1px solid #e2e8f0; border-radius: 4px;"><option value="always"' + (condition === 'always' ? ' selected' : '') + '>Sempre</option></select>' +
      '<button type="button" class="btn-remove" title="Remover" style="padding: 0.35rem 0.5rem; background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; border-radius: 4px; cursor: pointer;">−</button>';
    itensRows.appendChild(div);
    div.querySelector('.btn-remove').onclick = function() { div.remove(); syncItens(); };
    div.querySelector('.item-label').oninput = syncItens;
    div.querySelector('.item-condition').onchange = syncItens;
    syncItens();
  }

  btnShow.onclick = function() {
    itensSection.style.display = 'block';
    btnShow.hidden = true;
    if (itensRows.querySelectorAll('.item-row').length === 0) addRow('', 'always');
  };

  btnAdd.onclick = function() { addRow('', 'always'); };

  itensRows.addEventListener('click', function(e) {
    if (e.target.classList.contains('btn-remove')) {
      e.target.closest('.item-row').remove();
      syncItens();
    }
  });
  itensRows.addEventListener('input', function(e) {
    if (e.target.classList.contains('item-label')) syncItens();
  });
  itensRows.addEventListener('change', function(e) {
    if (e.target.classList.contains('item-condition')) syncItens();
  });

  form.onsubmit = function() {
    syncItens();
    return true;
  };

  if (itensRows.querySelectorAll('.item-row').length > 0) syncItens();
})();
  </script>
</body>
</html>`;
}

/**
 * Página HTML de sucesso após editar rotina.
 * @param {string} routineName - Nome da rotina
 * @param {object} [options] - { timezoneSaved?: boolean }
 */
export function renderRoutineEditSuccess(routineName, options = {}) {
    const timezoneTip = options.timezoneSaved
        ? '<p style="margin: 0.75rem 0 0; font-size: 0.875rem; opacity: 0.9;">💡 Seu fuso foi salvo nas preferências. Na próxima vez não será preciso definir o timezone.</p>'
        : '';
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
    ${timezoneTip}
  </div>
</body>
</html>`;
}

export default { renderRoutineDeletePage, renderRoutineEditForm, renderRoutineEditSuccess };
