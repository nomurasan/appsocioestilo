import React, { useEffect, useState } from 'react';
import { MessageSquare, BarChart3, ChevronRight, Lock, CheckCircle2, Clock, Play, Shield, X, Sparkles, HelpCircle, ChevronLeft, Bot } from 'lucide-react';
import { Usuario, Resultado } from '../types';

interface MenuScreenProps {
  usuario: Usuario;
  myResult: Resultado | null;
  isAdmin?: boolean;
  onSelectStep: (step: 'chatbot' | 'orientador' | 'dashboard') => void;
  onGoToAdmin?: () => void;
}

export default function MenuScreen({ usuario, myResult, isAdmin, onSelectStep, onGoToAdmin }: MenuScreenProps) {
  const [hasProgress, setHasProgress] = useState(false);
  const [resumeIndex, setResumeIndex] = useState(0);
  const [showVideoModal, setShowVideoModal] = useState(false);

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

      {/* Banner de Metodologia e Vídeo (Antes da Pesquisa) */}
      <div 
        className="mb-8 bg-gradient-to-r from-amber-500/5 via-white to-[#112363]/5 border-2 border-slate-150 p-5 md:p-6 rounded-2xl flex flex-col md:flex-row items-center gap-5 shadow-3xs hover:shadow-2xs transition-all duration-300 relative overflow-hidden" 
        id="conhecer-pesquisa-banner"
      >
        {/* Decorative ambient background ring */}
        <div className="absolute -top-12 -left-12 w-24 h-24 bg-amber-500/5 rounded-full pointer-events-none" />
        <div className="absolute -bottom-12 -right-12 w-24 h-24 bg-[#112363]/5 rounded-full pointer-events-none" />

        {/* Avatar Frame - Smiling Mature Woman Advisor likeness */}
        <div className="relative shrink-0 animate-pulse-slow" id="avatar-callout-container">
          <div className="w-18 h-18 md:w-20 md:h-20 rounded-full overflow-hidden border-2 border-amber-400 p-0.5 bg-white shadow-sm hover:scale-105 transition-transform duration-300">
            <img 
              src="/Joceli Drummond.png"
              alt="Joceli Drummond"
              className="w-full h-full object-cover rounded-full"
              referrerPolicy="no-referrer"
            />
          </div>
          {/* Active online indicator dot */}
          <span className="absolute bottom-1 right-1 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full animate-ping" />
          <span className="absolute bottom-1 right-1 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full" />
        </div>

        {/* Content Text Area */}
        <div className="space-y-1.5 flex-grow text-center md:text-left">
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
            <span className="bg-amber-100 text-amber-900 text-[9px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full inline-block">
              Senior Partner
            </span>
            <span className="text-[10px] text-slate-400 font-bold">por Joceli Drummond</span>
          </div>
          <h3 className="text-sm md:text-base font-extrabold text-[#112363]" id="btn-conhecer-pesquisa-title">
            Quer entender como funciona a Pesquisa de Socioestilo?
          </h3>
          <p className="text-gray-500 text-xs leading-relaxed max-w-xl">
            "Olá! Antes de iniciar o seu teste, assista a este vídeo rápido de 1 minuto para conhecer o impacto da metodologia e como ela apoia o seu autoconhecimento corporativo."
          </p>
        </div>

        {/* Call to action button */}
        <button
          onClick={() => setShowVideoModal(true)}
          className="flex items-center space-x-2 bg-[#112363] hover:bg-[#112363]/95 text-white font-extrabold text-xs py-3 px-5 rounded-xl shadow-xs transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer shrink-0 group w-full md:w-auto justify-center"
          id="btn-conhecer-pesquisa"
        >
          <Play className="w-4 h-4 fill-current group-hover:scale-110 transition-transform text-amber-400" />
          <span>Assistir Vídeo Explicativo</span>
        </button>
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

        {/* Card 2: Orientador SocioEstilo */}
        <button
          onClick={() => myResult && onSelectStep('orientador')}
          disabled={!myResult}
          className={`flex flex-col text-left p-8 bg-white border-2 border-transparent rounded-2xl transition-all duration-200 group relative overflow-hidden w-full focus:outline-none focus:ring-2 ${
            myResult
              ? 'hover:border-[#112363] shadow-sm hover:shadow-md cursor-pointer focus:ring-[#112363]/20'
              : 'opacity-70 bg-gray-50/50 border-gray-100 cursor-not-allowed shadow-none'
          }`}
          id="btn-menu-orientador"
          title={myResult ? 'Conversar com o Orientador SocioEstilo' : 'Disponivel apos a geracao do seu relatorio.'}
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-gray-50 rounded-full translation-x-8 -translate-y-8 opacity-40 group-hover:scale-110 transition-all duration-300 pointer-events-none" />

          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all mb-6 ${
            myResult
              ? 'bg-[#112363]/5 group-hover:bg-[#112363]/10 text-[#112363]'
              : 'bg-gray-100 text-gray-400'
          }`}>
            {myResult ? <Bot className="w-7 h-7" /> : <Lock className="w-6 h-6" />}
          </div>

          <h3 className="text-lg font-bold text-[#112363] flex items-center">
            <span>Conversar com o Orientador SocioEstilo</span>
            {myResult && (
              <ChevronRight className="w-4 h-4 ml-1.5 text-[#112363]/40 group-hover:translate-x-1 transition-transform" />
            )}
          </h3>

          <p className="text-gray-500 text-xs leading-relaxed mt-2 flex-grow">
            Tire duvidas sobre seu relatorio, compreenda seus estilos e receba orientacoes para seu desenvolvimento.
          </p>

          <div className="mt-8 pt-4 border-t border-gray-100 flex items-center justify-between w-full">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              Status do Orientador
            </span>
            {myResult ? (
              <span className="inline-flex items-center space-x-1 bg-green-50 text-green-800 text-xxs font-bold px-3 py-1 rounded-full border border-green-100">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Disponivel</span>
              </span>
            ) : (
              <span className="inline-flex items-center space-x-1 bg-gray-100 text-gray-500 text-xxs font-bold px-3 py-1 rounded-full border border-gray-200">
                <Lock className="w-3 h-3" />
                <span>Apos gerar relatorio</span>
              </span>
            )}
          </div>
        </button>

        {/* Card 3: Resultados e Diagnóstico */}
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



      {/* Modal de Vídeo */}
      {showVideoModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-fade-in cursor-pointer overflow-y-auto" 
          id="video-modal-overlay"
          onClick={() => setShowVideoModal(false)}
        >
          <div 
            className="bg-white rounded-3xl shadow-2xl border border-slate-200/80 animate-slide-up flex flex-col w-full max-w-[340px] sm:max-w-[400px] md:max-w-[680px] overflow-hidden" 
            id="video-modal"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header bar - Light Theme matching main portal */}
            <div className="bg-white px-5 py-4 flex items-center justify-between border-b border-slate-100 shrink-0">
              <div className="flex items-center space-x-3">
                {/* Play button indicator circle */}
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-500 to-rose-600 flex items-center justify-center shadow-md shrink-0">
                  <Play className="w-3.5 h-3.5 text-white fill-current translate-x-0.5" />
                </div>
                <div className="text-left">
                  <h4 className="text-xs md:text-sm font-black text-[#112363] uppercase tracking-wider italic">
                    Como funciona a Pesquisa?
                  </h4>
                  <p className="text-[9px] md:text-xxs text-slate-500 font-bold uppercase tracking-widest">
                    Tutorial em Vídeo
                  </p>
                </div>
              </div>

              {/* Clean light close button */}
              <button
                onClick={() => setShowVideoModal(false)}
                className="p-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-all duration-200 cursor-pointer shadow-sm focus:outline-none ring-2 ring-slate-100"
                aria-label="Fechar janela"
                id="btn-close-video-modal"
              >
                <X className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>

            {/* Modal Body - Video Area */}
            <div className="p-4 md:p-6 bg-slate-50/50 flex flex-col items-center justify-center">
              {/* Responsive video container - Tall 9:16 on mobile (increased height), standard widescreen on tablet/desktop */}
              <div className="w-full max-w-[280px] aspect-[9/16] md:max-w-full md:aspect-video bg-black rounded-2xl overflow-hidden shadow-xl border border-slate-200 relative shrink-0 transition-all duration-300">
                <iframe
                  src="https://www.youtube.com/embed/zOWMdp39_h4?autoplay=1"
                  title="Apresentação da Pesquisa de Socioestilo"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  className="w-full h-full"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Safe company notice */}
      <div className="mt-12 text-center text-xxs text-gray-400" id="menu-footer-notes">
        Metodologia de perfis comportamentais Potenciar. Seus dados estão protegidos sob protocolos corporativos.
      </div>
    </div>
  );
}
