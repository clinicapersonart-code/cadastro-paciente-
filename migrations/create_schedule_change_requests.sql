-- Tabela para solicitações de alteração de agenda
-- Executar no Supabase SQL Editor (Dashboard > SQL Editor > New Query)

CREATE TABLE IF NOT EXISTS schedule_change_requests (
    id TEXT PRIMARY KEY,
    appointment_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('UPDATE', 'DELETE')),
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    requested_by TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    data JSONB NOT NULL
);

-- Habilitar RLS (Row Level Security)
ALTER TABLE schedule_change_requests ENABLE ROW LEVEL SECURITY;

-- Política: acesso total para chaves de serviço (anon key com policy permissiva para o app)
CREATE POLICY "Allow all for schedule_change_requests"
    ON schedule_change_requests
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Índice para buscas por status pendente
CREATE INDEX idx_schedule_requests_status ON schedule_change_requests(status);
CREATE INDEX idx_schedule_requests_timestamp ON schedule_change_requests(timestamp DESC);
