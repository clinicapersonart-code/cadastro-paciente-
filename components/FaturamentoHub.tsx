import React, { useEffect, useMemo, useState } from 'react';
import { Appointment, ConvenioConfig, Patient } from '../types';
import { FunservManager } from './FunservManager';
import { ProfessionalPayouts } from './ProfessionalPayouts';
import { FaturamentoPagamentos } from './FaturamentoPagamentos';
import { FaturamentoContasClinica } from './FaturamentoContasClinica';
import { FunservCompetencias } from './FunservCompetencias';

interface FaturamentoHubProps {
  patients: Patient[];
  onSavePatient: (patient: Patient) => void;
  convenios: ConvenioConfig[];
  setConvenios: React.Dispatch<React.SetStateAction<ConvenioConfig[]>>;
  appointments: Appointment[];
}

const normalize = (s?: string) => (s || '').trim().toLowerCase();

export const FaturamentoHub: React.FC<FaturamentoHubProps> = ({
  patients,
  onSavePatient,
  convenios,
  setConvenios,
  appointments
}) => {
  const [subTab, setSubTab] = useState<'pagamentos' | 'convenios' | 'repasse' | 'contas'>('pagamentos');

  const convenioNames = useMemo(
    () => Array.from(new Set(convenios.map((c) => c.name).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [convenios]
  );

  const [selectedConvenio, setSelectedConvenio] = useState('');

  useEffect(() => {
    if (!selectedConvenio && convenioNames.length > 0) {
      setSelectedConvenio(convenioNames[0]);
      return;
    }
    if (selectedConvenio && !convenioNames.includes(selectedConvenio)) {
      setSelectedConvenio(convenioNames[0] || '');
    }
  }, [convenioNames, selectedConvenio]);

  const isFunserv = normalize(selectedConvenio).includes('funserv');

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
          onClick={() => setSubTab('convenios')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${subTab === 'convenios'
            ? 'bg-[#273e44] text-[#e9c49e] border border-[#e9c49e]/10'
            : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
        >
          Convênios
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

      {subTab === 'convenios' && (
        <div className="space-y-4">
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4 md:p-6 shadow-xl backdrop-blur-sm">
            <h3 className="text-lg font-bold text-white mb-3">Convênios cadastrados</h3>
            <div className="flex flex-wrap gap-2">
              {convenioNames.map((name) => (
                <button
                  key={name}
                  onClick={() => setSelectedConvenio(name)}
                  className={`px-3 py-2 rounded-lg text-sm transition ${selectedConvenio === name
                    ? 'bg-[#273e44] text-[#e9c49e] border border-[#e9c49e]/20'
                    : 'bg-slate-900 text-slate-300 border border-slate-700 hover:bg-slate-800'
                    }`}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>

          {isFunserv ? (
            <div className="space-y-4">
              <FunservCompetencias />
              <FunservManager patients={patients} onSavePatient={onSavePatient} />
            </div>
          ) : (
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 shadow-xl backdrop-blur-sm">
              <h4 className="text-white font-bold mb-2">{selectedConvenio || 'Convênio'}</h4>
              <p className="text-slate-400 text-sm">
                Para este convênio, os valores ficam na subaba Pagamentos.
                {' '}O painel operacional completo (glosas + gestão por competência) está ativo no convênio Funserv.
              </p>
            </div>
          )}
        </div>
      )}

      {subTab === 'repasse' && <ProfessionalPayouts patients={patients} convenios={convenios} appointments={appointments} />}
      {subTab === 'contas' && <FaturamentoContasClinica appointments={appointments} convenios={convenios} patients={patients} />}
    </div>
  );
};