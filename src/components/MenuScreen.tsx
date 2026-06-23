import React, { useEffect, useState } from 'react';
import { MessageSquare, BarChart3, ChevronRight, Lock, CheckCircle2, Clock, Play, Shield } from 'lucide-react';
import { Usuario, Resultado } from '../types';

interface MenuScreenProps {
  usuario: Usuario;
  myResult: Resultado | null;
  isAdmin?: boolean;
  onSelectStep: (step: 'chatbot' | 'dashboard') => void;
  onGoToAdmin?: () => void;
}

export default function MenuScreen({ usuario, myResult, isAdmin, onSelectStep, onGoToAdmin }: MenuScreenProps) {
  const [hasProgress, setHasProgress] = useState(false);
  const [resumeIndex, setResumeIndex] = useState(0);

  useEffect(() => {
    try {
      const savedProgress = localStorage.getItem(`potenciar_progress_${usuario.uid}`);
      if (savedProgress) {
        const parsed = JSON.parse(savedProgress);
        if (parsed && typeof parsed.currentQuestionIndex === 'number') {
          setHasProgress(true);
          setResumeIndex(parsed.currentQuestionIndex);
        }
      }
    } catch (e) {
      console.error('Error reading progress', e);
    }
  }, [usuario.uid]);

  return (
    <div className="max-w-4xl w-full mx-auto p-4 animate-fade-in" id="menu-screen-container">
      {/* Upper Brand / Welcome Banner */}
      <div className="text-center mb-10" id="menu-header">
        <span className="bg-[#112363]/5 text-[#112363] text-xxs font-bold uppercase tracking-widest px-3.5 py-1.5 rounded-full inline-block mb-3">
          PAINEL POTENCIAR
        </span>
        <h2 className="text-3xl font-extrabold text-[#112363] tracking-tight" id="menu-main-title">
          Olá, {usuario.nome}!
        </h2>
        <p className="text-gray-500 text-sm mt-2 max-w-xl mx-auto" id="menu-sub-title">
          Bem-vindo ao seu portal de socioestilo. Selecione uma das opções abaixo para responder ao teste ou verificar seu diagnóstico comportamental.
        </p>
      </div>

      {/* Grid of Large Option Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6" id="menu-options-grid">
        
        {/* Card 1: Responder Form / Chatbot */}
        <button
          onClick={() => onSelectStep('chatbot')}
          className="flex flex-col text-left p-8 bg-white border-2 border-transparent hover:border-[#112363] rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 group relative overflow-hidden cursor-pointer w-full focus:outline-none focus:ring-2 focus:ring-[#112363]/20"
          id="btn-menu-chatbot"
        >
          {/* Subtle design element */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-gray-50 rounded-full translation-x-8 -translate-y-8 opacity-40 group-hover:scale-110 transition-all duration-300 pointer-events-none" />

          {/* Icon Badge */}
          <div className="w-14 h-14 bg-[#112363]/5 group-hover:bg-[#112363]/10 text-[#112363] rounded-2xl flex items-center justify-center transition-all mb-6">
            <MessageSquare className="w-7 h-7" />
          </div>

          <h3 className="text-lg font-bold text-[#112363] flex items-center">
            <span>Responder Questionário</span>
            <ChevronRight className="w-4 h-4 ml-1.5 text-[#112363]/40 group-hover:translate-x-1 transition-transform" />
          </h3>
          
          <p className="text-gray-500 text-xs leading-relaxed mt-2 flex-grow">
            Inicie ou retome o preenchimento do questionário interativo de socioestilo de forma rápida e guiada diretamente com nosso robô assistente.
          </p>

          {/* Status Indicator */}
          <div className="mt-8 pt-4 border-t border-gray-100 flex items-center justify-between w-full">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              Status do Formulário
            </span>
            {hasProgress ? (
              <span className="inline-flex items-center space-x-1 bg-amber-50 text-amber-800 text-xxs font-bold px-3 py-1 rounded-full border border-amber-100 animate-pulse">
                <Clock className="w-3.5 h-3.5" />
                <span>Em Andamento (Questão {resumeIndex + 1}/5)</span>
              </span>
            ) : myResult ? (
              <span className="inline-flex items-center space-x-1 bg-green-50 text-green-800 text-xxs font-bold px-3 py-1 rounded-full border border-green-100">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Concluído (Disponível para Refazer)</span>
              </span>
            ) : (
              <span className="inline-flex items-center space-x-1 bg-gray-50 text-gray-700 text-xxs font-bold px-3 py-1 rounded-full border border-gray-150">
                <Play className="w-3.5 h-3.5" />
                <span>Não Iniciado</span>
              </span>
            )}
          </div>
        </button>

        {/* Card 2: Resultados e Diagnóstico */}
        <button
          onClick={() => myResult && onSelectStep('dashboard')}
          disabled={!myResult}
          className={`flex flex-col text-left p-8 bg-white border-2 border-transparent rounded-2xl transition-all duration-200 group relative overflow-hidden w-full focus:outline-none focus:ring-2 ${
            myResult 
              ? 'hover:border-[#112363] shadow-sm hover:shadow-md cursor-pointer focus:ring-[#112363]/20' 
              : 'opacity-70 bg-gray-50/50 border-gray-100 cursor-not-allowed shadow-none'
          }`}
          id="btn-menu-results"
        >
          {/* Subtle design block */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-gray-50 rounded-full translation-x-8 -translate-y-8 opacity-40 group-hover:scale-110 transition-all duration-300 pointer-events-none" />

          {/* Icon Badge */}
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all mb-6 ${
            myResult 
              ? 'bg-[#D80E2A]/5 group-hover:bg-[#D80E2A]/10 text-[#D80E2A]' 
              : 'bg-gray-100 text-gray-400'
          }`}>
            {myResult ? <BarChart3 className="w-7 h-7" /> : <Lock className="w-6 h-6" />}
          </div>

          <h3 className="text-lg font-bold text-[#112363] flex items-center">
            <span>Visualizar Resultados</span>
            {myResult && (
              <ChevronRight className="w-4 h-4 ml-1.5 text-[#D80E2A]/40 group-hover:translate-x-1 transition-transform" />
            )}
          </h3>

          <p className="text-gray-500 text-xs leading-relaxed mt-2 flex-grow">
            Acesse seu relatório detalhado de socioestilo, o gráfico dinâmico de dominância e o plano personalizado de desenvolvimento pessoal e profissional.
          </p>

          {/* Status Indicator */}
          <div className="mt-8 pt-4 border-t border-gray-100 flex items-center justify-between w-full">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              Status do Resultado
            </span>
            {myResult ? (
              <span className="inline-flex items-center space-x-1 bg-green-50 text-green-800 text-xxs font-bold px-3 py-1 rounded-full border border-green-100">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Disponível</span>
              </span>
            ) : (
              <span className="inline-flex items-center space-x-1 bg-gray-100 text-gray-500 text-xxs font-bold px-3 py-1 rounded-full border border-gray-200">
                <Lock className="w-3 h-3" />
                <span>Bloqueado (Responda primeiro)</span>
              </span>
            )}
          </div>
        </button>

        {/* Card 3: Admin Controls (shown only to admin) */}
        {isAdmin && onGoToAdmin && (
          <button
            onClick={onGoToAdmin}
            className="flex flex-col text-left p-8 bg-slate-900 border-2 border-red-500/20 hover:border-red-500 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200 group relative overflow-hidden md:col-span-2 cursor-pointer w-full text-white focus:outline-none focus:ring-2 focus:ring-red-500/20"
            id="btn-menu-admin"
          >
            {/* Design detail */}
            <div className="absolute top-0 right-0 w-44 h-44 bg-red-600/5 rounded-full translate-x-12 -translate-y-12 transition-all duration-300 pointer-events-none" />

            {/* Icon Banner */}
            <div className="w-14 h-14 bg-red-500/10 text-red-500 rounded-2xl flex items-center justify-center transition-all mb-6">
              <Shield className="w-7 h-7 text-red-500" />
            </div>

            <h3 className="text-lg font-black text-white flex items-center">
              <span>Painel de Gestão & Adequações (ADMIN)</span>
              <ChevronRight className="w-4 h-4 ml-1.5 text-red-500 group-hover:translate-x-1 transition-transform" />
            </h3>

            <p className="text-gray-300 text-xs leading-relaxed mt-2 flex-grow">
              Acesso exclusivo para administradores e consultores executivos Potenciar. Registre novas empresas parceiras, gerencie turmas acadêmicas ou realize adequações de e-mails, permissões e reajuste scores comportamentais em caso de refinamentos técnicos.
            </p>

            {/* Status indicators */}
            <div className="mt-8 pt-4 border-t border-white/10 flex items-center justify-between w-full">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                Status de Credencial
              </span>
              <span className="inline-flex items-center space-x-1 bg-red-500/10 text-red-400 text-xxs font-bold px-3 py-1 rounded-full border border-red-500/20">
                <span>Administrador Master Ativo</span>
              </span>
            </div>
          </button>
        )}

      </div>

      {/* Safe company notice */}
      <div className="mt-12 text-center text-xxs text-gray-400" id="menu-footer-notes">
        Metodologia de perfis comportamentais Potenciar. Seus dados estão protegidos sob protocolos corporativos.
      </div>
    </div>
  );
}
