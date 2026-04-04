import React, { useState } from 'react';
import { Appointment, ConvenioConfig, Patient } from '../types';
import { FunservManager } from './FunservManager';
import { ProfessionalPayouts } from './ProfessionalPayouts';

interface FaturamentoHubProps {
  patients: Patient[];
  onSavePatient: (patient: Patient) => void;
  convenios: ConvenioConfig[];
  appointments: Appointment[];
}

export const FaturamentoHub: React.FC<FaturamentoHubProps> = ({
  patients,
  onSavePatient,
  convenios,
  appointments
}) => {
  const [subTab, setSubTab] = useState<'funserv' | 'repasse'>('funserv');

  return (
    <div className="space-y-4">
      <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-2 inline-flex gap-2">
        <button
          onClick={() => setSubTab('funserv')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${subTab === 'funserv'
            ? 'bg-[#273e44] text-[#e9c49e] border border-[#e9c49e]/10'
            : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
        >
          Funserv
        </button>

        <button
          onClick={() => setSubTab('repasse')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${subTab === 'repasse'
            ? 'bg-[#273e44] text-[#e9c49e] border border-[#e9c49e]/10'
            : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
        >
          Repasses
        </button>
      </div>

      {subTab === 'funserv' && <FunservManager patients={patients} onSavePatient={onSavePatient} />}
      {subTab === 'repasse' && <ProfessionalPayouts patients={patients} convenios={convenios} appointments={appointments} />}
    </div>
  );
};
