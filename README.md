<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1tFeDKuTjGf-1jSHXNPtIjksNNFh9131w

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Integração Google Agenda (MVP 1 via)

Esta versão já suporta sincronização **sistema -> Google Agenda** para criar/editar/excluir eventos quando um agendamento é alterado no app.

### 1) Variáveis de ambiente

No frontend (Vite):

- `VITE_GOOGLE_CALENDAR_SYNC_ENABLED=true`

No backend (Vercel / API):

- `GOOGLE_CALENDAR_ID` (opcional: ID de agenda única/fallback)
- `GOOGLE_CALENDAR_IDS_BY_PROFESSIONAL` (opcional: JSON com nome do profissional -> ID da agenda; quando existir, tem prioridade sobre `GOOGLE_CALENDAR_ID`)
- `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64` (JSON da service account em base64)
- `GOOGLE_CALENDAR_TIMEZONE=America/Sao_Paulo` (opcional, default já é este)

### 2) Permissão da service account na agenda

1. Crie uma Service Account no Google Cloud.
2. Ative a Google Calendar API no projeto.
3. Compartilhe a agenda de destino com o e-mail da service account (permissão de edição).
4. Configure as variáveis acima no ambiente de deploy.

### 3) Observações

- O vínculo entre agendamento interno e evento Google é salvo em `googleEventId` dentro do objeto `Appointment`.
- Se `VITE_GOOGLE_CALENDAR_SYNC_ENABLED` estiver desligado, o sistema funciona normalmente sem chamar a API Google.
