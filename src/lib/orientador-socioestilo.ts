import { Resultado, Scores, Usuario } from '../types';
import { listarOrientadorRelatoriosUsuario, listarResultadosUsuario } from './supabase';

export type OrientadorChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
};

export type ReportSummary = {
  id: string;
  nomeParticipante: string;
  empresa: string;
  dataGeracao: string;
  perfilDominante: string;
  perfilSecundario: string;
  perfilMenosUtilizado: string;
  scores: Scores;
};


const DEFAULT_SCORES: Scores = {
  Assertivo: 0,
  Participativo: 0,
  Integrador: 0,
  Analitico: 0
};

function normalizeProfileName(value?: string | null) {
  if (!value) return 'Nao identificado';
  return value === 'Analitico' ? 'Analitico' : value;
}

function toTimestamp(result: Resultado) {
  const rawDate = result.generated_at || result.data_conclusao || '';
  const time = rawDate ? new Date(rawDate).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
}

export async function listarRelatoriosGeradosUsuario(uid: string): Promise<Resultado[]> {
  const [relatorios, relatoriosIndexados] = await Promise.all([
    listarResultadosUsuario(uid).catch(() => []),
    listarOrientadorRelatoriosUsuario(uid).catch(() => [])
  ]);

  const merged = Array.from(
    new Map(
      [...relatorios, ...relatoriosIndexados].map(relatorio => [
        relatorio.id_resultado || relatorio.id || `${relatorio.id_usuario}-${relatorio.data_conclusao}`,
        relatorio
      ])
    ).values()
  );

  return merged
    .filter(relatorio => Boolean(relatorio.id || relatorio.id_resultado))
    .sort((a, b) => toTimestamp(b) - toTimestamp(a));
}

export function getReportId(relatorio: Resultado) {
  return String(relatorio.id_resultado || relatorio.id || '');
}

export function getReportSummary(relatorio: Resultado, usuario: Usuario): ReportSummary {
  const scores = { ...DEFAULT_SCORES, ...(relatorio.scores || {}) };

  return {
    id: getReportId(relatorio),
    nomeParticipante: relatorio.nome_usuario || relatorio.user_name || usuario.nome,
    empresa: relatorio.empresa_nome || relatorio.company_name || usuario.empresa_nome,
    dataGeracao: relatorio.generated_at || relatorio.data_conclusao || '',
    perfilDominante: normalizeProfileName(relatorio.perfil_dominante),
    perfilSecundario: normalizeProfileName(relatorio.perfil_secundario),
    perfilMenosUtilizado: normalizeProfileName(relatorio.perfil_menos_utilizado),
    scores
  };
}

export async function enviarMensagemOrientador(_params: {
  usuario: Usuario;
  relatorio: Resultado;
  conversaId: string | null;
  mensagem: string;
}): Promise<{ resposta: string; conversaId: string | null; fontes: any[] }> {
  throw new Error('Orientador SocioEstilo desativado. A integracao com o chatbot n8n foi removida.');
}