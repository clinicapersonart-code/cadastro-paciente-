import * as assert from 'node:assert/strict';
import { groupPendingScheduleChangeRequests } from '../utils/scheduleRequests';
import type { ScheduleChangeRequest } from '../types';

const makeRequest = (date: string, index: number, overrides: Partial<ScheduleChangeRequest> = {}): ScheduleChangeRequest => ({
  id: `req-${index}`,
  appointmentId: `appt-${index}`,
  type: 'UPDATE',
  status: 'PENDING',
  requestedBy: 'pro-nayara',
  requestedByName: 'Nayara Cinthia Malandrim',
  timestamp: `2026-05-04T13:13:${String(index % 60).padStart(2, '0')}.000Z`,
  oldData: {
    id: `appt-${index}`,
    patientId: 'patient-rafaella',
    patientName: 'Rafaella Micaelle Haniudim dia dos Santos',
    profissional: 'Nayara Cinthia Malandrim - CRP 06/143570',
    date,
    time: '09:15',
    type: 'Convênio',
    status: 'Agendado'
  },
  newData: {
    id: `appt-${index}`,
    patientId: 'patient-rafaella',
    patientName: 'Rafaella Micaelle Haniudim dia dos Santos',
    profissional: 'Nayara Cinthia Malandrim - CRP 06/143570',
    date,
    time: '08:45',
    type: 'Convênio',
    status: 'Agendado'
  },
  ...overrides
});

const repeatedSeries = Array.from({ length: 55 }, (_, index) => makeRequest(`2026-09-${String((index % 28) + 1).padStart(2, '0')}`, index));
const otherPatient = makeRequest('2026-09-19', 99, {
  id: 'req-other',
  appointmentId: 'appt-other',
  oldData: {
    ...makeRequest('2026-09-19', 99).oldData,
    id: 'appt-other',
    patientId: 'patient-outra',
    patientName: 'Outra paciente'
  },
  newData: {
    ...makeRequest('2026-09-19', 99).newData!,
    id: 'appt-other',
    patientId: 'patient-outra',
    patientName: 'Outra paciente'
  }
});

const groups = groupPendingScheduleChangeRequests([...repeatedSeries, otherPatient]);

assert.equal(groups.length, 2, 'same professional/patient/minute/time series should collapse to one group, while another patient stays separate');
assert.equal(groups[0].occurrenceCount, 55);
assert.equal(groups[0].firstRequest.requestedByName, 'Nayara Cinthia Malandrim');
assert.equal(groups[0].firstRequest.oldData.patientName, 'Rafaella Micaelle Haniudim dia dos Santos');
assert.equal(groups[0].firstDate, '2026-09-01');
assert.equal(groups[0].lastDate, '2026-09-28');
assert.deepEqual([...groups[0].requestIds].sort(), repeatedSeries.map(r => r.id).sort());

console.log('schedule request grouping ok');
