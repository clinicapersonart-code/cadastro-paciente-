// Background Service Worker - Gerencia armazenamento e comunicação
// Armazena autorizações aprovadas e sincroniza com Supabase

// Configuração do Supabase (será preenchida via popup)
let SUPABASE_CONFIG = {
    url: '',
    anonKey: '',
    tableName: 'patients' // Tabela de pacientes
};

// Inicializa storage - PRESERVA dados existentes
chrome.runtime.onInstalled.addListener(async () => {
    console.log('[Funserv Integrador] Extensão instalada/atualizada');

    // Verifica se já existem dados antes de sobrescrever
    const existing = await chrome.storage.local.get(['authorizations', 'supabaseConfig']);

    const updates = {};

    // Só inicializa se não existir
    if (!existing.authorizations) {
        updates.authorizations = [];
        console.log('[Funserv Integrador] Inicializando authorizations (vazio)');
    } else {
        console.log('[Funserv Integrador] Mantendo', existing.authorizations.length, 'autorizações existentes');
    }

    if (!existing.supabaseConfig || !existing.supabaseConfig.url) {
        updates.supabaseConfig = SUPABASE_CONFIG;
        console.log('[Funserv Integrador] Inicializando supabaseConfig (vazio)');
    } else {
        console.log('[Funserv Integrador] Mantendo config existente');
    }

    // Só atualiza se tiver algo para atualizar
    if (Object.keys(updates).length > 0) {
        await chrome.storage.local.set(updates);
    }
});

// Carrega config ao iniciar
chrome.storage.local.get(['supabaseConfig'], (result) => {
    if (result.supabaseConfig) {
        SUPABASE_CONFIG = result.supabaseConfig;
    }
});

// Recebe mensagens do content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'AUTHORIZATION_APPROVED') {
        handleNewAuthorization(message.data, sendResponse);
        return true;
    }

    if (message.type === 'GET_AUTHORIZATIONS') {
        getAuthorizations(sendResponse);
        return true;
    }

    if (message.type === 'SYNC_TO_SUPABASE') {
        syncToSupabase(message.authId, sendResponse);
        return true;
    }

    if (message.type === 'UPDATE_SUPABASE_CONFIG') {
        updateSupabaseConfig(message.config, sendResponse);
        return true;
    }

    if (message.type === 'CLEAR_AUTHORIZATIONS') {
        clearAuthorizations(sendResponse);
        return true;
    }

    if (message.type === 'DELETE_AUTHORIZATION') {
        deleteAuthorization(message.authId, sendResponse);
        return true;
    }
});

// Salva nova autorização
async function handleNewAuthorization(data, sendResponse) {
    try {
        const result = await chrome.storage.local.get(['authorizations', 'supabaseConfig']);
        let authorizations = result.authorizations || [];
        SUPABASE_CONFIG = result.supabaseConfig || SUPABASE_CONFIG;

        // Verifica se já existe (evita duplicatas)
        const exists = authorizations.some(
            a => a.autorizacao === data.autorizacao && a.beneficiario === data.beneficiario
        );

        if (!exists) {
            const newAuth = {
                id: Date.now().toString(),
                ...data,
                synced: false,
                createdAt: new Date().toISOString()
            };

            authorizations.unshift(newAuth);

            // Mantém apenas as últimas 100
            if (authorizations.length > 100) {
                authorizations = authorizations.slice(0, 100);
            }

            await chrome.storage.local.set({ authorizations });

            // Mostra notificação do sistema
            chrome.notifications.create({
                type: 'basic',
                iconUrl: 'icons/icon128.png',
                title: 'Autorização Capturada!',
                message: `Carteirinha: ${data.beneficiario || 'N/A'}\nAutorização: ${data.autorizacao}`,
                priority: 2
            });

            console.log('[Funserv Integrador] Nova autorização salva:', newAuth);

            // Tenta sincronizar automaticamente se tiver config
            if (SUPABASE_CONFIG.url && SUPABASE_CONFIG.anonKey && data.beneficiario) {
                autoSyncToSupabase(newAuth);
            }

            sendResponse({ success: true, auth: newAuth });
        } else {
            console.log('[Funserv Integrador] Autorização já existe, ignorando');
            sendResponse({ success: true, duplicate: true });
        }
    } catch (error) {
        console.error('[Funserv Integrador] Erro ao salvar:', error);
        sendResponse({ success: false, error: error.message });
    }
}

