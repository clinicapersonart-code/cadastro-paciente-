# Extensão Chrome - Funserv Integrador

Extensão Chrome para capturar autorizações aprovadas do SaudeWeb Funserv e sincronizar com a plataforma Clínica Personart.

## Como Instalar

1. Abra o Chrome e acesse `chrome://extensions/`
2. Ative o **Modo desenvolvedor** (canto superior direito)
3. Clique em **Carregar sem compactação**
4. Selecione a pasta `chrome-extension-funserv`

## Como Usar

1. Acesse o site do SaudeWeb Funserv
2. Faça login normalmente
3. Quando uma autorização for **APROVADA**, a extensão captura automaticamente:
   - Número da carteirinha (beneficiário)
   - Número da autorização
   - Nome do paciente
4. Clique no ícone da extensão para ver as autorizações capturadas
5. Use o botão "Copiar" ou "Sincronizar" conforme necessário

## Configurar Supabase

Para sincronizar automaticamente com o banco de dados:

1. Clique no ícone da extensão
2. Vá na aba **Configurações**
3. Preencha:
   - **URL do Projeto**: `https://seu-projeto.supabase.co`
   - **Anon Key**: Sua chave pública do Supabase
   - **Nome da Tabela**: Nome da tabela onde salvar (padrão: `autorizacoes`)
4. Clique em **Salvar Configurações**

## Estrutura de Dados

A extensão captura e salva os seguintes campos:

| Campo | Descrição |
|-------|-----------|
| beneficiario | Número da carteirinha |
| nome | Nome do paciente |
| numero_autorizacao | Número da autorização gerada |
| data_captura | Data/hora da captura |
| status | Status da autorização (APROVADA) |

## Arquivos

- `manifest.json` - Configuração da extensão
- `content.js` - Script que detecta autorizações no SaudeWeb
- `background.js` - Service worker para armazenamento
- `popup.html/js/css` - Interface da extensão
