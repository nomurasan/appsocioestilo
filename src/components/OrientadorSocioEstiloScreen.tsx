import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Bot, ChevronRight, Lock, MessageSquare, RefreshCw, Send, User } from 'lucide-react';
import { Resultado, Scores, Usuario } from '../types';
import {
  OrientadorChatMessage,
  enviarMensagemOrientador,
  getReportId,
  getReportSummary,
  listarRelatoriosGeradosUsuario
} from '../lib/orientador-socioestilo';

interface OrientadorSocioEstiloScreenProps {
  usuario: Usuario;
  initialResult?: Resultado | null;
  onGoBack: () => void;
  onStartQuestionnaire: () => void;
}

const SUGGESTED_QUESTIONS = [
  'O que meu estilo predominante significa?',
  'Quais sao meus principais pontos fortes?',
  'Quais pontos de atencao devo observar?',
  'Como posso usar meu relatorio no trabalho?',
  'Como posso desenvolver meu PDI?',
  'Como posso me comunicar melhor com outros estilos?',
  'Quais acoes praticas posso aplicar nos proximos 30 dias?'
];

function formatDate(value: string) {
  if (!value) return 'Data nao informada';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Data nao informada';
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

function scoreEntries(scores: Scores) {
  return [
    ['Assertivo', scores.Assertivo || 0],
    ['Participativo', scores.Participativo || 0],
    ['Integrador', scores.Integrador || 0],
    ['Analitico', scores.Analitico || 0]
  ] as Array<[string, number]>;
}

export default function OrientadorSocioEstiloScreen({
  usuario,
  initialResult,
  onGoBack,
  onStartQuestionnaire
}: OrientadorSocioEstiloScreenProps) {
  const [relatorios, setRelatorios] = useState<Resultado[]>(initialResult ? [initialResult] : []);
  const [relatorioSelecionado, setRelatorioSelecionado] = useState<Resultado | null>(initialResult || null);
  const [conversaId, setConversaId] = useState<string | null>(null);
  const [mensagens, setMensagens] = useState<OrientadorChatMessage[]>([]);
  const [mensagemAtual, setMensagemAtual] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [erro, setErro] = useState('');
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;

    async function loadReports() {
      setLoading(true);
      setErro('');

      try {
        const data = await listarRelatoriosGeradosUsuario(usuario.uid);
        if (!active) return;

        const merged = data.length > 0 ? data : (initialResult ? [initialResult] : []);
        setRelatorios(merged);
        setRelatorioSelecionado(current => {
          if (current && merged.some(item => getReportId(item) === getReportId(current))) {
            return current;
          }
          return merged[0] || null;
        });
      } catch (err) {
        console.error('Erro ao buscar relatorios do Orientador:', err);
        if (!active) return;

        if (initialResult) {
          setRelatorios([initialResult]);
          setRelatorioSelecionado(initialResult);
        } else {
          setErro('Nao foi possivel verificar seus relatorios agora. Tente novamente em instantes.');
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadReports();

    return () => {
      active = false;
    };
  }, [usuario.uid, initialResult]);

  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTo({ top: feedRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [mensagens, sending]);

  const summary = useMemo(() => {
    return relatorioSelecionado ? getReportSummary(relatorioSelecionado, usuario) : null;
  }, [relatorioSelecionado, usuario]);

  const enviarMensagem = async (texto: string) => {
    const mensagem = texto.trim();
    if (!mensagem || !relatorioSelecionado || sending) return;

    const userMessage: OrientadorChatMessage = {
      role: 'user',
      content: mensagem,
      createdAt: new Date().toISOString()
    };

    setMensagens(prev => [...prev, userMessage]);
    setMensagemAtual('');
    setSending(true);
    setErro('');

    try {
      const response = await enviarMensagemOrientador({
        usuario,
        relatorio: relatorioSelecionado,
        conversaId,
        mensagem
      });

      setConversaId(response.conversaId);
      setMensagens(prev => [
        ...prev,
        {
          role: 'assistant',
          content: response.resposta,
          createdAt: new Date().toISOString()
        }
      ]);
    } catch (err) {
      console.error('Erro ao enviar mensagem ao Orientador:', err);
      setErro('Nao foi possivel obter resposta do Orientador SocioEstilo neste momento. Tente novamente em instantes.');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full max-w-5xl mx-auto bg-white border border-gray-100 rounded-2xl shadow-sm p-10 flex flex-col items-center gap-3">
        <RefreshCw className="w-7 h-7 text-[#112363] animate-spin" />
        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Verificando relatorios gerados...</p>
      </div>
    );
  }

  if (!relatorioSelecionado) {
    return (
      <div className="w-full max-w-3xl mx-auto bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-8 md:p-10 text-center space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 text-gray-500 flex items-center justify-center mx-auto">
            <Lock className="w-7 h-7" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-[#112363]">Orientador SocioEstilo ainda nao disponivel</h2>
            <p className="text-sm text-gray-500 leading-relaxed max-w-xl mx-auto">
              Para conversar com o Orientador SocioEstilo, primeiro e necessario concluir o questionario e gerar seu relatorio.
              Apos a geracao do relatorio, esta area sera liberada automaticamente.
            </p>
          </div>
          {erro && (
            <div className="bg-red-50 border border-red-100 text-[#D80E2A] text-xs font-semibold rounded-xl px-4 py-3 flex items-center justify-center gap-2">
              <AlertCircle className="w-4 h-4" />
              <span>{erro}</span>
            </div>
          )}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={onStartQuestionnaire}
              className="bg-[#112363] text-white text-xs font-black px-5 py-3 rounded-xl hover:bg-[#112363]/90 transition-all"
            >
              Responder questionario
            </button>
            <button
              onClick={onGoBack}
              className="bg-white border border-gray-200 text-[#112363] text-xs font-black px-5 py-3 rounded-xl hover:border-[#112363] transition-all"
            >
              Voltar para inicio
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-5 animate-fade-in">
      <aside className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden h-fit">
        <div className="p-5 border-b border-gray-100 bg-gray-50">
          <p className="text-xxs font-black text-[#D80E2A] uppercase tracking-widest">Orientador SocioEstilo</p>
          <h1 className="text-xl font-black text-[#112363] mt-1">Contexto do relatorio</h1>
        </div>

        <div className="p-5 space-y-5">
          {relatorios.length > 1 && (
            <label className="block space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Selecionar relatorio</span>
              <select
                value={getReportId(relatorioSelecionado)}
                onChange={(event) => {
                  const selected = relatorios.find(item => getReportId(item) === event.target.value) || relatorios[0];
                  setRelatorioSelecionado(selected);
                  setConversaId(null);
                  setMensagens([]);
                }}
                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-3 text-xs font-bold text-[#112363] focus:outline-none focus:ring-2 focus:ring-[#112363]/15"
              >
                {relatorios.map(relatorio => {
                  const itemSummary = getReportSummary(relatorio, usuario);
                  return (
                    <option key={itemSummary.id} value={itemSummary.id}>
                      {formatDate(itemSummary.dataGeracao)} - {itemSummary.perfilDominante}
                    </option>
                  );
                })}
              </select>
            </label>
          )}

          {summary && (
            <div className="space-y-4">
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Participante</p>
                <p className="text-sm font-black text-[#112363]">{summary.nomeParticipante}</p>
                <p className="text-xs text-gray-500">{summary.empresa}</p>
                <p className="text-[10px] text-gray-400 font-bold">Gerado em {formatDate(summary.dataGeracao)}</p>
              </div>

              <div className="grid grid-cols-1 gap-2">
                <div className="p-3 rounded-xl bg-[#112363]/5 border border-[#112363]/10">
                  <span className="text-[10px] uppercase tracking-widest text-[#112363]/60 font-black">Perfil dominante</span>
                  <strong className="block text-sm text-[#112363] mt-1">{summary.perfilDominante}</strong>
                </div>
                <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                  <span className="text-[10px] uppercase tracking-widest text-gray-400 font-black">Perfil secundario</span>
                  <strong className="block text-sm text-gray-800 mt-1">{summary.perfilSecundario}</strong>
                </div>
                <div className="p-3 rounded-xl bg-red-50 border border-red-100">
                  <span className="text-[10px] uppercase tracking-widest text-[#D80E2A]/60 font-black">Estilo a desenvolver</span>
                  <strong className="block text-sm text-[#D80E2A] mt-1">{summary.perfilMenosUtilizado}</strong>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Scores principais</p>
                {scoreEntries(summary.scores).map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between text-xs">
                    <span className="font-bold text-gray-600">{label}</span>
                    <span className="font-black text-[#112363]">{value} pts</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </aside>

      <section className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden min-h-[680px] flex flex-col">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-[#112363] flex items-center gap-2">
              <Bot className="w-5 h-5 text-[#D80E2A]" />
              Orientador SocioEstilo
            </h2>
            <p className="text-xs text-gray-500 mt-1">Tire duvidas sobre seu relatorio e transforme insights em acoes praticas.</p>
          </div>
          <button
            onClick={onGoBack}
            className="hidden sm:flex items-center gap-1.5 bg-white border border-gray-200 text-[#112363] text-xs font-black px-4 py-2.5 rounded-xl hover:border-[#112363] transition-all"
          >
            <span>Inicio</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 border-b border-gray-100 space-y-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Sugestoes de perguntas</p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_QUESTIONS.map(question => (
              <button
                key={question}
                onClick={() => enviarMensagem(question)}
                disabled={sending}
                className="bg-gray-50 border border-gray-150 text-[#112363] text-xs font-bold px-3 py-2 rounded-xl hover:border-[#112363] hover:bg-[#112363]/5 disabled:opacity-50 transition-all"
              >
                {question}
              </button>
            ))}
          </div>
        </div>

        <div ref={feedRef} className="flex-1 overflow-y-auto p-5 space-y-4 bg-gray-50/50">
          {mensagens.length === 0 && (
            <div className="h-full min-h-[220px] flex flex-col items-center justify-center text-center gap-3 text-gray-400">
              <MessageSquare className="w-9 h-9" />
              <p className="text-sm font-bold text-[#112363]">Escolha uma sugestao ou escreva sua pergunta.</p>
              <p className="text-xs max-w-md">O Orientador usara o relatorio selecionado como contexto pelo identificador seguro do resultado.</p>
            </div>
          )}

          {mensagens.map((message, index) => {
            const isUser = message.role === 'user';
            return (
              <div key={`${message.createdAt}-${index}`} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex items-start gap-3 max-w-[88%] ${isUser ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isUser ? 'bg-[#D80E2A]' : 'bg-[#112363]'}`}>
                    {isUser ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-white" />}
                  </div>
                  <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-2xs ${
                    isUser
                      ? 'bg-[#112363] text-white rounded-tr-none'
                      : 'bg-white border border-gray-100 text-gray-800 rounded-tl-none'
                  }`}>
                    {message.content}
                  </div>
                </div>
              </div>
            );
          })}

          {sending && (
            <div className="flex justify-start">
              <div className="flex items-center gap-3 bg-white border border-gray-100 rounded-2xl rounded-tl-none px-4 py-3 shadow-2xs">
                <Bot className="w-4 h-4 text-[#112363]" />
                <span className="text-xs font-bold text-gray-500">Orientador esta respondendo...</span>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-100 bg-white space-y-3">
          {erro && (
            <div className="bg-red-50 border border-red-100 text-[#D80E2A] text-xs font-semibold rounded-xl px-4 py-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{erro}</span>
            </div>
          )}

          <form
            className="flex items-end gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              enviarMensagem(mensagemAtual);
            }}
          >
            <textarea
              value={mensagemAtual}
              onChange={(event) => setMensagemAtual(event.target.value)}
              placeholder="Digite sua pergunta sobre o relatorio..."
              rows={2}
              className="flex-1 resize-none bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#112363]/15 focus:border-[#112363]/30"
            />
            <button
              type="submit"
              disabled={sending || !mensagemAtual.trim()}
              className="h-[46px] w-[46px] rounded-xl bg-[#112363] text-white flex items-center justify-center hover:bg-[#112363]/90 disabled:opacity-40 transition-all"
              title="Enviar mensagem"
            >
              {sending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
