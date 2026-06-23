import React, { useState, useEffect } from 'react';
import { User, Building2, ChevronRight, AlertCircle } from 'lucide-react';
import { Usuario, Empresa } from '../types';
import Logo from './Logo';
import { listarEmpresas, criarEmpresa, criarUsuario, mapFirebaseUidToUuid } from '../lib/supabase';

interface OnboardingScreenProps {
  uid: string;
  email: string;
  onComplete: (userProfile: Usuario) => void;
}

export default function OnboardingScreen({ uid, email, onComplete }: OnboardingScreenProps) {
  const [nome, setNome] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [companiesList, setCompaniesList] = useState<Empresa[]>([]);

  // Fetch some existing companies to suggest them in a dropdown/autocomplete
  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const list = await listarEmpresas();
        setCompaniesList(list);
      } catch (err) {
        // Silently capture since suggesting companies is an enhancement
        console.warn("Nenhuma empresa prévia pôde ser carregada ou lida:", err);
      }
    };
    fetchCompanies();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNome = nome.trim();

    if (!cleanNome || !selectedCompanyId) {
      setError('Por favor, preencha o seu nome completo e selecione sua empresa.');
      return;
    }

    if (cleanNome.length < 3) {
      setError('O seu nome completo deve conter pelo menos 3 caracteres.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Find selected company in list
      const selectedCompany = companiesList.find(c => {
        const compId = c.id || (c as any).id_empresa || (c as any).empresa_id;
        return String(compId) === String(selectedCompanyId);
      });

      if (!selectedCompany) {
        throw new Error('A empresa selecionada não é mais válida. Por favor, atualize e selecione novamente.');
      }

      const finalEmpresaId = selectedCompanyId;
      const finalEmpresaNome = selectedCompany.nome;

      // 2. Create user profile in Database via RPC: criar_usuario
      await criarUsuario(
        uid,
        email,
        cleanNome,
        finalEmpresaId,
        'user',
        null
      );

      const newUserProfile: Usuario = {
        uid: mapFirebaseUidToUuid(uid),
        email: email,
        nome: cleanNome,
        empresa_id: finalEmpresaId,
        empresa_nome: finalEmpresaNome,
        role: 'user'
      };

      // Finish Onboarding
      onComplete(newUserProfile);

    } catch (err: any) {
      console.error("Erro no onboarding:", err);
      const detail = err?.message || String(err);
      setError(`Erro ao gravar dados cadastrais: ${detail}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-4 max-w-md w-full mx-auto" id="onboarding-container">
      {/* Brand logo at core center */}
      <Logo size="md" className="mb-6 justify-center w-full" />

      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 w-full relative overflow-hidden" id="onboarding-card">
        {/* Sleek navy highlight strip */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-[#112363]" />

        <div className="text-center mb-8">
          <span className="text-[10px] bg-amber-50 text-amber-800 font-bold px-3 py-1 rounded-full uppercase tracking-wider">
            Cadastro Necessário
          </span>
          <h2 className="text-2xl font-bold text-[#112363] mt-3" id="onboarding-title">
            Complete seu Perfil
          </h2>
          <p className="text-gray-500 text-sm mt-2" id="onboarding-subtitle">
            Informe seu nome e empresa para podermos vincular os scores de equipe corretos.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-100 flex items-start space-x-3 text-red-800" id="onboarding-error-block">
            <AlertCircle className="w-5 h-5 text-[#D80E2A] shrink-0 mt-0.5" />
            <div className="text-xs font-medium leading-relaxed">
              {error}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6" id="onboarding-form">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#112363]/80 uppercase tracking-wider" htmlFor="name-input">
              Seu Nome Completo
            </label>
            <div className="relative">
              <User className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" />
              <input
                id="name-input"
                type="text"
                placeholder="Ex: João da Silva"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                disabled={loading}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-11 pr-4 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#112363]/20 focus:border-[#112363] transition-all"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#112363]/80 uppercase tracking-wider" htmlFor="company-select">
              Sua Empresa / Turma Cadastrada
            </label>
            <div className="relative">
              <Building2 className="absolute left-3 top-3.5 w-5 h-5 text-gray-400 pointer-events-none" />
              <select
                id="company-select"
                value={selectedCompanyId}
                onChange={(e) => setSelectedCompanyId(e.target.value)}
                disabled={loading}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-11 pr-10 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#112363]/20 focus:border-[#112363] transition-all appearance-none cursor-pointer"
                required
              >
                <option value="">-- Selecione uma Empresa --</option>
                {companiesList.map((comp) => {
                  const compId = comp.id || (comp as any).id_empresa || (comp as any).empresa_id;
                  return (
                    <option key={compId} value={compId}>
                      {comp.nome}
                    </option>
                  );
                })}
              </select>
              {/* Custom disclosure arrow */}
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
            <p className="text-[10px] text-gray-400 mt-1.5 leading-normal">
              O cadastro de novas empresas é restrito ao <strong>Administrador (ADMIN)</strong>. Se sua organização não estiver na lista acima, por favor fale com a nossa equipe de suporte.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#112363] text-white py-3.5 rounded-xl text-sm font-semibold hover:bg-[#112363]/90 active:scale-[0.99] transition-all shadow-sm flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
            id="btn-onboarding-submit"
          >
            {loading ? (
              <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <>
                <span>Prosseguir para o Teste</span>
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
