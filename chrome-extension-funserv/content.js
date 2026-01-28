// Content Script - Detecta autorizações aprovadas no SaudeWeb Funserv
// Lê dados da TELA DE CONFIRMAÇÃO onde todos dados aparecem claramente

(function () {
    'use strict';

    console.log('[Funserv Integrador] Content script carregado');

    // Dados capturados
    let capturedData = {
        beneficiario: null,
        nome: null,
        autorizacao: null,
        status: null,
        dataCaptura: null
    };

    // Verifica se já capturou essa autorização (evita duplicatas)
    let lastCapturedAuth = null;

    // Extrai dados da tela de confirmação
    function extractFromConfirmationPage() {
        const pageText = document.body.innerText;
        const currentUrl = window.location.href;

        // Verifica se é página de relatório pela URL
        const isReportPage = currentUrl.includes('/Relatorio') || currentUrl.includes('?s=');

        console.log('[Funserv Integrador] Analisando página:', currentUrl);

        // Se NÃO for página de relatório E NÃO tiver "APROVADA", ignora
        if (!isReportPage && !pageText.includes('APROVADA') && !pageText.includes('Autorizado:')) {
            return null;
        }

        const data = {
            beneficiario: null,
            nome: null,
            autorizacao: null,
            status: 'APROVADA',
            dataCaptura: new Date().toISOString(),
            url: currentUrl
        };

        // 1. Tenta pegar autorização da URL primeiro (?s=6628239)
        const urlMatch = currentUrl.match(/[?&]s=(\d+)/);
        if (urlMatch) {
            data.autorizacao = urlMatch[1];
            console.log('[Funserv Integrador] ✓ Autorização da URL:', data.autorizacao);
        }

        // 2. Extrai Beneficiário
        // A) Tenta dos campos de INPUT (página de formulário/relatório)
        // IDs confirmados pelo usuário: SMASSOC_SMASSOC_MATRICULA
        const benefInputs = [
            'SMASSOC_SMASSOC_MATRICULA', // ID confirmado
            'helperFRM0700100_USUARIO',
            'txtBeneficiario',
            'Beneficiario',
            'MainContent_txtBeneficiario'
        ];

        for (let id of benefInputs) {
            const el = document.getElementById(id) || document.querySelector(`input[name="${id}"]`) || document.querySelector(`input[name="SMASSOC.SMASSOC_MATRICULA"]`);
            if (el && el.value) {
                data.beneficiario = el.value.trim();
                console.log('[Funserv Integrador] ✓ Beneficiário (Input/ID):', data.beneficiario);
                break;
            }
        }

        // B) Se não achou, tenta do texto (innerText)
        if (!data.beneficiario) {
            const benefPatterns = [
                /Beneficiário[:\s]+(\d+)/i,
                /Carteirinha[:\s]+(\d+)/i,
                /(\d{7})(?=\s+Nome)/
            ];

            for (let pattern of benefPatterns) {
                const match = pageText.match(pattern);
                if (match) {
                    data.beneficiario = match[1].trim();
                    console.log('[Funserv Integrador] ✓ Beneficiário (Texto):', data.beneficiario);
                    break;
                }
            }
        }

        // 3. Extrai Nome
        // A) Tenta dos inputs
        // ID confirmado pelo usuário: SMASSOC_SMPESSOA_SMPESSOA_NOME
        const nomeInputs = [
            'SMASSOC_SMPESSOA_SMPESSOA_NOME', // ID confirmado
            'txtNome',
            'Nome',
            'MainContent_txtNome'
        ];

        for (let id of nomeInputs) {
            const el = document.getElementById(id) || document.querySelector(`input[name="${id}"]`) || document.querySelector(`input[name="SMASSOC.SMPESSOA.SMPESSOA_NOME"]`);
            if (el && el.value) {
                data.nome = el.value.trim();
                console.log('[Funserv Integrador] ✓ Nome (Input/ID):', data.nome);
                break;
            }
        }

        // B) Se não achou, tenta do texto
        if (!data.nome) {
            const nomeMatch = pageText.match(/Nome[:\s]+([A-ZÁÀÂÃÉÈÊÍÌÎÓÒÔÕÚÙÛÇ\s]+?)(?=\n|Solicit|$|Situação)/i);
            if (nomeMatch) {
                data.nome = nomeMatch[1].trim();
                console.log('[Funserv Integrador] ✓ Nome (Texto):', data.nome);
            }
        }

        // 4. Extrai Solicitação de Autorização
        // A) Tenta dos inputs (campo "Solicitação de Autorização")
        // ID confirmado pelo usuário: numAutorizacao
        const authInputs = ['numAutorizacao'];
        for (let id of authInputs) {
            const el = document.getElementById(id) || document.querySelector(`input[name="${id}"]`);
            if (el && el.value) {
                data.autorizacao = el.value.trim();
                console.log('[Funserv Integrador] ✓ Autorização (Input/ID):', data.autorizacao);
                break;
            }
        }

        if (!data.autorizacao) {
            const autMatch = pageText.match(/Solicitação de Autorização[:\s]+(\d+)/i);
            // Tenta também tags <span> ou inputs que possam ter esse valor
            const inputs = document.querySelectorAll('input[type="text"]');
            for (let i of inputs) {
                // Às vezes o valor é exatamente o número e tem 7 dígitos
                if (i.value && /^\d{7}$/.test(i.value) && i.value !== data.beneficiario) {
                    // É um candidato forte a ser o número da autorização
                    // Mas vamos dar preferência ao regex do texto que é mais seguro pelo label
                }
            }

            if (autMatch) {
                data.autorizacao = autMatch[1].trim();
                console.log('[Funserv Integrador] ✓ Autorização (Texto):', data.autorizacao);
            }
        }

        // Se achou autorização + beneficiário, SUCEESSO
        if (data.beneficiario && data.autorizacao) {
            console.log('[Funserv Integrador] ✓ TODOS DADOS CAPTURADOS:', data);
            return data;
        }

        console.log('[Funserv Integrador] ✗ Dados incompletos:', data);
        return null;
    }

    // Verifica a página
    function checkPage() {
        const data = extractFromConfirmationPage();

        if (data) {
            // Se os dados mudaram ou é a primeira captura
            if (!lastCapturedAuth || lastCapturedAuth !== data.autorizacao) {
                console.log('[Funserv Integrador] NOVOS DADOS CAPTURADOS:', data);
                lastCapturedAuth = data.autorizacao;
                capturedData = data;
                sendToBackground(data);
            }
        }
    }

    // Escuta mensagens do popup (para captura manual)
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.type === 'FORCE_CAPTURE') {
            console.log('[Funserv Integrador] Captura manual solicitada');
            const data = extractFromConfirmationPage();

            if (data) {
                lastCapturedAuth = data.autorizacao;
                sendToBackground(data);
                sendResponse({ success: true, data: data });
            } else {
                console.log('[Funserv Integrador] Captura manual falhou - dados não encontrados');
                const pageDump = document.body.innerText.substring(0, 500); // Debug
                sendResponse({ success: false, error: 'Dados não encontrados na página', debug: pageDump });
            }
        }
        return true;
    });

    // Envia dados para o background script
    function sendToBackground(data) {
        console.log('[Funserv Integrador] Enviando para background...');

        chrome.runtime.sendMessage({
            type: 'AUTHORIZATION_APPROVED',
            data: data
        }, (response) => {
            if (chrome.runtime.lastError) {
                console.error('[Funserv Integrador] Erro:', chrome.runtime.lastError);
                return;
            }

            if (response && response.success) {
                console.log('[Funserv Integrador] Autorização salva com sucesso!');
                showNotification(data);
            } else {
                console.log('[Funserv Integrador] Resposta:', response);
            }
        });
    }

    // Mostra notificação visual na página
    function showNotification(data) {
        // Remove notificação anterior se existir
        const existing = document.getElementById('funserv-notification');
        if (existing) existing.remove();

        const notification = document.createElement('div');
        notification.id = 'funserv-notification';
        notification.innerHTML = `
            <div style="
                position: fixed;
                top: 20px;
                right: 20px;
                background: linear-gradient(135deg, #10b981, #059669);
                color: white;
                padding: 16px 24px;
                border-radius: 12px;
                box-shadow: 0 10px 40px rgba(0,0,0,0.3);
                z-index: 999999;
                font-family: 'Segoe UI', Arial, sans-serif;
                max-width: 350px;
                animation: funservSlideIn 0.3s ease-out;
            ">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <div style="
                        width: 40px;
                        height: 40px;
                        background: rgba(255,255,255,0.2);
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 20px;
                    ">✓</div>
                    <div>
                        <div style="font-weight: bold; font-size: 14px;">✅ Sincronizado com Personart!</div>
                        <div style="font-size: 12px; opacity: 0.9; margin-top: 4px;">
                            Carteirinha: ${data.beneficiario}<br>
                            Autorização: ${data.autorizacao}<br>
                            Paciente: ${data.nome || 'N/A'}
                        </div>
                    </div>
                </div>
            </div>
            <style>
                @keyframes funservSlideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            </style>
        `;

        document.body.appendChild(notification);

        // Remove após 6 segundos
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.transition = 'all 0.3s ease-out';
                notification.style.opacity = '0';
                notification.style.transform = 'translateX(100%)';
                setTimeout(() => notification.remove(), 300);
            }
        }, 6000);
    }

    // Inicialização
    function init() {
        // Verifica imediatamente
        setTimeout(checkPage, 500);
        setTimeout(checkPage, 1500);

        // Observer para detectar mudanças na página
        const observer = new MutationObserver(() => {
            clearTimeout(window.funservCheckTimeout);
            window.funservCheckTimeout = setTimeout(checkPage, 500);
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        // Verifica quando URL muda
        let lastUrl = location.href;
        setInterval(() => {
            if (location.href !== lastUrl) {
                lastUrl = location.href;
                console.log('[Funserv Integrador] URL mudou, verificando...');
                setTimeout(checkPage, 1000);
            }
        }, 1000);
    }

    // Aguarda DOM carregar
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