// Sincronização automática ao capturar
async function autoSyncToSupabase(auth) {
    try {
        console.log('[Funserv Integrador] Tentando sincronização automática...');

        // Busca paciente pela carteirinha no campo data->>carteirinha
        const patient = await findPatientByCarteirinha(auth.beneficiario, auth.nome);

        if (patient) {
            await updatePatientFunserv(patient, auth);

            // Marca como sincronizado
            const result = await chrome.storage.local.get(['authorizations']);
            const authorizations = result.authorizations.map(a =>
                a.id === auth.id ? { ...a, synced: true, syncedAt: new Date().toISOString() } : a
            );
            await chrome.storage.local.set({ authorizations });

            console.log('[Funserv Integrador] Sincronização automática concluída!');
        } else {
            console.log('[Funserv Integrador] Paciente não encontrado para sincronização automática');
        }
    } catch (error) {
        console.error('[Funserv Integrador] Erro na sincronização automática:', error);
    }
}

// Busca paciente pela carteirinha (tenta múltiplas estratégias)
async function findPatientByCarteirinha(carteirinha, nome = null) {
    try {
        console.log('[Funserv Integrador] Buscando paciente com carteirinha:', carteirinha, 'nome:', nome);

        // Estratégia 1: Busca pela coluna direta 'carteirinha'
        let response = await fetch(
            `${SUPABASE_CONFIG.url}/rest/v1/patients?carteirinha=eq.${carteirinha}&select=*`,
            {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': SUPABASE_CONFIG.anonKey,
                    'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`
                }
            }
        );

        if (response.ok) {
            const patients = await response.json();
            if (patients && patients.length > 0) {
                console.log('[Funserv Integrador] Paciente encontrado (coluna direta):', patients[0].data?.nome || patients[0].nome);
                return patients[0];
            }
        }

        // Estratégia 2: Busca onde data->>carteirinha = carteirinha
        response = await fetch(
            `${SUPABASE_CONFIG.url}/rest/v1/patients?data->>carteirinha=eq.${carteirinha}&select=*`,
            {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': SUPABASE_CONFIG.anonKey,
                    'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`
                }
            }
        );

        if (response.ok) {
            const patients = await response.json();
            if (patients && patients.length > 0) {
                console.log('[Funserv Integrador] Paciente encontrado (data->carteirinha):', patients[0].data?.nome);
                return patients[0];
            }
        }

        // Estratégia 3: Se tiver nome, tenta buscar por nome (ilike para ignorar case)
        if (nome) {
            const normalizedName = nome.trim();
            // PostgREST ilike usa * como wildcard, não %
            const searchPattern = `*${normalizedName}*`;

            console.log('[Funserv Integrador] Buscando por nome:', normalizedName);

            response = await fetch(
                `${SUPABASE_CONFIG.url}/rest/v1/patients?nome=ilike.${encodeURIComponent(searchPattern)}&select=*`,
                {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': SUPABASE_CONFIG.anonKey,
                        'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`
                    }
                }
            );

            if (response.ok) {
                const patients = await response.json();
                if (patients && patients.length > 0) {
                    console.log('[Funserv Integrador] Paciente encontrado (por nome):', patients[0].data?.nome || patients[0].nome);
                    return patients[0];
                }
            }

            // Estratégia 4: Busca por nome dentro de data->nome
            response = await fetch(
                `${SUPABASE_CONFIG.url}/rest/v1/patients?data->>nome=ilike.${encodeURIComponent(searchPattern)}&select=*`,
                {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': SUPABASE_CONFIG.anonKey,
                        'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`
                    }
                }
            );

            if (response.ok) {
                const patients = await response.json();
                if (patients && patients.length > 0) {
                    console.log('[Funserv Integrador] Paciente encontrado (data->nome):', patients[0].data?.nome);
                    return patients[0];
                }
            }
        }

        console.log('[Funserv Integrador] Paciente não encontrado por nenhuma estratégia');
        return null;
    } catch (error) {
        console.error('[Funserv Integrador] Erro ao buscar paciente:', error);
        return null;
    }
}

// Atualiza dados Funserv do paciente
async function updatePatientFunserv(patient, auth) {
    try {
        const patientData = patient.data || {};
        const funservConfig = patientData.funservConfig || {
            active: true,
            history: [],
            frequency: "1x Semana",
            usedSessions: 0,
            totalSessions: 18
        };

        // Formata a data no padrão DD/MM/YYYY
        const today = new Date();
        const dateStr = today.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });

        // Formato: "DD/MM/YYYY (Aut: XXXXXXX)"
        const historyEntry = `${dateStr} (Aut: ${auth.autorizacao})`;

        // Adiciona ao histórico (evita duplicatas)
        if (!funservConfig.history.includes(historyEntry)) {
            funservConfig.history.unshift(historyEntry);
            funservConfig.usedSessions = (funservConfig.usedSessions || 0) + 1;
        }

        // Atualiza o paciente no Supabase
        const updatedData = {
            ...patientData,
            funservConfig: funservConfig
        };

        const response = await fetch(
            `${SUPABASE_CONFIG.url}/rest/v1/patients?id=eq.${patient.id}`,
            {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': SUPABASE_CONFIG.anonKey,
                    'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`,
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify({
                    data: updatedData
                })
            }
        );

        if (response.ok) {
            console.log('[Funserv Integrador] Paciente atualizado com sucesso!');
            console.log('[Funserv Integrador] Nova entrada no histórico:', historyEntry);
            return true;
        } else {
            const error = await response.text();
            console.error('[Funserv Integrador] Erro ao atualizar:', error);
            return false;
        }
    } catch (error) {
        console.error('[Funserv Integrador] Erro ao atualizar paciente:', error);
        return false;
    }
}

