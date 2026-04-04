import React, { useState } from 'react';
import { Appointment, ConvenioConfig, Patient } from '../types';
import { FunservManager } from './FunservManager';
import { ProfessionalPayouts } from './ProfessionalPayouts';
import { FaturamentoPagamentos } from './FaturamentoPagamentos';
import { FaturamentoContasClinica } from './FaturamentoContasClinica';

interface FaturamentoHubProps {
  patients: Patient[];
  onSavePatient: (patient: Patient) => void;
  convenios: ConvenioConfig[];
  setConvenios: React.Dispatch<React.SetStateAction<ConvenioConfig[]>>;
  appointments: Appointment[];
}

export const FaturamentoHub: React.FC<FaturamentoHubProps> = ({
  patients,
  onSavePatient,
  convenios,
  setConvenios,
  appointments
}) => {
  const [subTab, setSubTab] = useState<'pagamentos' | 'funserv' | 'repasse' | 'contas'>('pagamentos');

  return (
    <div className="space-y-4">
      <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-2 inline-flex gap-2 flex-wrap">
        <button
          onClick={() => setSubTab('pagamentos')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${subTab === 'pagamentos'
            ? 'bg-[#273e44] text-[#e9c49e] border border-[#e9c49e]/10'
            : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
        >
          Pagamentos
        </button>

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

        <button
          onClick={() => setSubTab('contas')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${subTab === 'contas'
            ? 'bg-[#273e44] text-[#e9c49e] border border-[#e9c49e]/10'
            : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
        >
          Contas da clínica
        </button>
      </div>

      {subTab === 'pagamentos' && <FaturamentoPagamentos convenios={convenios} setConvenios={setConvenios} />}
      {subTab === 'funserv' && <FunservManager patients={patients} onSavePatient={onSavePatient} />}
      {subTab === 'repasse' && <ProfessionalPayouts patients={patients} convenios={convenios} appointments={appointments} />}
      {subTab === 'contas' && <FaturamentoContasClinica appointments={appointments} convenios={convenios} patients={patients} />}
    </div>
  );
};
