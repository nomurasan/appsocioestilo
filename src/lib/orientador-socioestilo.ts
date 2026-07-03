import { Resultado, Scores, Usuario } from '../types';
import { listarResultadosUsuario } from './supabase';

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

type N8nOrientadorResponse = {
  success?: boolean;
  resposta?: string;
  answer?: string;
  message?: string;
  conversa_id?: string | null;
  fontes?: any[];
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
  const relatorios = await listarResultadosUsuario(uid);

  return relatorios
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

export async function enviarMensagemOrientador(params: {
  usuario: Usuario;
  relatorio: Resultado;
  conversaId: string | null;
  mensagem: string;
}): Promise<{ resposta: string; conversaId: string | null; fontes: any[] }> {
  const env = (import.meta as any).env || {};
  const webhookUrl = env.VITE_N8N_CHATBOT_WEBHOOK_URL;

  if (!webhookUrl) {
    throw new Error('Webhook do Orientador SocioEstilo nao configurado.');
  }

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify({
      usuario_id: params.usuario.uid,
      empresa_id: Number.isNaN(Number(params.usuario.empresa_id))
        ? params.usuario.empresa_id
        : Number(params.usuario.empresa_id),
      resultado_id: getReportId(params.relatorio),
      conversa_id: params.conversaId,
      mensagem: params.mensagem
    })
  });

  if (!response.ok) {
    throw new Error(`Falha no webhook do Orientador SocioEstilo: ${response.status}`);
  }

  const payload: N8nOrientadorResponse = await response.json();
  const resposta = payload.resposta || payload.answer || payload.message || '';

  if (!resposta) {
    throw new Error('Resposta vazia do Orientador SocioEstilo.');
  }

  return {
    resposta,
    conversaId: payload.conversa_id || params.conversaId,
    fontes: Array.isArray(payload.fontes) ? payload.fontes : []
  };
}