// Retorna todas as autorizações
async function getAuthorizations(sendResponse) {
    try {
        const result = await chrome.storage.local.get(['authorizations', 'supabaseConfig']);
        sendResponse({
            success: true,
            authorizations: result.authorizations || [],
            supabaseConfig: result.supabaseConfig || SUPABASE_CONFIG
        });
    } catch (error) {
        sendResponse({ success: false, error: error.message });
    }
}

// Sincroniza uma autorização manualmente
async function syncToSupabase(authId, sendResponse) {
    console.log('[Funserv Background] syncToSupabase chamado com authId:', authId);

    try {
        const result = await chrome.storage.local.get(['authorizations', 'supabaseConfig']);
        SUPABASE_CONFIG = result.supabaseConfig || SUPABASE_CONFIG;

        console.log('[Funserv Background] Config carregada:', {
            url: SUPABASE_CONFIG.url ? 'OK' : 'VAZIO',
            key: SUPABASE_CONFIG.anonKey ? 'OK' : 'VAZIO',
            numAuths: result.authorizations?.length || 0
        });

        if (!SUPABASE_CONFIG.url || !SUPABASE_CONFIG.anonKey) {
            console.error('[Funserv Background] Supabase não configurado');
            sendResponse({ success: false, error: 'Supabase não configurado' });
            return;
        }

        const auth = result.authorizations.find(a => a.id === authId);
        if (!auth) {
            sendResponse({ success: false, error: 'Autorização não encontrada' });
            return;
        }

        if (!auth.beneficiario) {
            sendResponse({
                success: false,
                error: 'Carteirinha não capturada. Não é possível identificar o paciente.',
                patientNotFound: true
            });
            return;
        }

        // Busca paciente
        const patient = await findPatientByCarteirinha(auth.beneficiario, auth.nome);

        if (!patient) {
            // Atualiza status
            const authorizations = result.authorizations.map(a =>
                a.id === authId ? { ...a, patientNotFound: true } : a
            );
            await chrome.storage.local.set({ authorizations });

            sendResponse({
                success: false,
                error: 'Paciente não encontrado. Verificar se está cadastrado na plataforma Personart.',
                patientNotFound: true,
                beneficiario: auth.beneficiario
            });
            return;
        }

        // Atualiza paciente
        const updated = await updatePatientFunserv(patient, auth);

        if (updated) {
            // Marca como sincronizado
            const authorizations = result.authorizations.map(a =>
                a.id === authId ? {
                    ...a,
                    synced: true,
                    syncedAt: new Date().toISOString(),
                    patientNotFound: false,
                    patientName: patient.data?.nome
                } : a
            );
            await chrome.storage.local.set({ authorizations });

            sendResponse({ success: true, patient: patient.data });
        } else {
            sendResponse({ success: false, error: 'Erro ao atualizar paciente no Supabase' });
        }
    } catch (error) {
        sendResponse({ success: false, error: error.message });
    }
}

// Atualiza configuração do Supabase
async function updateSupabaseConfig(config, sendResponse) {
    try {
        SUPABASE_CONFIG = config;
        await chrome.storage.local.set({ supabaseConfig: config });
        console.log('[Funserv Integrador] Configuração Supabase atualizada');
        sendResponse({ success: true });
    } catch (error) {
        sendResponse({ success: false, error: error.message });
    }
}

// Limpa todas as autorizações
async function clearAuthorizations(sendResponse) {
    try {
        await chrome.storage.local.set({ authorizations: [] });
        sendResponse({ success: true });
    } catch (error) {
        sendResponse({ success: false, error: error.message });
    }
}

// Exclui uma autorização específica pelo ID
async function deleteAuthorization(authId, sendResponse) {
    try {
        const result = await chrome.storage.local.get(['authorizations']);
        const authorizations = result.authorizations || [];

        const updatedAuthorizations = authorizations.filter(a => a.id !== authId);

        await chrome.storage.local.set({ authorizations: updatedAuthorizations });
        console.log('[Funserv Integrador] Autorização excluída:', authId);
        sendResponse({ success: true });
    } catch (error) {
        console.error('[Funserv Integrador] Erro ao excluir autorização:', error);
        sendResponse({ success: false, error: error.message });
    }
}
