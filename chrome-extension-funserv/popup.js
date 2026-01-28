// Popup Script - Interface da extensão

document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    loadAuthorizations();
    loadConfig();
    initEventListeners();
});

// Inicializa as tabs
function initTabs() {
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove active de todas
            tabs.forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

            // Ativa a selecionada
            tab.classList.add('active');
            const tabId = tab.dataset.tab;
            document.getElementById(`tab-${tabId}`).classList.add('active');
        });
    });
}

// Carrega autorizações
function loadAuthorizations() {
    chrome.runtime.sendMessage({ type: 'GET_AUTHORIZATIONS' }, (response) => {
        if (response && response.success) {
            renderAuthorizations(response.authorizations);
            updateStatus(response.authorizations);
        }
    });
}

// Renderiza lista de autorizações
function renderAuthorizations(authorizations) {
    const container = document.getElementById('authorizations-list');

    if (!authorizations || authorizations.length === 0) {
        container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📋</div>
        <p>Nenhuma autorização capturada ainda</p>
        <button id="btn-force-capture-dynamic" class="btn btn-secondary btn-sm" style="margin-top: 10px;">Capturar Manualmente</button>
      </div>
    `;
        // Adiciona listener ao botão recém-criado
        setTimeout(() => {
            const btn = document.getElementById('btn-force-capture-dynamic');
            if (btn) btn.addEventListener('click', forceCapture);
        }, 0);
        return;
    }

    container.innerHTML = authorizations.map(auth => {
        // Determina o status visual
        let statusClass = 'pending';
        let statusText = '⏳ Pendente';

        if (auth.synced) {
            statusClass = 'synced';
            statusText = '✓ Sincronizado';
        } else if (auth.patientNotFound) {
            statusClass = 'not-found';
            statusText = '⚠️ Paciente não cadastrado';
        }

        return `
    <div class="auth-card ${auth.synced ? 'synced' : ''} ${auth.patientNotFound ? 'not-found' : ''}">
      <div class="auth-header">
        <span class="auth-status ${statusClass}">
          ${statusText}
        </span>
        <span class="auth-date">${formatDate(auth.createdAt)}</span>
      </div>
      ${auth.patientNotFound ? `
        <div class="auth-warning">
          ⚠️ Verificar se está cadastrado na plataforma Personart
        </div>
      ` : ''}
      <div class="auth-body">
        <div class="auth-field">
          <span class="label">Carteirinha:</span>
          <span class="value">${auth.beneficiario || '-'}</span>
        </div>
        <div class="auth-field">
          <span class="label">Nº Autorização:</span>
          <span class="value highlight">${auth.autorizacao || '-'}</span>
        </div>
        <div class="auth-field">
          <span class="label">Paciente:</span>
          <span class="value">${auth.nome || '-'}</span>
        </div>
      </div>
      <div class="auth-actions">
        <button class="btn btn-sm btn-secondary btn-copy" data-autorizacao="${auth.autorizacao}">
          📋 Copiar
        </button>
        ${!auth.synced ? `
          <button class="btn btn-sm btn-primary btn-sync" data-id="${auth.id}">
            ☁️ ${auth.patientNotFound ? 'Tentar Novamente' : 'Sincronizar'}
          </button>
        ` : ''}
        <button class="btn btn-sm btn-danger btn-delete" data-id="${auth.id}" title="Excluir autorização">
          🗑️
        </button>
      </div>
    </div>
  `}).join('');

    // Adiciona event listeners aos botões (CSP não permite onclick inline)
    container.querySelectorAll('.btn-copy').forEach(btn => {
        btn.addEventListener('click', () => {
            const autorizacao = btn.getAttribute('data-autorizacao');
            copyToClipboard(autorizacao);
        });
    });

    container.querySelectorAll('.btn-sync').forEach(btn => {
        btn.addEventListener('click', () => {
            const authId = btn.getAttribute('data-id');
            syncAuth(authId);
        });
    });

    container.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', () => {
            const authId = btn.getAttribute('data-id');
            deleteAuth(authId);
        });
    });
}

// Atualiza indicador de status
function updateStatus(authorizations) {
    const indicator = document.getElementById('status-indicator');
    const text = document.getElementById('status-text');

    const pending = authorizations.filter(a => !a.synced).length;

    if (pending > 0) {
        indicator.className = 'status-indicator warning';
        text.textContent = `${pending} pendente(s) de sincronização`;
    } else if (authorizations.length > 0) {
        indicator.className = 'status-indicator success';
        text.textContent = 'Tudo sincronizado!';
    } else {
        indicator.className = 'status-indicator';
        text.textContent = 'Aguardando autorizações...';
    }
}

// Carrega configurações
function loadConfig() {
    chrome.runtime.sendMessage({ type: 'GET_AUTHORIZATIONS' }, (response) => {
        if (response && response.supabaseConfig) {
            document.getElementById('supabase-url').value = response.supabaseConfig.url || '';
            document.getElementById('supabase-key').value = response.supabaseConfig.anonKey || '';
            document.getElementById('supabase-table').value = response.supabaseConfig.tableName || 'autorizacoes';
        }
    });
}

// Event listeners
function initEventListeners() {
    // Salvar configurações
    document.getElementById('btn-save-config').addEventListener('click', saveConfig);

    // Limpar tudo
    document.getElementById('btn-clear').addEventListener('click', clearAll);

    // Botão de config (atalho para tab)
    document.getElementById('btn-config').addEventListener('click', () => {
        document.querySelector('.tab[data-tab="settings"]').click();
    });

    // Botão de Captura Manual
    const btnForce = document.getElementById('btn-force-capture');
    if (btnForce) {
        btnForce.addEventListener('click', forceCapture);
    }
}

// Força a captura na aba atual
function forceCapture() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, { type: 'FORCE_CAPTURE' }, (response) => {
                if (chrome.runtime.lastError) {
                    showToast('Erro de comunicação. Recarregue a página.', 'error');
                    return;
                }

                if (response && response.success) {
                    showToast('Capturado com sucesso!', 'success');
                    // Pequeno delay para dar tempo de salvar no storage
                    setTimeout(loadAuthorizations, 500);
                } else {
                    showToast(response?.error || 'Dados não encontrados nesta página', 'error');
                    if (response?.debug) {
                        console.log('[Funserv Debug]', response.debug);
                    }
                }
            });
        }
    });
}

// Salva configurações do Supabase
function saveConfig() {
    const config = {
        url: document.getElementById('supabase-url').value.trim(),
        anonKey: document.getElementById('supabase-key').value.trim(),
        tableName: document.getElementById('supabase-table').value.trim() || 'autorizacoes'
    };

    chrome.runtime.sendMessage({ type: 'UPDATE_SUPABASE_CONFIG', config }, (response) => {
        if (response && response.success) {
            showToast('Configurações salvas!', 'success');
        } else {
            showToast('Erro ao salvar', 'error');
        }
    });
}

// Sincroniza uma autorização
function syncAuth(authId) {
    console.log('[Funserv Popup] Iniciando sincronização para authId:', authId);
    showToast('Sincronizando...', 'info');

    chrome.runtime.sendMessage({ type: 'SYNC_TO_SUPABASE', authId }, (response) => {
        // Verifica se houve erro de comunicação com o background
        if (chrome.runtime.lastError) {
            console.error('[Funserv Popup] Erro de comunicação:', chrome.runtime.lastError);
            showToast('Erro de comunicação. Recarregue a extensão.', 'error');
            return;
        }

        console.log('[Funserv Popup] Resposta recebida:', response);

        if (response && response.success) {
            showToast('Sincronizado com sucesso!', 'success');
            loadAuthorizations();
        } else if (response?.patientNotFound) {
            // Mensagem específica para paciente não cadastrado
            showToast('Paciente não encontrado. Verificar se está cadastrado na plataforma Personart.', 'error');
            loadAuthorizations();
        } else {
            showToast(response?.error || 'Erro ao sincronizar', 'error');
        }
    });
}

// Copia para área de transferência
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast('Copiado!', 'success');
    });
}

// Exclui uma autorização individual
function deleteAuth(authId) {
    console.log('[Funserv Popup] deleteAuth chamado com authId:', authId);

    const confirmDelete = confirm('Tem certeza que deseja excluir esta autorização?');
    console.log('[Funserv Popup] Confirmação:', confirmDelete);

    if (confirmDelete) {
        chrome.runtime.sendMessage({ type: 'DELETE_AUTHORIZATION', authId: authId }, (response) => {
            console.log('[Funserv Popup] Resposta de exclusão:', response);

            if (chrome.runtime.lastError) {
                console.error('[Funserv Popup] Erro:', chrome.runtime.lastError);
                showToast('Erro de comunicação', 'error');
                return;
            }

            if (response && response.success) {
                loadAuthorizations();
                showToast('Autorização excluída!', 'success');
            } else {
                showToast('Erro ao excluir', 'error');
            }
        });
    }
}

// Limpa todas as autorizações
function clearAll() {
    if (confirm('Tem certeza que deseja limpar todas as autorizações?')) {
        chrome.runtime.sendMessage({ type: 'CLEAR_AUTHORIZATIONS' }, (response) => {
            if (response && response.success) {
                loadAuthorizations();
                showToast('Limpo!', 'success');
            }
        });
    }
}

// Formata data
function formatDate(isoString) {
    const date = new Date(isoString);
    return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Mostra toast notification
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('show');
    }, 10);

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 2000);
}
