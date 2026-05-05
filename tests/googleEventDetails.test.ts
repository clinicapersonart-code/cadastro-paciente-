import * as assert from 'node:assert/strict';
import { buildEventBody } from '../api/google-calendar-sync';

const body = buildEventBody({
  id: 'appt-1',
  patientId: 'patient-1',
  patientName: 'Paciente Criança',
  profissional: 'Profissional Teste - CRP 00/0000',
  date: '2026-05-12',
  time: '08:00',
  durationMin: 45,
  type: 'Convênio',
  convenioName: 'Unimed',
  status: 'Agendado',
  carteirinha: 'CARD-123',
  patientResponsavel: 'Maria Responsável',
  patientContato: '(11) 99999-0000',
  patientFaixa: 'Criança',
  obs: 'Observação clínica'
});

assert.equal(body.summary, 'Paciente Criança • Unimed');
assert.match(body.description, /Data de início: 12\/05\/2026/);
assert.match(body.description, /Carteirinha: CARD-123/);
assert.match(body.description, /Responsável: Maria Responsável/);
assert.match(body.description, /Contato: \(11\) 99999-0000/);
assert.match(body.description, /Obs: Observação clínica/);

console.log('google event details ok');
