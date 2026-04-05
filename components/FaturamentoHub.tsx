import React, { useEffect, useMemo, useState } from 'react';
import { Appointment, ConvenioConfig, Patient } from '../types';
import { ProfessionalPayouts } from './ProfessionalPayouts';
import { FaturamentoPagamentos } from './FaturamentoPagamentos';
import { FaturamentoContasClinica } from './FaturamentoContasClinica';
import { FunservCompetencias } from './FunservCompetencias';
import { ConvenioManualLancamentos } from './ConvenioManualLancamentos';

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
  onSavePatient: _onSavePatient,
  convenios,
  setConvenios,
  appointments
}) => {
  const [mainTab, setMainTab] = useState<'pagamentos' | 'contas'>('pagamentos');
  const [pagamentosTab, setPagamentosTab] = useState<'valores' | 'convenios' | 'repasses'>('convenios');

  useEffect(() => {
    setConvenios((prev) => {
      const required = ['Danamed', 'Gama'];
      const has = new Set(prev.map((c) => normalize(c.name)));
      const missing = required.filter((name) => !has.has(normalize(name)));
      if (missing.length === 0) return prev;

      const additions: ConvenioConfig[] = missing.map((name) => ({
        id: `conv-${name.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name,
        active: true,
        payoutPercent: 75,
        payoutPrice: undefined,
        price: undefined,
        durationMin: 45
      }));

      return [...prev, ...additions];
    });
  }, [setConvenios]);

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
          onClick={() => setMainTab('pagamentos')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${mainTab === 'pagamentos'
            ? 'bg-[#273e44] text-[#e9c49e] border border-[#e9c49e]/10'
            : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
        >
          Pagamentos
        </button>

        <button
          onClick={() => setMainTab('contas')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${mainTab === 'contas'
            ? 'bg-[#273e44] text-[#e9c49e] border border-[#e9c49e]/10'
            : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
        >
          Contas da clínica
        </button>
      </div>

      {mainTab === 'pagamentos' && (
        <div className="space-y-4">
          <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-2 inline-flex gap-2 flex-wrap">
            <button
              onClick={() => setPagamentosTab('valores')}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition ${pagamentosTab === 'valores'
                ? 'bg-[#273e44] text-[#e9c49e] border border-[#e9c49e]/10'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
            >
              Tabela de valores
            </button>
            <button
              onClick={() => setPagamentosTab('convenios')}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition ${pagamentosTab === 'convenios'
                ? 'bg-[#273e44] text-[#e9c49e] border border-[#e9c49e]/10'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
            >
              Convênios
            </button>
            <button
              onClick={() => setPagamentosTab('repasses')}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition ${pagamentosTab === 'repasses'
                ? 'bg-[#273e44] text-[#e9c49e] border border-[#e9c49e]/10'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
            >
              Repasses
            </button>
          </div>

          {pagamentosTab === 'valores' && <FaturamentoPagamentos convenios={convenios} setConvenios={setConvenios} />}

          {pagamentosTab === 'convenios' && (
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
                <FunservCompetencias />
              ) : (
                <ConvenioManualLancamentos convenioName={selectedConvenio || 'Convênio'} />
              )}
            </div>
          )}

          {pagamentosTab === 'repasses' && (
            <ProfessionalPayouts patients={patients} convenios={convenios} appointments={appointments} />
          )}
        </div>
      )}

      {mainTab === 'contas' && (
        <FaturamentoContasClinica appointments={appointments} convenios={convenios} patients={patients} />
      )}
    </div>
  );
};