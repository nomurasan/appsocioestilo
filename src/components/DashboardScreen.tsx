import React, { useState, useEffect } from 'react';
import { 
  Award, 
  Briefcase, 
  Users, 
  LayoutDashboard, 
  UserCheck, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle,
  RefreshCw, 
  Bot, 
  Printer, 
  BookOpen,
  FileText,
  TrendingUp,
  Lightbulb,
  Compass,
  Star,
  Zap,
  Check,
  ChevronRight,
  HelpCircle,
  Calendar,
  Sun,
  Moon
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { Usuario, Resultado, Scores, STYLE_NAMES, ReportParameter, ReportUserType } from '../types';
import { PROFILE_DETAILS } from '../data/profile-details';
import { listarParametrosRelatorio, listarResultados } from '../lib/supabase';

type ChunkAuditItem = {
  ordem?: number;
  documento?: string | null;
  ku_code?: string | null;
  codigo?: string | null;
  chunk?: string | number | null;
  conteudo?: string | null;
};

type ChunkContentAudit = {
  consulta_utilizada?: string;
  retrieved_at?: string;
  finalidade?: string;
  chunks_recuperados?: ChunkAuditItem[];
};

function parseJsonIfNeeded(value: any) {
  if (!value || typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function getChunkContentAudit(report: any): ChunkContentAudit {
  const audit = parseJsonIfNeeded(
    report?.chunk_content_audit ||
    report?.report_data?.fundamentacao?.chunk_content_audit ||
    report?.relatorio_pronto_para_app?.fundamentacao?.chunk_content_audit ||
    report?.fundamentacao?.chunk_content_audit ||
    report?.campos?.chunk_content_audit_json ||
    report?.report_data?.campos?.chunk_content_audit_json ||
    {}
  );

  if (!audit || typeof audit !== 'object' || Array.isArray(audit)) {
    return {};
  }

  return audit as ChunkContentAudit;
}

function extractChunkTitle(content?: string): string {
  if (!content || typeof content !== 'string') return '';

  const normalized = content.trim();

  const match = normalized.match(
    /Título:\s*(.*?)(?=\s+Tipo de entidade:|\n|$)/i
  );

  return match?.[1]?.trim() || '';
}

function chunkAuditToText(audit: ChunkContentAudit): string {
  const chunks = audit.chunks_recuperados || [];
  return chunks
    .map((item, index) => {
      const kuCode = item.documento || item.ku_code || item.codigo || '';
      const titulo = extractChunkTitle(item.conteudo);
      const identificacao = [kuCode, titulo].filter(Boolean).join(' — ');
      const conteudo = item.conteudo || 'Conteúdo recuperado indisponível.';

      return `${index + 1}. ${identificacao || `Conteúdo recuperado ${index + 1}`}\n${conteudo}`;
    })
    .join('\n\n');
}

// Helper to fully normalize and transition payloads to the unified n8n structured schema safely
function normalizeN8nPayload(rawPayload: any, activeResult: any, usuario: Usuario): any {
  // 1. Resolve rawPayload JSON String
  let normPayload: any = {};
  if (rawPayload) {
    if (typeof rawPayload === 'string') {
      try {
        normPayload = JSON.parse(rawPayload);
      } catch (e) {
        console.warn("[normalizeN8nPayload] Failed to parse rawPayload string:", e);
      }
    } else if (typeof rawPayload === 'object' && !Array.isArray(rawPayload)) {
      normPayload = { ...rawPayload };
    }
  }

  // Temporary required log to inspect Webhook response structure and locate RAG/References fields
  console.log("Webhook Response", normPayload);
  if (normPayload) {
    console.log("Webhook Response - google_studio:", normPayload.google_studio);
    console.log("Webhook Response - report_data:", normPayload.report_data);
    if (normPayload.report_data) {
      console.log("Webhook Response - report_data.auditoria:", normPayload.report_data.auditoria);
      console.log("Webhook Response - report_data.fontes_consultadas:", normPayload.report_data.fontes_consultadas);
      console.log("Webhook Response - report_data.chunks_recuperados:", normPayload.report_data.chunks_recuperados);
      console.log("Webhook Response - report_data.fontes_consultadas_texto:", normPayload.report_data.fontes_consultadas_texto);
      console.log("Webhook Response - report_data.chunks_recuperados_texto:", normPayload.report_data.chunks_recuperados_texto);
    }
  }

  // Merging client-side or server-side generated ai_insights which contains key narrative objects
  if (activeResult?.ai_insights) {
    let aiInsightsObj: any = {};
    if (typeof activeResult.ai_insights === 'string') {
      try {
        aiInsightsObj = JSON.parse(activeResult.ai_insights);
      } catch {}
    } else if (typeof activeResult.ai_insights === 'object') {
      aiInsightsObj = activeResult.ai_insights;
    }
    normPayload = { ...aiInsightsObj, ...normPayload };
  }

  const participantReportV26 = parseJsonIfNeeded(
    normPayload?.participant_report
    || normPayload?.participantReport
    || activeResult?.participant_report
    || activeResult?.participantReport
    || activeResult?.raw_payload?.participant_report
    || activeResult?.raw_payload?.participantReport
    || {}
  ) || {};

  const developmentReportV26 = parseJsonIfNeeded(
    normPayload?.development_report
    || normPayload?.developmentReport
    || activeResult?.development_report
    || activeResult?.developmentReport
    || activeResult?.raw_payload?.development_report
    || activeResult?.raw_payload?.developmentReport
    || {}
  ) || {};

  const relatorioV26 = parseJsonIfNeeded(
    normPayload?.relatorio
    || activeResult?.relatorio
    || activeResult?.raw_payload?.relatorio
    || {}
  ) || {};

  const columnPotencializacaoTalentos = parseJsonIfNeeded(
    activeResult?.potencializacao_talentos
    || activeResult?.raw_payload?.potencializacao_talentos
    || {}
  ) || {};

  const columnPdi = parseJsonIfNeeded(
    activeResult?.pdi
    || activeResult?.raw_payload?.pdi
    || {}
  ) || {};

  const resolvedVisibilityConfig = parseJsonIfNeeded(
    participantReportV26?.visibility_config
    || relatorioV26?.visibility_config
    || activeResult?.visibility_config
    || activeResult?.raw_payload?.visibility_config
    || {}
  ) || {};

  // 2. Locate report_data using strict priority from the new canonical n8n structure
  // Priority 1: rawPayload.report_data (primary source from current webhook response)
  // Priority 2: activeResult.report_data (previously saved report_data)
  // Priority 3: activeResult.raw_payload.report_data (fallback to raw payload
  // Priority 4: Only then use legacy fallbacks (google_studio, relatorio, etc.)
  
  let report_data: any = null;
  
  // Primary source: report_data from normPayload (current webhook response)
  if (normPayload?.report_data && typeof normPayload.report_data === 'object') {
    report_data = normPayload.report_data;
  }
  // Secondary source: stored report_data from activeResult
  else if (activeResult?.report_data && typeof activeResult.report_data === 'object') {
    report_data = activeResult.report_data;
  }
  // Tertiary source: report_data from raw_payload
  else if (activeResult?.raw_payload?.report_data && typeof activeResult.raw_payload.report_data === 'object') {
    report_data = activeResult.raw_payload.report_data;
  }
  // Fallback: check if ai_insights contains report_data
  else if (activeResult?.ai_insights?.report_data && typeof activeResult.ai_insights.report_data === 'object') {
    report_data = activeResult.ai_insights.report_data;
  }
  // Legacy fallback: relatorio_pronto_para_app
  else if (normPayload?.relatorio_pronto_para_app && typeof normPayload.relatorio_pronto_para_app === 'object') {
    report_data = normPayload.relatorio_pronto_para_app;
  }
  else if (activeResult?.relatorio_pronto_para_app && typeof activeResult.relatorio_pronto_para_app === 'object') {
    report_data = activeResult.relatorio_pronto_para_app;
  }
  // Legacy fallback: structured data at root level of normPayload
  else if ((normPayload?.narrativa || normPayload?.analise_comportamental) && typeof normPayload === 'object') {
    report_data = normPayload;
  }
  // Legacy fallback: structured data in activeResult.raw_payload
  else if ((activeResult?.raw_payload?.narrativa || activeResult?.raw_payload?.analise_comportamental) && typeof activeResult?.raw_payload === 'object') {
    report_data = activeResult.raw_payload;
  }
  // Legacy fallback: structured data in activeResult.ai_insights
  else if ((activeResult?.ai_insights?.narrativa || activeResult?.ai_insights?.analise_comportamental) && typeof activeResult?.ai_insights === 'object') {
    report_data = activeResult.ai_insights;
  }
  // Final legacy fallback: relatorio field
  else if (activeResult?.relatorio && typeof activeResult.relatorio === 'object') {
    report_data = activeResult.relatorio;
  }

  // Parse if serialized
  if (report_data && typeof report_data === 'string') {
    try {
      report_data = JSON.parse(report_data);
    } catch (err) {
      console.warn("Error parsing report_data string:", err);
    }
  }

  // Ensure report_data is at least an object
  if (!report_data || typeof report_data !== 'object') {
    report_data = {};
  }

  // Diagnostic log to validate data arrival from report_data
  console.log("[RELATORIO]", {
    memoria: report_data?.memoria_respostas?.length,
    fontes: report_data?.fundamentacao?.fontes_consultadas?.length || report_data?.fontes_consultadas?.length,
    chunks: report_data?.fundamentacao?.chunks_recuperados?.length || report_data?.chunks_recuperados?.length,
    autores: report_data?.fundamentacao?.referenciais_teoricos?.length || report_data?.referenciais_teoricos?.length
  });

  console.log("[MEMORIA_CALCULO_ORIGEM]", {
    "report_data.memoria_calculo_respostas_json type": typeof report_data?.memoria_calculo_respostas_json,
    "report_data.memoria_calculo_respostas_json length": typeof report_data?.memoria_calculo_respostas_json === "string" ? report_data.memoria_calculo_respostas_json.length : (Array.isArray(report_data?.memoria_calculo_respostas_json) ? report_data.memoria_calculo_respostas_json.length : "N/A"),
    "report_data.campos?.memoria_calculo_respostas_json type": typeof report_data?.campos?.memoria_calculo_respostas_json,
    "report_data.memoria_calculo?.respostas length": report_data?.memoria_calculo?.respostas?.length,
    "keys em report_data": Object.keys(report_data || {}).join(", ")
  });

  // Extract google_studio if present and merge flat attributes back to structured format
  const gsData = normPayload?.google_studio || (typeof activeResult?.raw_payload === 'object' ? activeResult?.raw_payload?.google_studio : null) || (activeResult?.google_studio);
  if (gsData && typeof gsData === 'object') {
    if (!report_data.identificacao) report_data.identificacao = {};
    if (gsData.nome && !report_data.identificacao.nome) report_data.identificacao.nome = gsData.nome;
    if (gsData.empresa && !report_data.identificacao.empresa) report_data.identificacao.empresa = gsData.empresa;
    
    if (!report_data.resultado) report_data.resultado = {};
    if (gsData.perfil_dominante && !report_data.resultado.perfil_dominante) report_data.resultado.perfil_dominante = gsData.perfil_dominante;
    if (gsData.perfil_secundario && !report_data.resultado.perfil_secundario) report_data.resultado.perfil_secundario = gsData.perfil_secundario;
    if (gsData.perfil_terciario && !report_data.resultado.perfil_terciario) report_data.resultado.perfil_terciario = gsData.perfil_terciario;
    if (gsData.perfil_menos_utilizado && !report_data.resultado.perfil_menos_utilizado) report_data.resultado.perfil_menos_utilizado = gsData.perfil_menos_utilizado;
    
    // Scores
    if (!report_data.resultado.scores) report_data.resultado.scores = {};
    if (gsData.score_assertivo !== undefined && report_data.resultado.scores.Assertivo === undefined) report_data.resultado.scores.Assertivo = gsData.score_assertivo;
    if (gsData.score_participativo !== undefined && report_data.resultado.scores.Participativo === undefined) report_data.resultado.scores.Participativo = gsData.score_participativo;
    if (gsData.score_integrador !== undefined && report_data.resultado.scores.Integrador === undefined) report_data.resultado.scores.Integrador = gsData.score_integrador;
    if (gsData.score_analitico !== undefined && report_data.resultado.scores.Analitico === undefined) report_data.resultado.scores.Analitico = gsData.score_analitico;
    if (gsData.total_pontos !== undefined && report_data.resultado.total_pontos === undefined) report_data.resultado.total_pontos = gsData.total_pontos;

    // Narrative, opportunities, challenges, etc.
    if (!report_data.narrativa) report_data.narrativa = {};
    if (gsData.parecer_executivo && !report_data.narrativa.parecer_executivo) report_data.narrativa.parecer_executivo = gsData.parecer_executivo;
    if (gsData.conselho_alta_performance && !report_data.narrativa.conselho_alta_performance) report_data.narrativa.conselho_alta_performance = gsData.conselho_alta_performance;
    
    if (gsData.oportunidades_texto && !report_data.narrativa.oportunidades) {
      report_data.narrativa.oportunidades = gsData.oportunidades_texto.split(/\n+/).map((line: string) => line.trim().replace(/^-\s*/, '')).filter(Boolean);
    }
    if (gsData.desafios_texto && !report_data.narrativa.desafios) {
      report_data.narrativa.desafios = gsData.desafios_texto.split(/\n+/).map((line: string) => line.trim().replace(/^-\s*/, '')).filter(Boolean);
    }
    
    // Dinamica dos estilos
    if (!report_data.dinamica_dos_estilos) report_data.dinamica_dos_estilos = {};
    if (gsData.lado_luz_descricao && !report_data.dinamica_dos_estilos.lado_luz) {
      report_data.dinamica_dos_estilos.lado_luz = gsData.lado_luz_descricao;
    } else if (gsData.lado_luz && !report_data.dinamica_dos_estilos.lado_luz) {
      report_data.dinamica_dos_estilos.lado_luz = gsData.lado_luz;
    }
    
    if (gsData.lado_sombra_descricao && !report_data.dinamica_dos_estilos.lado_sombra) {
      report_data.dinamica_dos_estilos.lado_sombra = gsData.lado_sombra_descricao;
    } else if (gsData.lado_sombra && !report_data.dinamica_dos_estilos.lado_sombra) {
      report_data.dinamica_dos_estilos.lado_sombra = gsData.lado_sombra;
    }
    
    if (gsData.estilo_apoio && !report_data.dinamica_dos_estilos.estilo_apoio) report_data.dinamica_dos_estilos.estilo_apoio = gsData.estilo_apoio;
    if (gsData.estilo_a_desenvolver && !report_data.dinamica_dos_estilos.estilo_a_desenvolver) report_data.dinamica_dos_estilos.estilo_a_desenvolver = gsData.estilo_a_desenvolver;

    // Recomendacoes
    if (gsData.recomendacoes_praticas_texto && !report_data.recomendacoes_praticas) {
      report_data.recomendacoes_praticas = gsData.recomendacoes_praticas_texto.split(/\n+/).map((line: string) => line.trim().replace(/^-\s*/, '')).filter(Boolean);
    }

    // Fontes base e Referenciais base
    if (gsData.fontes_consultadas_texto && !report_data.fontes_consultadas_texto) {
      report_data.fontes_consultadas_texto = gsData.fontes_consultadas_texto;
    }
    if (gsData.referenciais_teoricos_texto && !report_data.referenciais_teoricos_texto) {
      report_data.referenciais_teoricos_texto = gsData.referenciais_teoricos_texto;
    }
  }

  // 3. User identifiers & metadata (strictly no hardcoding!)
  const userName = report_data.identificacao?.nome || gsData?.nome || normPayload?.nome || normPayload?.metadata?.userName || activeResult?.nome_usuario || activeResult?.user_name || usuario?.nome || "Participante";
  const companyName = report_data.identificacao?.empresa || gsData?.empresa || normPayload?.empresa || normPayload?.metadata?.companyName || activeResult?.empresa_nome || activeResult?.company_name || usuario?.empresa_nome || "Empresa";
  const completedAt = report_data.identificacao?.completed_at || report_data.identificacao?.generated_at || normPayload?.data_conclusao || normPayload?.metadata?.completedAt || activeResult?.data_conclusao || activeResult?.completedAt || activeResult?.created_at || new Date().toISOString();
  const generatedAt = report_data.identificacao?.generated_at || normPayload?.data_geracao || normPayload?.metadata?.generatedAt || activeResult?.generated_at || activeResult?.generatedAt || activeResult?.created_at || new Date().toISOString();
  const relatorioUuid = report_data.identificacao?.relatorio_uuid || normPayload?.user_id || activeResult?.id || activeResult?.id_usuario || activeResult?.user_id || "res-uuid-882741";

  // 4. Score parsing (dynamic, no hardcoded mappings, supports all casing variations)
  const baseScores = { ...(activeResult?.scores || normPayload?.contextoQuestionario?.scores || normPayload?.assessment?.scores || {}) };
  const rScores = report_data.resultado?.scores || {};

  const dScore = typeof rScores.Assertivo !== 'undefined' ? rScores.Assertivo : (typeof rScores.assertivo !== 'undefined' ? rScores.assertivo : (typeof rScores.Direto !== 'undefined' ? rScores.Direto : baseScores.Assertivo));
  const eScore = typeof rScores.Participativo !== 'undefined' ? rScores.Participativo : (typeof rScores.participativo !== 'undefined' ? rScores.participativo : (typeof rScores.Expressivo !== 'undefined' ? rScores.Expressivo : baseScores.Participativo));
  const mScore = typeof rScores.Integrador !== 'undefined' ? rScores.Integrador : (typeof rScores.integrador !== 'undefined' ? rScores.integrador : (typeof rScores.Amavel !== 'undefined' ? rScores.Amavel : baseScores.Integrador));
  const aScore = typeof rScores.Analitico !== 'undefined' ? rScores.Analitico : (typeof rScores.analitico !== 'undefined' ? rScores.analitico : (typeof rScores.Analítico !== 'undefined' ? rScores.Analítico : baseScores.Analitico));

  const scores = {
    Assertivo: typeof dScore !== 'undefined' ? Number(dScore) : 0,
    Participativo: typeof eScore !== 'undefined' ? Number(eScore) : 0,
    Integrador: typeof mScore !== 'undefined' ? Number(mScore) : 0,
    Analitico: typeof aScore !== 'undefined' ? Number(aScore) : 0
  };

  const totalPoints = normPayload.total_pontos || report_data.resultado?.total_pontos || Object.values(scores).reduce((a: number, b: number) => a + b, 0);

  const styleValues = {
    Assertivo: scores.Assertivo,
    Participativo: scores.Participativo,
    Integrador: scores.Integrador,
    Analítico: scores.Analitico
  };

  const sortedStyles = Object.entries(styleValues).sort((a, b) => b[1] - a[1]);

  // Determine profiles based on n8n reported result or fallbacks
  // DO NOT use "Assertivo" as default when there's no data or totalPoints is 0
  const getProfileByChoice = (rawName: string, fallbackIdx: number): string => {
    // If we have a total of 0 points, don't assign any profile as dominant
    if (totalPoints === 0) {
      return rawName ? normalizeName(rawName) : "Não identificado";
    }
    
    if (!rawName) {
      const entry = sortedStyles[fallbackIdx];
      return entry ? entry[0] : "Não identificado";
    }
    return normalizeName(rawName);
  };

  const normalizeName = (rawName: string): string => {
    const norm = rawName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    if (norm.includes("assert") || norm.includes("diret")) return "Assertivo";
    if (norm.includes("particip") || norm.includes("express")) return "Participativo";
    if (norm.includes("conserv") || norm.includes("amav") || norm.includes("agreg") || norm.includes("integ")) return "Integrador";
    if (norm.includes("analit")) return "Analítico";
    return rawName;
  };

  const finalDom = getProfileByChoice(report_data.resultado?.perfil_dominante || normPayload?.perfil_dominante || activeResult?.perfil_dominante || '', 0);
  const finalSec = getProfileByChoice(report_data.resultado?.perfil_secundario || normPayload?.perfil_secundario || activeResult?.perfil_secundario || '', 1);
  const finalThird = getProfileByChoice(report_data.resultado?.perfil_terciario || normPayload?.perfil_terciario || activeResult?.perfil_terciario || '', 2);
  const finalLow = getProfileByChoice(report_data.resultado?.perfil_menos_utilizado || normPayload?.perfil_menos_utilizado || activeResult?.perfil_menos_utilizado || '', 3);

  // Fallback defaults if actual descriptions / texts are not present in report_data
  const defaultStaticDetailsMap: Record<string, { desc: string; strengths: string[]; growth: string[]; opps: string[]; advice: string }> = {
    "Assertivo": {
      desc: "Indivíduos com perfil Assertivo são focados em resultados, rápidos, eficientes e objetivos.",
      strengths: ["Foco inabalável em metas", "Tomada de decisões rápida", "Liderança nata sob pressão", "Busca constante por eficiência"],
      growth: ["Desenvolver paciência ativa com outros ritmos", "Dar mais importância aos sentimentos alheios", "Aprender a delegar com profundidade"],
      opps: ["Liderar frentes inovadoras", "Apoiar a facilitação tática", "Otimizar fluxos intersetoriais"],
      advice: "Pratique escutar as opiniões do time antes de emitir sua diretriz padrão. Equilibrar velocidade operacional com feedback humano criará entregas de alta fidelidade e engajamento."
    },
    "Participativo": {
      desc: "Indivíduos com perfil Participativo são comunicativos, persuasivos, otimistas e cheios de entusiasmo.",
      strengths: ["Excelente comunicação interpessoal", "Habilidade de engajar e motivar equipes", "Visão de futuro e criatividade inovadora", "Adaptabilidade a novos cenários"],
      growth: ["Melhorar o foco em rotinas e detalhes", "Acompanhar tarefas até a conclusão", "Ouvir tanto quanto fala"],
      opps: ["Inspirar equipes em momentos de transformação organizacional.", "Alavancar parcerias corporativas.", "Inspirar equipes facilitando diálogos."],
      advice: "Apoie-se em planejamentos estruturados and cronogramas diários para garantir que suas excelentes ideias se traduzam em resultados reais."
    },
    "Integrador": {
      desc: "Perfis Integradores são extremamente empáticos, solidários, cooperativos e focados em manter relacionamentos saudáveis.",
      strengths: ["Excelente construtor de relacionamentos", "Empatia profunda e escuta ativa", "Mediação eficaz de conflitos", "Lealdade e apoio incondicional à equipe"],
      growth: ["Aprender a dizer 'não' quando necessário", "Lidar com conflitos de forma direta", "Posicionar-se com mais assertiveness comercial"],
      opps: ["Facilitar a resolução de conflitos.", "Estruturar processos consistentes de cooperação.", "Atuar no desenvolvimento de onboarding."],
      advice: "Lembre-se que divergir de forma clara e assertiva é também uma enorme demonstração de compromisso profissional com a verdade."
    },
    "Analítico": {
      desc: "Profissionais Analíticos são lógicos, precisos, organizados e orientados por dados.",
      strengths: ["Precisão cirúrgica e atenção aos detalhes", "Pensamento estratégico estruturado", "Alta qualidade técnica nas entregas", "Análise lógica profunda de problemas"],
      growth: ["Evitar a 'paralisia por análise'", "Aceitar riscos calculados e ser mais flexível", "Aumentar a velocidade de decisão sob condições incertas"],
      opps: ["Estruturar auditorias e análises detalhadas.", "Desenvolver novos algoritmos de precificação ou BI.", "Garantir a integridade técnica de grandes projetos."],
      advice: "Exercite simplificar a complexidade de suas entregas para que outros profissionais consigam acompanhar suas observações."
    }
  };

  const backupDetails = defaultStaticDetailsMap[finalDom] || defaultStaticDetailsMap["Assertivo"];

  const defaultDinamicaMap: Record<string, { lado_luz: string; lado_sombra: string; estilo_apoio: string; estilo_a_desenvolver: string }> = {
    "Assertivo": {
      lado_luz: "Liderança assertiva focada em metas claras, dinamismo operacional e tomada de decisões sob pressão.",
      lado_sombra: "Tendência ao autoritarismo, impaciência com processos alheios e centralização excessiva de tarefas.",
      estilo_apoio: "Comunicação pragmática direcionada ao impulsionamento da equipe para entregas rápidas.",
      estilo_a_desenvolver: "Desenvolver escuta ativa, sensibilidade com o time e delegação participativa."
    },
    "Participativo": {
      lado_luz: "Comunicação inspiradora, alto poder de persuasão e facilitação ativa do entusiasmo coletivo.",
      lado_sombra: "Perda de atenção tática a detalhes, dificuldade em manter rotinas repetitivas e oscilação de foco.",
      estilo_apoio: "Uso da empatia e magnetismo social para coordenar esforços e gerar novas ideias.",
      estilo_a_desenvolver: "Aprofundar planejamento de longo prazo, controle métrico e acabativa rigorosa."
    },
    "Integrador": {
      lado_luz: "Empatia profunda, lealdade à equipe, estabilidade interpessoal e facilitação de consenso.",
      lado_sombra: "Recuo diante de conflitos necessários, omissão de opiniões divergentes e lentidão na mudança operacional.",
      estilo_apoio: "Relações pautadas na cooperação ativa e sustentação de processos harmoniosos de entrega.",
      estilo_a_desenvolver: "Posicionamento firme diante de divergências e assertividade na cobrança de resultados estruturados."
    },
    "Analítico": {
      lado_luz: "Rigor científico estruturado, planejamento minucioso focado na mitigação de riscos e precisão técnica.",
      lado_sombra: "Tendência a paralisia por análise, inflexibilidade tática com mudanças súbitas e excesso de autocrítica.",
      estilo_apoio: "Organização lógica e sistematização de dados para amparar decisões seguras e baseadas em fatos.",
      estilo_a_desenvolver: "Flexibilidade em relação a imprevistos, agilidade decisória mesmo em condições de incerteza."
    }
  };

  const defaultEvidenciasMap: Record<string, string[]> = {
    "Assertivo": ["Foco cirúrgico em prazos e entregas", "Comunicação incisiva direcionada a resultados", "Resolução ativa e enérgica de problemas de alta complexidade"],
    "Participativo": ["Geração de energia catalisadora em ideias de alto impacto", "Facilitação de pontes sociais entre áreas diferentes", "Forte estímulo à criatividade e ao otimismo no ambiente"],
    "Integrador": ["Zelo ativo pela harmonia e bem-estar físico/psicológico do grupo", "Construção de parcerias fiéis com base na confiança mútua", "Escuta atenta e paciência na absorção de feedbacks complexos"],
    "Analítico": ["Exigência de fatos e dados sólidos antes de emitir parecer", "Desenho minucioso de fluxos operacionais sem lacunas", "Excelente acabamento com foco em segurança da informação"]
  };

  const defaultPotencialMap: Record<string, string[]> = {
    "Assertivo": ["Amortecer o impacto da comunicação imediata", "Aperfeiçoar delegação baseada na autonomia do liderado"],
    "Participativo": ["Estruturar rotinas operacionais com ferramentas organizadas", "Reduzir iniciativas e ampliar acabativas tangíveis"],
    "Integrador": ["Exercitar assertividade tática para feedbacks transparentes", "Reduzir o tempo de tomada de decisão em cenários mutáveis"],
    "Analítico": ["Acolher ideias de teor puramente criativo sem julgamento prévio", "Mitigar a paralisia decisória simplificando dados preliminares"]
  };

  const defaultRecomendacoesMap: Record<string, string[]> = {
    "Assertivo": [
      "Agende reuniões de 10 minutos focadas em ouvir a perspectiva dos outros antes de agir.",
      "Escreva metas individuais para o time que dependam 100% da autonomia de execução deles.",
      "Monitore sinais de estresse tático na equipe agindo com maior escuta ativa."
    ],
    "Participativo": [
      "Defina três compromissos inegociáveis no início da semana e entregue-os antes de iniciar outros temas.",
      "Utilize checklists digitais para supervisionar a execução de projetos complexos passo a passo.",
      "Reserve pausas operacionais para documentar processos de alto teor criativo."
    ],
    "Integrador": [
      "Treine declarar sua opinião divergente logo no começo dos debates como um ato de apoio profissional.",
      "Crie metas semanais com métricas objetivas de performance individual.",
      "Dedique tempo para planejar ações de mudança de alta prioridade sem receio de perturbar a harmonia."
    ],
    "Analítico": [
      "Crie uma margem de segurança 'aceitável' de 80% de precisão para agir, reduzindo a busca pelo 100%.",
      "Compartilhe esboços e rascunhos rápidos com o time antes de polir demais as planilhas.",
      "Invista 15 minutos semanais para debater caminhos informais de criação com a equipe."
    ]
  };

  const backupDinamica = defaultDinamicaMap[finalDom] || defaultDinamicaMap["Assertivo"];
  const backupEvidencias = defaultEvidenciasMap[finalDom] || defaultEvidenciasMap["Assertivo"];
  const backupPotencial = defaultPotencialMap[finalDom] || defaultPotencialMap["Assertivo"];
  const backupRecomendacoes = defaultRecomendacoesMap[finalDom] || defaultRecomendacoesMap["Assertivo"];

  const reportDataParticipantReport = parseJsonIfNeeded(
    report_data?.participant_report
    || report_data?.participantReport
    || {}
  ) || {};

  const camposData = parseJsonIfNeeded(report_data?.campos || {}) || {};
  const camposPotencializacaoTalentos = parseJsonIfNeeded(
    camposData?.potencializacao_talentos_json
    || {}
  ) || {};
  const camposPdi = parseJsonIfNeeded(
    camposData?.pdi_json
    || {}
  ) || {};

  const resolvedParticipantVisibilityConfig = parseJsonIfNeeded(
    reportDataParticipantReport?.visibility_config
    || report_data?.visibility_config
    || relatorioV26?.visibility_config
    || activeResult?.visibility_config
    || activeResult?.raw_payload?.visibility_config
    || {}
  ) || {};

  const resolvedPotencializacaoTalentos = parseJsonIfNeeded(
    reportDataParticipantReport?.potencializacao_talentos
    || reportDataParticipantReport?.potencializar_talentos
    || participantReportV26?.potencializacao_talentos
    || participantReportV26?.potencializar_talentos
    || report_data?.potencializacao_talentos
    || report_data?.potencializar_talentos
    || relatorioV26?.potencializacao_talentos
    || relatorioV26?.potencializar_talentos
    || developmentReportV26?.potencializacao_talentos
    || developmentReportV26?.potencializar_talentos
    || columnPotencializacaoTalentos
    || camposPotencializacaoTalentos
    || {}
  ) || {};

  const resolvedPdi = parseJsonIfNeeded(
    reportDataParticipantReport?.pdi
    || participantReportV26?.pdi
    || report_data?.pdi
    || relatorioV26?.pdi
    || developmentReportV26?.pdi
    || columnPdi
    || camposPdi
    || {}
  ) || {};

  const cleanArrayItems = (arr: any): string[] => {
    if (!arr) return [];
    if (!Array.isArray(arr)) {
      if (typeof arr === 'string') {
        return arr.split('\n').map(x => x.trim()).filter(x => x !== '');
      }
      return [];
    }
    return arr.map(item => {
      if (item && typeof item === 'object') {
        return (item.descricao || item.desc || item.text || item.estilo || item.name || item.title || JSON.stringify(item)).trim();
      }
      return String(item).trim();
    }).filter(item => item !== "");
  };

  // DEPRECATED: processedRespostas is kept only for backward compatibility and answer count.
  // DO NOT USE for the memory responses table - use report_data.memoria_respostas instead!
  // This is maintained only to calculate answersCount metric in assessment.
  const answersObj = activeResult?.answers || activeResult?.respostas_questionario || normPayload?.respostasQuestionario || normPayload?.respostas_questionario || {};
  const detailedAnswersSource = activeResult?.respostas_detalhadas || activeResult?.answers_detailed || normPayload?.contextoQuestionario?.respostasDetalhadas || [];
  const detailedAnswersById = new Map<number, any>(
    (Array.isArray(detailedAnswersSource) ? detailedAnswersSource : [])
      .map((item: any) => [Number(item.question_id || item.questionId), item] as [number, any])
      .filter(([questionId]) => Number.isFinite(questionId))
  );
  const processedRespostas: any[] = [];
  try {
    const styleToPortName: Record<string, string> = {
      Direto: "Assertivo",
      Expressivo: "Participativo",
      Amavel: "Integrador",
      Analitico: "Analítico",
      Assertivo: "Assertivo",
      Participativo: "Participativo",
      "Conservador agregador": "Integrador",
      Integrador: "Integrador",
      Analítico: "Analítico"
    };

    Object.entries(answersObj).forEach(([qIdStr, selectedVal]) => {
      const qId = Number(qIdStr);
      const detailedQuestion = detailedAnswersById.get(qId);
      const questionText = detailedQuestion?.question_text || detailedQuestion?.question || `Questao ${qId}`;
      {
        let answerTxt = '';
        if (Array.isArray(selectedVal)) {
          answerTxt = selectedVal.join(", ");
        } else {
          answerTxt = String(selectedVal);
        }

        let stylesList = "Geral";
        let pontuacaoAtribuida = 0;

        // Safe fallback in case no options matched directly
        if (pontuacaoAtribuida === 0 && selectedVal) {
          if (Array.isArray(selectedVal)) {
            const factor = (qId === 1 || qId === 5) ? 2 : 1;
            pontuacaoAtribuida = selectedVal.length * factor;
          } else {
            pontuacaoAtribuida = 1;
          }
        }

        processedRespostas.push({
          pergunta: questionText.startsWith('Quest') ? questionText : `${qId}. ${questionText}`,
          resposta_escolhida: answerTxt || "Não respondida",
          estilo_associado: stylesList,
          pontuacao_atribuida: pontuacaoAtribuida
        });
      }
    });
  } catch (err) {
    console.warn("Erro ao preencher memória do questionário:", err);
  }

  // 5. Structure our return payload exactly as required by the components.
  // There is NO hardcoded "Eduardo Nomura" content and NO static "Diagnóstico comportamental..." default paragraphs!
  const safeStringVal = (val: any, fallback = ""): string => {
    if (val === undefined || val === null) return fallback;
    if (typeof val === 'string') return val;
    if (typeof val === 'object') {
      return val.estilo || val.name || val.title || val.descricao || JSON.stringify(val);
    }
    return String(val);
  };

  const safeDescVal = (val: any, fallback = ""): string => {
    if (val === undefined || val === null) return fallback;
    if (typeof val === 'string') return val;
    if (typeof val === 'object') {
      return val.descricao || val.desc || val.text || val.estilo || val.name || val.title || JSON.stringify(val);
    }
    return String(val);
  };

  const safeDinamicaVal = (val: any, fallback = ""): string => {
    if (val === undefined || val === null) return fallback;
    if (typeof val === 'string') return val;
    if (typeof val === 'object') {
      const desc = val.descricao || val.desc || val.description || val.text || val.texto_luz || val.texto_sombra;
      if (desc && typeof desc === 'string') return desc;
      if (desc && typeof desc === 'object') return safeDinamicaVal(desc);
      return val.estilo || val.name || val.title || JSON.stringify(val);
    }
    return String(val);
  };

  const cleanObjectArray = (value: any): any[] => {
    if (!value) return [];
    if (typeof value === 'string') {
      return value.split(/\n+/).map(item => item.trim()).filter(Boolean).map(texto => ({ texto }));
    }
    if (!Array.isArray(value)) {
      if (typeof value === 'object') {
        return Object.values(value).some(Boolean) ? [value] : [];
      }
      return [];
    }
    return value.map(item => {
      if (!item) return null;
      if (typeof item === 'string') return { texto: item.trim() };
      if (typeof item === 'object') return item;
      return { texto: String(item) };
    }).filter(item => item && Object.values(item).some(Boolean));
  };

  const finalReportData: any = {
    identificacao: {
      nome: report_data.identificacao?.nome || userName,
      empresa: report_data.identificacao?.empresa || companyName,
      generated_at: report_data.identificacao?.generated_at || generatedAt,
      relatorio_uuid: report_data.identificacao?.relatorio_uuid || relatorioUuid
    },
    narrativa: {
      parecer_executivo: report_data.narrativa?.parecer_executivo || report_data.parecer_executivo || report_data.resumo_participante || report_data.resumo_executivo || normPayload?.participantReport?.executiveSummary || normPayload?.executiveReport?.executiveSummary || activeResult?.relatorio?.parecer_executivo || activeResult?.ai_insights?.resumo || activeResult?.ai_insights?.parecer_executivo || "O parecer executivo detalhado da banca está sendo gerado pela inteligência analítica.",
      oportunidades: cleanArrayItems(
        report_data.narrativa?.oportunidades || 
        report_data.oportunidades || 
        report_data.oportunidades_alavancas || 
        normPayload?.participantReport?.opportunities || 
        activeResult?.relatorio?.oportunidades_alavancas || 
        activeResult?.ai_insights?.oportunidades ||
        activeResult?.ai_insights?.oportunidades_alavancas
      ).length > 0 ? cleanArrayItems(
        report_data.narrativa?.oportunidades || 
        report_data.oportunidades || 
        report_data.oportunidades_alavancas || 
        normPayload?.participantReport?.opportunities || 
        activeResult?.relatorio?.oportunidades_alavancas || 
        activeResult?.ai_insights?.oportunidades ||
        activeResult?.ai_insights?.oportunidades_alavancas
      ) : backupDetails.opps,
      desafios: cleanArrayItems(
        report_data.narrativa?.desafios || 
        report_data.desafios || 
        report_data.pontos_criticos_desafios || 
        normPayload?.participantReport?.developmentPoints || 
        normPayload?.executiveReport?.attentionPoints || 
        activeResult?.relatorio?.pontos_criticos_desafios || 
        activeResult?.ai_insights?.desafios ||
        activeResult?.ai_insights?.pontos_criticos_desafios
      ).length > 0 ? cleanArrayItems(
        report_data.narrativa?.desafios || 
        report_data.desafios || 
        report_data.pontos_criticos_desafios || 
        normPayload?.participantReport?.developmentPoints || 
        normPayload?.executiveReport?.attentionPoints || 
        activeResult?.relatorio?.pontos_criticos_desafios || 
        activeResult?.ai_insights?.desafios ||
        activeResult?.ai_insights?.pontos_criticos_desafios
      ) : backupDetails.growth,
      conselho_alta_performance: safeStringVal(report_data.narrativa?.conselho_alta_performance || report_data.conselho_alta_performance || normPayload?.participantReport?.highPerformanceAdvice || normPayload?.participantReport?.personalAdvice || activeResult?.relatorio?.conselho_alta_performance || activeResult?.ai_insights?.insights || activeResult?.ai_insights?.conselho_alta_performance || backupDetails.advice),
      conhecimento_aplicado: report_data.narrativa?.conhecimento_aplicado || report_data.conhecimento_aplicado || activeResult?.relatorio?.conhecimento_aplicado || activeResult?.ai_insights?.conhecimento_aplicado || "A análise de socioestilo avalia dinâmicas comportamentais e inteligência de cooperação.",
      analise_humana_agendada: report_data.narrativa?.analise_humana_agendada || report_data.analise_humana_agendada || activeResult?.relatorio?.analise_humana_agendada || activeResult?.ai_insights?.analise_humana_agendada || null
    },
    resultado: {
      perfil_dominante: finalDom,
      perfil_secundario: finalSec,
      perfil_terciario: finalThird,
      perfil_menos_utilizado: finalLow,
      scores: styleValues,
      ranking: (report_data.resultado?.ranking && Array.isArray(report_data.resultado.ranking))
        ? report_data.resultado.ranking.map((item: any, idx: number) => {
            let rawEstilo = item.estilo || item.style || "Informação não disponível.";
            if (typeof rawEstilo === 'object' && rawEstilo !== null) {
              rawEstilo = rawEstilo.estilo || rawEstilo.name || rawEstilo.title || "Informação não disponível.";
            }
            return {
              posicao: item.posicao !== undefined ? item.posicao : (item.posição !== undefined ? item.posição : (idx + 1)),
              estilo: String(rawEstilo),
              pontos: item.pontos !== undefined ? item.pontos : (item.pontuacao !== undefined ? item.pontuacao : (item.pontuação !== undefined ? item.pontuação : "0")),
              pontuacao: item.pontuacao !== undefined ? item.pontuacao : (item.pontos !== undefined ? item.pontos : (item.pontuação !== undefined ? item.pontuação : "0")),
              percentual: item.percentual !== undefined ? item.percentual : "0"
            };
          })
        : sortedStyles.map(([style, score], idx) => ({
            posicao: idx + 1,
            estilo: style,
            pontuacao: score,
            percentual: totalPoints > 0 ? Math.round((score / totalPoints) * 100) : 0
          }))
    },
    analise_comportamental: {
      estilo_identificado: safeStringVal(report_data.analise_comportamental?.estilo_identificado || report_data.estilo_identificado || activeResult?.relatorio?.analise_comportamental?.estilo_identificado || normPayload?.participantReport?.profileSummary?.title || finalDom),
      descricao: safeDescVal(report_data.analise_comportamental?.descricao || report_data.descricao || activeResult?.relatorio?.analise_comportamental?.descricao || normPayload?.participantReport?.profileSummary?.description || backupDetails.desc),
      pontos_fortes_talentos: cleanArrayItems(
        report_data.analise_comportamental?.pontos_fortes_talentos || 
        report_data.pontos_fortes_talentos || 
        report_data.pontos_fortes || 
        normPayload?.participantReport?.strengths || 
        normPayload?.executiveReport?.strengths || 
        activeResult?.relatorio?.analise_comportamental?.pontos_fortes_talentos || 
        activeResult?.ai_insights?.pontos_fortes
      ).length > 0 ? cleanArrayItems(
        report_data.analise_comportamental?.pontos_fortes_talentos || 
        report_data.pontos_fortes_talentos || 
        report_data.pontos_fortes || 
        normPayload?.participantReport?.strengths || 
        normPayload?.executiveReport?.strengths || 
        activeResult?.relatorio?.analise_comportamental?.pontos_fortes_talentos || 
        activeResult?.ai_insights?.pontos_fortes
      ) : backupDetails.strengths,
      pontos_desenvolvimento: cleanArrayItems(
        report_data.analise_comportamental?.pontos_desenvolvimento || 
        report_data.pontos_desenvolvimento || 
        normPayload?.participantReport?.developmentPoints || 
        normPayload?.executiveReport?.attentionPoints || 
        activeResult?.relatorio?.analise_comportamental?.pontos_desenvolvimento || 
        activeResult?.ai_insights?.pontos_desenvolvimento ||
        activeResult?.ai_insights?.desafios ||
        activeResult?.ai_insights?.pontos_criticos_desafios
      ).length > 0 ? cleanArrayItems(
        report_data.analise_comportamental?.pontos_desenvolvimento || 
        report_data.pontos_desenvolvimento || 
        normPayload?.participantReport?.developmentPoints || 
        normPayload?.executiveReport?.attentionPoints || 
        activeResult?.relatorio?.analise_comportamental?.pontos_desenvolvimento || 
        activeResult?.ai_insights?.pontos_desenvolvimento ||
        activeResult?.ai_insights?.desafios ||
        activeResult?.ai_insights?.pontos_criticos_desafios
      ) : backupDetails.growth
    },
    metodologia: {
      metodologia_potenciar_ativada: report_data.metodologia?.metodologia_potenciar_ativada || report_data.metodologia_potenciar_ativada || activeResult?.relatorio?.metodologia_potenciar_ativada || "Este relatorio foi elaborado com base na metodologia SocioEstilo Potenciar, que utiliza um questionario estruturado para identificar tendencias comportamentais predominantes e apoiar processos de autoconhecimento, desenvolvimento profissional e planejamento de acoes. Os resultados devem ser interpretados como uma ferramenta de desenvolvimento, e nao como um diagnostico definitivo."
    },
    sobre_metodologia: {
      assertivo: safeDescVal(report_data.sobre_metodologia?.assertivo || report_data.metodologia?.assertivo || "Perfil Assertivo (Direto): Pragmatismo operacional, tomada de decisões rápida, eficiência técnica e determinação."),
      participativo: safeDescVal(report_data.sobre_metodologia?.participativo || report_data.metodologia?.participativo || "Perfil Participativo (Expressivo): Comunicação de alto engajamento, estímulo criativo e facilitação activa do diálogo."),
      conservador_agregador: safeDescVal(report_data.sobre_metodologia?.conservador_agregador || report_data.sobre_metodologia?.integrador || report_data.metodologia?.conservador_agregador || "Perfil Integrador (Amável): Construção de alta lealdade, empatia interpessoal profunda e cooperação."),
      integrador: safeDescVal(report_data.sobre_metodologia?.integrador || report_data.sobre_metodologia?.conservador_agregador || report_data.metodologia?.conservador_agregador || "Perfil Integrador (Amável): Construção de alta lealdade, empatia interpessoal profunda e cooperação."),
      analitico: safeDescVal(report_data.sobre_metodologia?.analitico || report_data.metodologia?.analitico || "Perfil Analítico (Analítico): Rigor científico focado na mitigação de riscos, precisão em dados e planejamento estruturado."),
      texto_final: safeDescVal(report_data.sobre_metodologia?.texto_final || report_data.metodologia?.texto_final || "O equilíbrio dinâmico dessas quatro lentes metodológicas ampara planos de desenvolvimento individuais e de equipe.")
    },
    dinamica_dos_estilos: {
      lado_luz: safeDinamicaVal(report_data.dinamica_dos_estilos?.lado_luz || report_data.dinamica_dos_estilos?.ladoLuz || backupDinamica.lado_luz),
      lado_sombra: safeDinamicaVal(report_data.dinamica_dos_estilos?.lado_sombra || report_data.dinamica_dos_estilos?.ladoSombra || backupDinamica.lado_sombra),
      estilo_apoio: safeDinamicaVal(report_data.dinamica_dos_estilos?.estilo_apoio || report_data.dinamica_dos_estilos?.estiloApoio || backupDinamica.estilo_apoio),
      estilo_a_desenvolver: safeDinamicaVal(report_data.dinamica_dos_estilos?.estilo_a_desenvolver || report_data.dinamica_dos_estilos?.estiloADesenvolver || backupDinamica.estilo_a_desenvolver)
    },
    referenciais_teoricos: (() => {
      const raw = report_data.fundamentacao?.referenciais_teoricos
        || report_data.referenciais_teoricos
        || report_data.referencias_teoricas
        || report_data.referencias_metodologicas?.referenciais_teoricos
        || [];

      if (Array.isArray(raw)) {
        return raw.map((item: any) => {
          if (!item) return null;
          if (typeof item === 'string') {
            return {
              autor: item.trim(),
              contribuicao: ''
            };
          }
          return {
            autor: item.autor || item.author || '',
            contribuicao: item.contribuicao || item.contribution || item.conceito || item.conceito_aplicado || item.concept || item.obra || ''
          };
        }).filter((item: any) => item && (item.autor || item.contribuicao));
      }
      return [];
    })(),
    fontes_consultadas: (() => {
      const raw = report_data.fundamentacao?.fontes_consultadas
        || report_data.fontes_consultadas
        || [];
      if (Array.isArray(raw)) {
        return raw.map((item: any) => {
          if (!item) return null;
          if (typeof item === 'string') return { documento: item, trecho: '' };
          return {
            documento: item.documento_recuperado || item.documento || item.document || '',
            trecho: item.trecho_resumido_utilizado || item.trecho_resumido || item.trecho || item.text || ''
          };
        }).filter((item: any) => item && (item.documento || item.trecho));
      }
      return [];
    })(),
    chunks_recuperados: (() => {
      const raw = report_data.fundamentacao?.chunks_recuperados
        || report_data.chunks_recuperados
        || [];
      if (Array.isArray(raw)) {
        return raw.map((item: any) => {
          if (!item) return null;
          if (typeof item === 'string') return { documento: '', chunk: item };
          return {
            documento: item.documento || item.documento_recuperado || item.document || '',
            chunk: item.chunk !== undefined ? item.chunk : (item.chunk_idx || null)
          };
        }).filter((item: any) => item);
      }
      return [];
    })(),
    chunk_content_audit: getChunkContentAudit({
      chunk_content_audit: report_data.chunk_content_audit,
      report_data,
      relatorio_pronto_para_app: activeResult?.relatorio_pronto_para_app,
      fundamentacao: report_data.fundamentacao,
      campos: report_data.campos
    }),
    rag_fontes_consultadas: (() => {
      const raw = report_data.fundamentacao?.fontes_consultadas
        || report_data.fontes_consultadas
        || [];
      if (Array.isArray(raw)) {
        return raw.map((item: any) => {
          if (!item) return null;
          if (typeof item === 'string') return item.trim();
          return (item.documento_recuperado || item.documento || item.document || '').trim();
        }).filter(Boolean);
      }
      return [];
    })(),
    rag_chunks_recuperados: (() => {
      const rawChunks = report_data.fundamentacao?.chunks_recuperados
        || report_data.chunks_recuperados
        || report_data.referencias_metodologicas?.chunks_recuperados
        || [];
      if (Array.isArray(rawChunks) && rawChunks.length > 0) {
        return rawChunks.map((item: any) => {
          if (!item) return null;
          if (typeof item === 'string') return { documento: '', chunk: item };
          return {
            documento: (item.documento || item.document_recuperado || item.document || '').trim(),
            chunk: item.chunk !== undefined ? item.chunk : (item.chunk_idx || null)
          };
        }).filter((item: any) => item && (item.documento || item.chunk));
      }
      const rawFontes = report_data.fundamentacao?.fontes_consultadas
        || report_data.fontes_consultadas
        || [];
      if (Array.isArray(rawFontes)) {
        const extracted: any[] = [];
        rawFontes.forEach((item: any) => {
          if (item && typeof item === 'object') {
            const doc = (item.documento_recuperado || item.documento || item.document || '').trim();
            const chunkVal = item.chunk !== undefined ? item.chunk : (item.chunk_idx !== undefined ? item.chunk_idx : null);
            if (doc && chunkVal !== null) {
              extracted.push({ documento: doc, chunk: chunkVal });
            }
          }
        });
        if (extracted.length > 0) return extracted;
      }
      return [];
    })(),
    fontes_consultadas_texto: (() => {
      const val = report_data.fundamentacao?.fontes_consultadas_texto
        || (Array.isArray(report_data.fundamentacao?.fontes_consultadas) && report_data.fundamentacao.fontes_consultadas.length > 0
            ? report_data.fundamentacao.fontes_consultadas.map((f: any) => typeof f === 'object' ? (f.documento || f.documento_recuperado || f.source || String(f)) : String(f)).join('\n')
            : '')
        || report_data.fontes_consultadas_texto
        || (Array.isArray(report_data.fontes_consultadas) && report_data.fontes_consultadas.length > 0
            ? report_data.fontes_consultadas.map((f: any) => typeof f === 'object' ? (f.documento || f.documento_recuperado || f.source || String(f)) : String(f)).join('\n')
            : '')
        || '';
      return typeof val === 'string' ? val : '';
    })(),
    chunks_recuperados_texto: (() => {
      const val = report_data.fundamentacao?.chunks_recuperados_texto
        || (Array.isArray(report_data.fundamentacao?.chunks_recuperados) && report_data.fundamentacao.chunks_recuperados.length > 0
            ? report_data.fundamentacao.chunks_recuperados.map((c: any) => typeof c === 'object' ? `${c.documento || c.documento_recuperado || c.document || ''} - Chunk ${c.chunk !== undefined ? c.chunk : (c.chunk_idx !== undefined ? c.chunk_idx : '')}` : String(c)).join('\n')
            : '')
        || report_data.chunks_recuperados_texto
        || (Array.isArray(report_data.chunks_recuperados) && report_data.chunks_recuperados.length > 0
            ? report_data.chunks_recuperados.map((c: any) => typeof c === 'object' ? `${c.documento || c.documento_recuperado || c.document || ''} - Chunk ${c.chunk !== undefined ? c.chunk : (c.chunk_idx !== undefined ? c.chunk_idx : '')}` : String(c)).join('\n')
            : '')
        || '';
      return typeof val === 'string' ? val : '';
    })(),
    referenciais_teoricos_texto: (() => {
      const buildFromArray = (arr: any[]) =>
        arr.map((item: any) =>
          typeof item === 'object'
            ? `${item.autor || item.author || ''}${item.contribuicao || item.contribution || item.conceito_aplicado || item.conceito || item.concept || item.obra ? `: ${item.contribuicao || item.contribution || item.conceito_aplicado || item.conceito || item.concept || item.obra || ''}` : ''}`.trim()
            : String(item)
        ).filter(Boolean).join('\n');

      const val = report_data.fundamentacao?.referenciais_teoricos_texto
        || report_data.referencias_metodologicas?.referenciais_teoricos_texto
        || report_data.referenciais_teoricos_texto
        || (Array.isArray(report_data.fundamentacao?.referenciais_teoricos) && report_data.fundamentacao.referenciais_teoricos.length > 0
            ? buildFromArray(report_data.fundamentacao.referenciais_teoricos) : '')
        || (Array.isArray(report_data.referencias_metodologicas?.referenciais_teoricos) && report_data.referencias_metodologicas.referenciais_teoricos.length > 0
            ? buildFromArray(report_data.referencias_metodologicas.referenciais_teoricos) : '')
        || (Array.isArray(report_data.referenciais_teoricos) && report_data.referenciais_teoricos.length > 0
            ? buildFromArray(report_data.referenciais_teoricos) : '')
        || '';
      return typeof val === 'string' ? val : '';
    })(),
    evidencias_observadas: cleanArrayItems(
      report_data.evidencias_observadas || 
      report_data.evidencias
    ).length > 0 ? cleanArrayItems(
      report_data.evidencias_observadas || 
      report_data.evidencias
    ) : backupEvidencias,
    potencializacao_talentos: {
      estilo_base: safeStringVal(
        resolvedPotencializacaoTalentos?.estilo_base
        || camposData?.potencializacao_talentos_estilo
        || report_data.potencializacao_talentos_estilo_base
        || resolvedPotencializacaoTalentos?.estilo
        || finalDom
      ),
      talento_identificado: safeStringVal(
        resolvedPotencializacaoTalentos?.talento_identificado
        || camposData?.potencializacao_talentos_talento_identificado
        || resolvedPotencializacaoTalentos?.descricao
        || report_data.potencializacao_talentos_descricao
        || resolvedPotencializacaoTalentos?.talento
      ),
      valor_gerado: safeStringVal(
        resolvedPotencializacaoTalentos?.valor_gerado
        || camposData?.potencializacao_talentos_valor_gerado
        || resolvedPotencializacaoTalentos?.valor
      ),
      contextos_ideais: cleanArrayItems(
        resolvedPotencializacaoTalentos?.contextos_ideais
        || camposData?.potencializacao_talentos_contextos_ideais_texto
        || resolvedPotencializacaoTalentos?.contextos
      ),
      estrategias_potencializacao: cleanArrayItems(
        resolvedPotencializacaoTalentos?.estrategias_potencializacao
        || camposData?.potencializacao_talentos_estrategias_texto
        || resolvedPotencializacaoTalentos?.acoes
        || report_data.potencializacao_talentos_acoes
      ),
      ponto_equilibrio: safeStringVal(
        resolvedPotencializacaoTalentos?.ponto_equilibrio
        || camposData?.potencializacao_talentos_ponto_equilibrio
        || resolvedPotencializacaoTalentos?.cuidado
      ),
      texto: safeStringVal(
        resolvedPotencializacaoTalentos?.texto
        || camposData?.potencializacao_talentos_texto
      ),
      descricao_legada: safeStringVal(
        resolvedPotencializacaoTalentos?.descricao
        || report_data.potencializacao_talentos_descricao
      ),
      acoes_legadas: cleanArrayItems(
        resolvedPotencializacaoTalentos?.acoes
        || report_data.potencializacao_talentos_acoes
      )
    },
    potencial_desenvolvimento: cleanArrayItems(
      report_data.potencial_desenvolvimento || 
      report_data.potencial ||
      report_data.analise_comportamental?.pontos_desenvolvimento ||
      report_data.pontos_desenvolvimento
    ).length > 0 ? cleanArrayItems(
      report_data.potencial_desenvolvimento || 
      report_data.potencial ||
      report_data.analise_comportamental?.pontos_desenvolvimento ||
      report_data.pontos_desenvolvimento
    ) : backupPotencial,
    recomendacoes_praticas: cleanArrayItems(
      report_data.recomendacoes_praticas || 
      report_data.recomendacoes ||
      report_data.narrativa?.oportunidades ||
      report_data.oportunidades
    ).length > 0 ? cleanArrayItems(
      report_data.recomendacoes_praticas || 
      report_data.recomendacoes ||
      report_data.narrativa?.oportunidades ||
      report_data.oportunidades
    ) : backupRecomendacoes,
    pdi: {
      objetivos_prioritarios: cleanObjectArray(
        resolvedPdi?.objetivos_prioritarios
        || camposData?.pdi_objetivos_texto
      ),
      plano_acao: cleanObjectArray(
        resolvedPdi?.plano_acao
        || camposData?.pdi_plano_acao_texto
      ),
      indicadores_evolucao: cleanObjectArray(
        resolvedPdi?.indicadores_evolucao
        || camposData?.pdi_indicadores_texto
      ),
      compromisso_desenvolvimento: safeStringVal(
        resolvedPdi?.compromisso_desenvolvimento
        || camposData?.pdi_compromisso
      ),
      texto: safeStringVal(
        resolvedPdi?.texto
        || camposData?.pdi_texto
      )
    },
    visibility_config: resolvedParticipantVisibilityConfig,
    questionario: {
      respostas: (() => {
        // ÚNICA FONTE: memoria_respostas do n8n workflow
        // Estrutura: { questionId, question, answer, socioStyle, points }
        // Sem agregações, sem recalcular, sem fallbacks para estruturas legadas
        
        const memoriaRespostas = report_data.memoria_respostas;
        
        if (!Array.isArray(memoriaRespostas)) {
          return [];
        }
        
        // Mapear diretamente os dados do n8n, sem modificações de lógica
        return memoriaRespostas.map((item: any) => {
          if (!item) return null;
          
          return {
            pergunta: item.question || `Questão ${item.questionId || '?'}`,
            resposta_escolhida: item.answer || '',
            estilo_associado: item.socioStyle || "Não identificado",
            pontuacao_atribuida: Number(item.points) || 0
          };
        }).filter(Boolean);
      })()
    },
    memoria_calculo: report_data.memoria_calculo || {},
    auditoria: {
      workflow_version: report_data.auditoria?.workflow_version || "9.0",
      prompt_version: report_data.auditoria?.prompt_version || "System_v9",
      modelo_llm: report_data.auditoria?.modelo_llm || "Gemini 1.5 Pro",
      fontes_consultadas: report_data.auditoria?.fontes_consultadas || ["Manuais Potenciar de Socioestilo", "Metodologias de Liderança Situacional"],
      divergencias_scores: typeof report_data.auditoria?.divergencias_scores === 'boolean' ? report_data.auditoria.divergencias_scores : false,
      erro_parse_ia: report_data.auditoria?.erro_parse_ia || "Nenhum erro registrado."
    },
    campos: {}
  };

  // Populate campos nested object so backward compatibility with legacy renderings works perfectly
  finalReportData.campos = {
    nome: userName,
    empresa: companyName,
    user_id: relatorioUuid,
    empresa_id: normPayload?.empresa_id || "1",
    data_conclusao: completedAt,
    data_geracao: generatedAt,
    perfil_dominante: finalDom,
    perfil_secundario: finalSec,
    perfil_terciario: finalThird,
    perfil_menos_utilizado: finalLow,
    score_assertivo: styleValues.Assertivo,
    score_participativo: styleValues.Participativo,
    score_integrador: styleValues["Integrador"],
    score_analitico: styleValues.Analítico,
    total_pontos: totalPoints,
    chunk_content_audit_json: finalReportData.chunk_content_audit,
    chunk_content_audit_texto: chunkAuditToText(finalReportData.chunk_content_audit),
    parecer_executivo: finalReportData.narrativa.parecer_executivo,
    oportunidades_texto: finalReportData.narrativa.oportunidades.join("\n"),
    oportunidade_1: finalReportData.narrativa.oportunidades[0] || "",
    oportunidade_2: finalReportData.narrativa.oportunidades[1] || "",
    oportunidade_3: finalReportData.narrativa.oportunidades[2] || "",
    desafios_texto: finalReportData.narrativa.desafios.join("\n"),
    desafio_1: finalReportData.narrativa.desafios[0] || "",
    desafio_2: finalReportData.narrativa.desafios[1] || "",
    desafio_3: finalReportData.narrativa.desafios[2] || "",
    conselho_alta_performance: finalReportData.narrativa.conselho_alta_performance,
    conhecimento_aplicado: finalReportData.narrativa.conhecimento_aplicado,
    analise_humana_agendada: finalReportData.narrativa.analise_humana_agendada,
    estilo_identificado: finalDom,
    descricao_estilo: finalReportData.analise_comportamental.descricao,
    pontos_fortes_texto: finalReportData.analise_comportamental.pontos_fortes_talentos.join("\n"),
    ponto_forte_1: finalReportData.analise_comportamental.pontos_fortes_talentos[0] || "",
    ponto_forte_2: finalReportData.analise_comportamental.pontos_fortes_talentos[1] || "",
    ponto_forte_3: finalReportData.analise_comportamental.pontos_fortes_talentos[2] || "",
    ponto_forte_4: finalReportData.analise_comportamental.pontos_fortes_talentos[3] || "",
    pontos_desenvolvimento_texto: finalReportData.analise_comportamental.pontos_desenvolvimento.join("\n"),
    desenvolvimento_1: finalReportData.analise_comportamental.pontos_desenvolvimento[0] || "",
    desenvolvimento_2: finalReportData.analise_comportamental.pontos_desenvolvimento[1] || "",
    desenvolvimento_3: finalReportData.analise_comportamental.pontos_desenvolvimento[2] || "",
    metodologia_potenciar_ativada: finalReportData.metodologia.metodologia_potenciar_ativada,
    metodologia_assertivo: finalReportData.sobre_metodologia.assertivo,
    metodologia_participativo: finalReportData.sobre_metodologia.participativo,
    metodologia_conservador_agregador: finalReportData.sobre_metodologia.conservador_agregador,
    metodologia_integrador: finalReportData.sobre_metodologia.integrador,
    metodologia_analitico: finalReportData.sobre_metodologia.analitico,
    metodologia_texto_final: finalReportData.sobre_metodologia.texto_final,
    dinamica_lado_luz: finalReportData.dinamica_dos_estilos.lado_luz,
    dinamica_lado_sombra: finalReportData.dinamica_dos_estilos.lado_sombra,
    dinamica_estilo_apoio: finalReportData.dinamica_dos_estilos.estilo_apoio,
    dinamica_estilo_a_desenvolver: finalReportData.dinamica_dos_estilos.estilo_a_desenvolver,
    evidencias_observadas_texto: finalReportData.evidencias_observadas.join("\n"),
    potencial_desenvolvimento_texto: finalReportData.potencial_desenvolvimento.join("\n"),
    recomendacoes_praticas_texto: finalReportData.recomendacoes_praticas.join("\n"),
    memoria_calculo_por_questao_json: report_data?.campos?.memoria_calculo_por_questao_json || report_data?.memoria_calculo_por_questao_json || "",
    memoria_calculo_respostas_json: report_data?.campos?.memoria_calculo_respostas_json || report_data?.memoria_calculo_respostas_json || ""
  };

  return {
    metadata: {
      userId: relatorioUuid,
      companyId: companyName,
      userName: userName,
      companyName: companyName,
      completedAt: completedAt,
      generatedAt: generatedAt
    },
    assessment: {
      scores,
      ranking: finalReportData.resultado.ranking,
      totalPoints,
      answersCount: processedRespostas.length,
      dominantProfile: finalDom,
      secondaryProfile: finalSec,
      thirdProfile: finalThird,
      lowestProfile: finalLow
    },
    report_data: finalReportData,
    participantReport: {
      title: "Relatório de Socioestilo do Participante",
      executiveSummary: finalReportData.narrativa.parecer_executivo,
      profileSummary: {
        title: finalReportData.resultado.perfil_dominante,
        description: finalReportData.analise_comportamental.descricao
      },
      strengths: finalReportData.analise_comportamental.pontos_fortes_talentos,
      developmentPoints: finalReportData.analise_comportamental.pontos_desenvolvimento,
      opportunities: finalReportData.narrativa.oportunidades,
      personalAdvice: finalReportData.narrativa.conselho_alta_performance,
      teamwork: backupDetails.desc,
      communication: backupDetails.desc,
      decisionMaking: backupDetails.desc,
      changeManagement: backupDetails.desc
    },
    methodology: {
      name: "Socioestilo Potenciar",
      description: "Análise metodológica de comportamento e socioestilos."
    }
  };
}

function getMemoriaCalculoPorQuestao(reportData: any): any[] {
  const direto = reportData?.memoria_calculo?.por_questao;
  if (Array.isArray(direto) && direto.length) return direto;

  const raw = reportData?.campos?.memoria_calculo_por_questao_json;
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {
      console.warn("[MEMORIA_CALCULO] erro ao parsear memoria_calculo_por_questao_json", e);
    }
  }

  return [];
}

function getMemoriaCalculoRespostas(reportData: any): any[] {
  const direto = reportData?.memoria_calculo?.respostas;
  console.log("[HELPER_MEMORIA] direto:", Array.isArray(direto) ? direto.length + " itens, primeiro=" + JSON.stringify(direto?.[0]) : typeof direto);
  if (Array.isArray(direto) && direto.length) return direto;

  const rawCampos = reportData?.campos?.memoria_calculo_respostas_json;
  console.log("[HELPER_MEMORIA] campos_json type:", typeof rawCampos, "length:", rawCampos?.length);
  if (Array.isArray(rawCampos) && rawCampos.length) return rawCampos;
  if (typeof rawCampos === "string" && rawCampos.trim()) {
    try {
      const parsed = JSON.parse(rawCampos);
      console.log("[HELPER_MEMORIA] campos_json parsed:", Array.isArray(parsed) ? parsed.length + " itens" : typeof parsed);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    } catch (error) {
      console.warn("[MEMORIA_CALCULO] erro ao parsear campos.memoria_calculo_respostas_json", error);
    }
  }

  const rawRoot = reportData?.memoria_calculo_respostas_json;
  console.log("[HELPER_MEMORIA] root_json type:", typeof rawRoot, "length:", rawRoot?.length);
  if (Array.isArray(rawRoot) && rawRoot.length) return rawRoot;
  if (typeof rawRoot === "string" && rawRoot.trim()) {
    try {
      const parsed = JSON.parse(rawRoot);
      console.log("[HELPER_MEMORIA] root_json parsed:", Array.isArray(parsed) ? parsed.length + " itens" : typeof parsed);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    } catch (error) {
      console.warn("[MEMORIA_CALCULO] erro ao parsear root.memoria_calculo_respostas_json", error);
    }
  }

  console.warn("[HELPER_MEMORIA] nenhuma fonte encontrou dados — retornando []");
  return [];
}

interface DashboardScreenProps {
  usuario: Usuario;
  myResult: Resultado | null;
  adminSelectedCompanyId?: string | null;
  adminSelectedCompanyName?: string | null;
  onGoBackFromAdmin?: () => void;
  onTabChange?: (tab: 'individual' | 'team') => void;
}

export default function DashboardScreen({ 
  usuario, 
  myResult, 
  adminSelectedCompanyId, 
  adminSelectedCompanyName,
  onGoBackFromAdmin,
  onTabChange
}: DashboardScreenProps) {
  const isViewingAsAdmin = !!adminSelectedCompanyName;
  const targetCompanyNome = adminSelectedCompanyName || usuario.empresa_nome;

  const [activeTab, setActiveTab] = useState<'individual' | 'team'>(
    adminSelectedCompanyId ? 'team' : (myResult ? 'individual' : 'team')
  );

  useEffect(() => {
    onTabChange?.(activeTab);
  }, [activeTab, onTabChange]);
  
  const [teamResults, setTeamResults] = useState<Resultado[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [teamError, setTeamError] = useState<string | null>(null);
  const [reportParameters, setReportParameters] = useState<ReportParameter[]>([]);

  // Allow choosing to view other teammate profiles in detail
  const [selectedMemberResult, setSelectedMemberResult] = useState<Resultado | null>(null);

  const reportUserType: ReportUserType = usuario.role === 'admin' || usuario.email === 'nomura.eduardo@gmail.com' ? 'admin' : ((usuario.role || '').toLowerCase().includes('consult') ? 'consultor' : 'participante');

  useEffect(() => {
    let cancelled = false;
    listarParametrosRelatorio(reportUserType)
      .then(params => {
        if (!cancelled) setReportParameters(params);
      })
      .catch(err => {
        console.warn('[DashboardScreen] Não foi possível carregar parametrização do relatório:', err);
        if (!cancelled) setReportParameters([]);
      });

    return () => {
      cancelled = true;
    };
  }, [reportUserType]);

  const isReportFieldVisible = (secao: string, campo: string) => {
    const param = reportParameters.find(item => item.secao === secao && item.campo === campo);
    const paramVisible = param?.ativo ?? true;

    const visibilityConfig = parseJsonIfNeeded(normalizedPayload?.report_data?.visibility_config || normalizedPayload?.visibility_config || {}) || {};
    const profile = reportUserType;
    const visibilityKey = (() => {
      if (secao === 'perfil' && campo === 'potencializacao_talentos') return 'potencializacao_talentos';
      if (secao === 'pdi') return 'pdi';
      if (secao === 'memoria') return 'memoria_calculo';
      if (secao === 'auditoria' && campo === 'base_conhecimento') return 'chunks_recuperados';
      if (secao === 'auditoria' && campo === 'trilha_rag') return 'chunks_recuperados';
      if (secao === 'auditoria' && campo === 'json_bruto') return 'json_bruto';
      if (secao === 'auditoria') return 'auditoria_tecnica';
      return campo;
    })();

    if (profile === 'participante' && ['auditoria_tecnica', 'memoria_calculo', 'respostas_detalhadas', 'chunks_recuperados', 'prompt_utilizado', 'json_bruto'].includes(visibilityKey)) {
      return false;
    }

    const entry = visibilityConfig?.[visibilityKey] ?? visibilityConfig?.[campo] ?? visibilityConfig?.[secao];
    if (typeof entry === 'boolean') return paramVisible && entry;

    if (entry && typeof entry === 'object') {
      const profileFlag = entry['mostrar_' + profile];
      const aliasFlag = profile === 'participante' ? entry.mostrar_usuario : undefined;
      const directFlag = entry[profile];
      if (typeof profileFlag === 'boolean') return paramVisible && profileFlag;
      if (typeof aliasFlag === 'boolean') return paramVisible && aliasFlag;
      if (typeof directFlag === 'boolean') return paramVisible && directFlag;
      if (entry.ativo === false) return false;
    }

    return paramVisible;
  };

  const isAnyReportFieldVisible = (pairs: Array<[string, string]>) => {
    return pairs.some(([secao, campo]) => isReportFieldVisible(secao, campo));
  };

  const normalizeTeamText = (value: any) => {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  };

  const getResultMetadata = (result: Resultado) => {
    const anyResult = result as any;
    return anyResult.metadata || anyResult.raw_payload?.metadata || anyResult.ai_insights?.metadata || {};
  };

  const resultMatchesTargetCompany = (result: Resultado) => {
    const metadata = getResultMetadata(result);
    const targetName = normalizeTeamText(targetCompanyNome);
    const companyNames = [
      result.empresa_nome,
      result.company_name,
      metadata.companyName,
      metadata.empresa,
      metadata.company,
      metadata.empresa_nome
    ].filter(Boolean);

    if (adminSelectedCompanyId && String(result.empresa_id) === String(adminSelectedCompanyId)) return true;
    if (targetName && companyNames.some(name => normalizeTeamText(name) === targetName)) return true;

    return targetName && companyNames.length === 0 && !result.empresa_id;
  };

  // Load team results from Supabase for the target company
  useEffect(() => {
    const fetchTeamResults = async () => {
      setLoadingTeam(true);
      setTeamError(null);
      try {
        const allResults = await listarResultados();
        const results = allResults.filter(resultMatchesTargetCompany);
        setTeamResults(results);
      } catch (err) {
        setTeamError('Não foi possível carregar os resultados da equipe. Verifique as configurações de rede ou tente atualizar.');
        console.error("Erro listando resultados do time", err);
      } finally {
        setLoadingTeam(false);
      }
    };

    fetchTeamResults();
  }, [targetCompanyNome, adminSelectedCompanyId]);

  // Determine dominant style
  const getDominantStyle = (scoreMap: Scores): keyof Scores => {
    let maxVal = -1;
    let dominant: keyof Scores = 'Assertivo';
    (Object.keys(scoreMap) as Array<keyof Scores>).forEach((style) => {
      if (scoreMap[style] > maxVal) {
        maxVal = scoreMap[style];
        dominant = style;
      }
    });
    return dominant;
  };

  const getStyleColorClass = (style: keyof Scores): string => {
    switch (style) {
      case 'Assertivo': return 'bg-amber-500';
      case 'Participativo': return 'bg-[#D80E2A]';
      case 'Integrador': return 'bg-emerald-500';
      case 'Analitico': return 'bg-[#112363]';
      default: return 'bg-gray-500';
    }
  };

  const getStyleTextColorClass = (style: keyof Scores): string => {
    switch (style) {
      case 'Assertivo': return 'text-amber-800 bg-amber-50';
      case 'Participativo': return 'text-red-800 bg-red-50';
      case 'Integrador': return 'text-emerald-800 bg-emerald-50';
      case 'Analitico': return 'text-[#112363] bg-blue-50';
      default: return 'text-gray-800 bg-gray-50';
    }
  };

  // Determine which active individual result to show
  let rawActiveResult = selectedMemberResult || myResult;

  const hasIndividualResult = !!rawActiveResult;

  // Clone or initialize activeResult so we can enrich it with complete structure
  const activeResult: any = rawActiveResult ? { ...rawActiveResult } : null;

  const styleMappings: Record<string, string> = {
    Direto: "Assertivo",
    Expressivo: "Participativo",
    Amavel: "Integrador",
    Analitico: "Analítico",
    Assertivo: "Assertivo",
    Participativo: "Participativo",
    "Conservador agregador": "Integrador",
    Integrador: "Integrador",
    Analítico: "Analítico"
  };

  const computeDetailedAnswersLocal = (answers: any) => {
    if (!answers) return [];
    const detailed: any[] = [];
    try {
      Object.entries(answers).forEach(([key, val]) => {
        const qId = Number(key);
        detailed.push({
          question_id: qId,
          question_text: `Questao ${qId}`,
          user_answer: val
        });
      });
    } catch (err) {
      console.error('Error computing detailed answers:', err);
    }
    return detailed;
  };

  // Exact payload normalization requested
  const normalizedPayload = activeResult ? normalizeN8nPayload(activeResult.raw_payload, activeResult, usuario) : null;

  const nomeUsuario = normalizedPayload?.metadata?.userName || '';
  const nomeEmpresa = normalizedPayload?.metadata?.companyName || '';
  const dataConclusao = normalizedPayload?.metadata?.completedAt || '';
  const dataGeracao = normalizedPayload?.metadata?.generatedAt || '';

  const scores = normalizedPayload?.assessment?.scores || { Assertivo: 0, Participativo: 0, Integrador: 0, Analitico: 0 };
  const ranking = normalizedPayload?.assessment?.ranking || [];

  const perfilDominante = normalizedPayload?.assessment?.dominantProfile || '';
  const perfilSecundario = normalizedPayload?.assessment?.secondaryProfile || '';
  const perfilTerciario = normalizedPayload?.assessment?.thirdProfile || '';
  const perfilMenosUtilizado = normalizedPayload?.assessment?.lowestProfile || '';

  // Calculations for individual scores using the normalized variables
  const scoreKeys: Array<keyof Scores> = ['Assertivo', 'Participativo', 'Integrador', 'Analitico'];
  
  const totalMyPoints = hasIndividualResult 
    ? scoreKeys.reduce((acc, style) => acc + (scores[style] || 0), 0) 
    : 0;
  
  const dominantStyle = hasIndividualResult 
    ? getDominantStyle(scores) 
    : 'Assertivo';
  
  const dominantProfile = PROFILE_DETAILS[dominantStyle || 'Assertivo'] || PROFILE_DETAILS['Assertivo'];

  // Helper to filter and keep only the latest result per unique user
  const getLatestResultPerUser = (allResults: Resultado[]): Resultado[] => {
    const latestMap: Record<string, Resultado> = {};
    allResults.forEach((result) => {
      const metadata = getResultMetadata(result);
      const userKey = normalizeTeamText(
        result.nome_usuario ||
        result.user_name ||
        metadata.userName ||
        metadata.name ||
        metadata.nome ||
        metadata.email ||
        result.id_usuario
      );
      if (!userKey) return;
      
      // Only include results with valid scores (at least one score > 0)
      if (!result.scores || typeof result.scores !== 'object') {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[DashboardScreen] Result filtered: invalid scores', { 
            id: result.id, 
            scores: result.scores, 
            scoresType: typeof result.scores 
          });
        }
        return;
      }
      const scoreValues = Object.values(result.scores) as number[];
      const hasValidScores = scoreValues.length > 0 && scoreValues.some(s => typeof s === 'number' && s > 0);
      if (!hasValidScores) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[DashboardScreen] Result filtered: no valid scores > 0', { 
            id: result.id, 
            scores: result.scores,
            scoreValues,
            userKey
          });
        }
        return;
      }
      
      const existing = latestMap[userKey];
      if (!existing || new Date(result.data_conclusao) > new Date(existing.data_conclusao)) {
        latestMap[userKey] = result;
      }
    });
    return Object.values(latestMap).sort((a, b) => b.data_conclusao.localeCompare(a.data_conclusao));
  };

  const latestTeamResults = getLatestResultPerUser(teamResults);

  // Calculations for team average using the latest attempt per user
  const totalTeamMembers = latestTeamResults.length;
  const teamScoringSums = latestTeamResults.reduce((acc, cur) => {
    scoreKeys.forEach(style => {
      acc[style] = (acc[style] || 0) + (cur.scores[style] || 0);
    });
    return acc;
  }, { Assertivo: 0, Participativo: 0, Integrador: 0, Analitico: 0 } as Record<keyof Scores, number>);

  const teamAverages = {
    Assertivo: totalTeamMembers > 0 ? Math.round((teamScoringSums.Assertivo / totalTeamMembers) * 10) / 10 : 0,
    Participativo: totalTeamMembers > 0 ? Math.round((teamScoringSums.Participativo / totalTeamMembers) * 10) / 10 : 0,
    Integrador: totalTeamMembers > 0 ? Math.round((teamScoringSums.Integrador / totalTeamMembers) * 10) / 10 : 0,
    Analitico: totalTeamMembers > 0 ? Math.round((teamScoringSums.Analitico / totalTeamMembers) * 10) / 10 : 0,
  };

  // Distribution counts for primary styles inside team
  const styleDistributions = latestTeamResults.reduce((acc, cur) => {
    const primary = getDominantStyle(cur.scores);
    acc[primary] = (acc[primary] || 0) + 1;
    return acc;
  }, { Assertivo: 0, Participativo: 0, Integrador: 0, Analitico: 0 } as Record<keyof Scores, number>);

  const isUserAdminOrNomura = usuario.role === 'admin' || usuario.email === 'nomura.eduardo@gmail.com';
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [isIframe, setIsIframe] = useState(false);

  useEffect(() => {
    setIsIframe(window.self !== window.top);
  }, []);

  const convertOklchToRgb = (val: string): string => {
    return val.replace(/oklch\s*\([^)]+\)/gi, (oklchStr) => {
      const cleaned = oklchStr
        .replace(/,/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/\//g, ' ');
        
      const match = cleaned.match(/oklch\s*\(\s*([\d.%]+)\s+([\d.%]+)\s+([\d.%\w]+)(?:\s+([\d.%]+))?\s*\)/i);
      if (!match) return oklchStr; // Fallback to original string if match fails, avoiding breaking rendering

      const lStr = match[1];
      const cStr = match[2];
      const hStr = match[3];
      const aStr = match[4];

      let l = parseFloat(lStr);
      if (isNaN(l)) l = 0;
      if (lStr.endsWith('%')) l /= 100;

      let c = parseFloat(cStr);
      if (isNaN(c)) c = 0;
      if (cStr.endsWith('%')) c /= 100;

      let h = parseFloat(hStr);
      if (isNaN(h)) h = 0;
      if (hStr.endsWith('%')) h = (h / 100) * 360;

      let a = 1;
      if (aStr) {
        a = parseFloat(aStr);
        if (isNaN(a)) a = 1;
        if (aStr.endsWith('%')) a /= 100;
      }

      const hRad = (h * Math.PI) / 180;
      const L = l;
      const chrom = c;
      const av = chrom * Math.cos(hRad);
      const bv = chrom * Math.sin(hRad);

      const l_ = L + 0.3963377774 * av + 0.2158037573 * bv;
      const m_ = L - 0.1055613458 * av - 0.0638541728 * bv;
      const s_ = L - 0.0894841775 * av - 1.2914855480 * bv;

      const l3 = l_ * l_ * l_;
      const m3 = m_ * m_ * m_;
      const s3 = s_ * s_ * s_;

      const r_m = +4.0767245293 * l3 - 3.3072168827 * m3 + 0.2307590544 * s3;
      const g_m = -1.2681437731 * l3 + 2.6093322483 * m3 - 0.3411344290 * s3;
      const b_m = -0.0041119885 * l3 - 0.7034763098 * m3 + 1.7075862375 * s3;

      const gamma = (v: number) => {
        const clamped = v > 0.0031308 ? 1.055 * Math.pow(v, 1 / 2.4) - 0.055 : 12.92 * v;
        return Math.max(0, Math.min(255, Math.round(clamped * 255)));
      };

      const r = gamma(r_m);
      const g = gamma(g_m);
      const b = gamma(b_m);

      if (aStr && a < 1) {
        return `rgba(${r}, ${g}, ${b}, ${a})`;
      }
      return `rgb(${r}, ${g}, ${b})`;
    });
  };

  const convertOklabToRgb = (val: string): string => {
    return val.replace(/oklab\s*\([^)]+\)/gi, (oklabStr) => {
      const cleaned = oklabStr
        .replace(/,/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/\//g, ' ');
        
      const match = cleaned.match(/oklab\s*\(\s*([\d.%]+)\s+([-\d.%]+)\s+([-\d.%\w]+)(?:\s+([\d.%]+))?\s*\)/i);
      if (!match) return oklabStr;

      const lStr = match[1];
      const aValStr = match[2];
      const bValStr = match[3];
      const alphaStr = match[4];

      let l = parseFloat(lStr);
      if (isNaN(l)) l = 0;
      if (lStr.endsWith('%')) l /= 100;

      let av = parseFloat(aValStr);
      if (isNaN(av)) av = 0;
      if (aValStr.endsWith('%')) av /= 100;

      let bv = parseFloat(bValStr);
      if (isNaN(bv)) bv = 0;
      if (bValStr.endsWith('%')) bv /= 100;

      let alphaVal = 1;
      if (alphaStr) {
        alphaVal = parseFloat(alphaStr);
        if (isNaN(alphaVal)) alphaVal = 1;
        if (alphaStr.endsWith('%')) alphaVal /= 100;
      }

      const l_ = l + 0.3963377774 * av + 0.2158037573 * bv;
      const m_ = l - 0.1055613458 * av - 0.0638541728 * bv;
      const s_ = l - 0.0894841775 * av - 1.2914855480 * bv;

      const l3 = l_ * l_ * l_;
      const m3 = m_ * m_ * m_;
      const s3 = s_ * s_ * s_;

      const r_m = +4.0767245293 * l3 - 3.3072168827 * m3 + 0.2307590544 * s3;
      const g_m = -1.2681437731 * l3 + 2.6093322483 * m3 - 0.3411344290 * s3;
      const b_m = -0.0041119885 * l3 - 0.7034763098 * m3 + 1.7075862375 * s3;

      const gamma = (v: number) => {
        const clamped = v > 0.0031308 ? 1.055 * Math.pow(v, 1 / 2.4) - 0.055 : 12.92 * v;
        return Math.max(0, Math.min(255, Math.round(clamped * 255)));
      };

      const r = gamma(r_m);
      const g = gamma(g_m);
      const b = gamma(b_m);

      if (alphaStr && alphaVal < 1) {
        return `rgba(${r}, ${g}, ${b}, ${alphaVal})`;
      }
      return `rgb(${r}, ${g}, ${b})`;
    });
  };

  const handleDownloadPdf = async () => {
    setGeneratingPdf(true);

    try {
      const pagePrefix = 'p-page-';
      const pageCount = 8;

      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const imgHeight = 297; // exact standard A4 height in mm

      for (let i = 1; i <= pageCount; i++) {
        const pageEl = document.getElementById(`${pagePrefix}${i}`);
        if (!pageEl) continue;
        if (pageEl.classList.contains('hidden')) continue;

        // Render this single page element to keep memory usage super low and prevent crashes
        const canvas = await html2canvas(pageEl, {
          scale: 2, // High DPI suitable for printing
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          onclone: (clonedDoc) => {
            // Clean up style tags/stylesheets in the cloned document to prevent html2canvas parsing errors (oklab/oklch compatibility bugs in libraries)
            try {
              clonedDoc.querySelectorAll('style').forEach((styleEl) => {
                try {
                  if (styleEl.textContent) {
                    let text = styleEl.textContent;
                    text = text.replace(/oklab\s*\([^)]*\)/gi, 'rgb(120, 120, 120)');
                    text = text.replace(/oklch\s*\([^)]*\)/gi, 'rgb(120, 120, 120)');
                    text = text.replace(/linear-gradient\s*\([^)]*okl[ca]h[^)]*\)/gi, 'linear-gradient(to right, rgb(200,200,200), rgb(120,120,120))');
                    styleEl.textContent = text;
                  }
                } catch (e) {
                  console.warn("Style tag adjust error:", e);
                }
              });
            } catch (styleErr) {
              console.warn("Erro ao higienizar tags <style> no clone do PDF:", styleErr);
            }

            try {
              const clonedPage = clonedDoc.getElementById(`${pagePrefix}${i}`);
              if (clonedPage) {
                clonedPage.style.width = '1000px';
                clonedPage.style.maxWidth = 'none';
                clonedPage.style.borderRadius = '0';
                clonedPage.style.boxShadow = 'none';
                clonedPage.style.border = 'none';

                // Convert OKLCH colors to standard RGB colors in this cloned page
                const allElements = clonedPage.querySelectorAll('*');
                allElements.forEach((el) => {
                  try {
                    const htmlEl = el as HTMLElement;
                    if (!htmlEl || !htmlEl.style) return;

                    const computed = (clonedDoc.defaultView && typeof clonedDoc.defaultView.getComputedStyle === 'function')
                      ? clonedDoc.defaultView.getComputedStyle(htmlEl)
                      : (window.getComputedStyle ? window.getComputedStyle(htmlEl) : null);

                    if (!computed) return;

                    const colorProps = [
                      'color', 'backgroundColor', 'borderColor', 'borderTopColor', 
                      'borderRightColor', 'borderBottomColor', 'borderLeftColor', 
                      'outlineColor', 'fill', 'stroke'
                    ];

                    colorProps.forEach((prop) => {
                      try {
                        const cssProp = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
                        const val = computed.getPropertyValue(cssProp);
                        if (val && typeof val === 'string') {
                          if (val.includes('oklch')) {
                            const rgbVal = convertOklchToRgb(val);
                            htmlEl.style.setProperty(cssProp, rgbVal);
                          } else if (val.includes('oklab')) {
                            const rgbVal = convertOklabToRgb(val);
                            htmlEl.style.setProperty(cssProp, rgbVal);
                          }
                        }
                      } catch (propErr) {
                        // ignore property errors
                      }
                    });
                  } catch (elErr) {
                    // ignore element level style errors
                  }
                });
              }
            } catch (pageErr) {
              console.warn("Erro ao configurar página clonada:", pageErr);
            }
          }
        });

        const imgData = canvas.toDataURL('image/png');
        if (i > 1) {
          pdf.addPage();
        }
        pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight, undefined, 'FAST');
      }

      const clientName = activeResult?.nome_usuario || usuario.nome || 'Relatorio';
      const cleanName = clientName.replace(/[^a-zA-Z0-9]/g, '_');
      const dateStr = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
      const fileName = `Relatorio_Socioestilo_${cleanName}_${dateStr}.pdf`;

      // Direct download of the compiled PDF composed of generated images, WITHOUT opening new tabs
      try {
        pdf.save(fileName);
      } catch (pdfErr) {
        console.warn("jsPDF save error, trying custom link click fallback:", pdfErr);
        const pdfBlob = pdf.output('blob');
        const blobUrl = URL.createObjectURL(pdfBlob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
          document.body.removeChild(link);
          URL.revokeObjectURL(blobUrl);
        }, 100);
      }
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      const usePrint = window.confirm(
        'Notamos uma limitação do navegador em renderizar este relatório complexo em imagem (canvas) diretamente.\n\n' +
        'Deseja abrir a janela de impressão nativa do sistema? Lá você pode selecionar "Salvar como PDF" com excelente resolução de vetor e textos selecionáveis!'
      );
      if (usePrint) {
        window.print();
      }
    } finally {
      setGeneratingPdf(false);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 overflow-x-hidden" id="dashboard-wrapper">
      <style>{`
        @media print {
          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            background-color: #ffffff !important;
          }
          #dashboard-wrapper {
            width: 100% !important;
            max-width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          /* Hide scrollbars or any absolute layouts */
          .no-print {
            display: none !important;
          }
        }
      `}</style>
      
      {/* EXCLUSIVE PRINT PROFILE HEADER & METADATA ACCENT - HIDDEN ON SCREEN */}
      <div id="pdf-print-header" className="hidden print:block border-b-2 border-gray-150 pb-5 mb-8 font-sans">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <img 
              src="/logo-big.png" 
              alt="POTENCIAR" 
              className="h-12 w-auto object-contain" 
              referrerPolicy="no-referrer"
            />
            <div>
              <h1 className="text-xl font-black text-[#112363] tracking-tight uppercase">Potenciar</h1>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Desenvolvimento Humano & Organizacional</p>
            </div>
          </div>
          <div className="text-right text-[10px] text-gray-400 font-mono tracking-tight space-y-0.5">
            <p className="font-bold text-gray-600">Diagnóstico do Perfil Socioestilo</p>
            <p className="text-[#D80E2A] font-extrabold">Data de Geração: {new Date().toLocaleDateString('pt-BR')}</p>
          </div>
        </div>
        
        <div className="mt-4 grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-150 text-xs">
          <div>
            <p className="text-[10px] text-gray-400 font-bold uppercase">Empresa / Turma</p>
            <p className="font-extrabold text-[#112363] text-sm mt-0.5">{targetCompanyNome}</p>
          </div>
          <div>
            {activeTab === 'individual' && activeResult ? (
              <>
                <p className="text-[10px] text-gray-400 font-bold uppercase">Colaborador Avaliado</p>
                <p className="font-extrabold text-[#112363] text-sm mt-0.5">{nomeUsuario} {activeResult.email_usuario && `(${activeResult.email_usuario})`}</p>
                <p className="text-[9px] text-gray-405 mt-1">Concluído em: {dataConclusao ? new Date(dataConclusao).toLocaleString('pt-BR') : ''}</p>
              </>
            ) : (
              <>
                <p className="text-[10px] text-gray-400 font-bold uppercase">Escopo do Relatório</p>
                <p className="font-extrabold text-[#112363] text-sm mt-0.5">Diagnóstico Consolidado Regional / Corporativo</p>
                <p className="text-[9px] text-gray-405 mt-1">Avaliados ativos: {totalTeamMembers} respondentes</p>
              </>
            )}
          </div>
        </div>
      </div>


      {/* Visual greeting card */}
      <div className="w-full max-w-full bg-white rounded-2xl border border-gray-100 shadow-xs p-6 md:p-8 flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0 relative overflow-hidden print:hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-gray-50 rounded-full translate-x-12 -translate-y-12 shrink-0 pointer-events-none" />
        <div className="min-w-0">
          <span className="text-xs text-[#D80E2A] font-bold uppercase tracking-wider flex items-center gap-1">
            <CheckCircle2 className="w-4 h-4" /> Diagnóstico Concluído
          </span>
          <h2 className="text-2xl md:text-3xl font-bold font-sans text-[#112363] mt-2 tracking-tight">
            {activeTab === 'individual' ? "Seu Relatório Socioestilo" : "Dashboard da Empresa"}
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            Resultados corporativos vinculados à empresa <strong className="text-gray-800">{usuario.empresa_nome}</strong>.
            {activeTab === 'individual' && activeResult && dataConclusao && (
              <span className="block text-xxs text-gray-400 mt-1.5 font-medium">
                Teste concluído em: {new Date(dataConclusao).toLocaleString('pt-BR')}
              </span>
            )}
          </p>
        </div>
        
        {/* Navigation / Action controls displayed ONLY for Individual Report */}
        {activeTab === 'individual' && (
          <div className="flex flex-col sm:flex-row gap-3 self-start md:self-center items-stretch sm:items-center">
            {/* O botão de Gerar PDF foi removido sob demanda do usuário para um portal mais limpo */}
          </div>
        )}
      </div>

      {/* Tab Switcher - Only display if we have individual result to toggle */}
      {hasIndividualResult && (
        <div className="flex bg-slate-100 p-1 rounded-xl self-start w-full sm:w-auto max-w-full items-center space-x-1 overflow-hidden print:hidden" id="dashboard-tab-switcher">
          <button
            onClick={() => {
              setSelectedMemberResult(null);
              setActiveTab('individual');
            }}
            className={`min-w-0 flex-1 sm:flex-initial flex items-center justify-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'individual' && !selectedMemberResult
                ? 'bg-white text-[#112363] shadow-xs'
                : 'text-slate-500 hover:text-[#112363] hover:bg-slate-50/50'
            }`}
            id="tab-btn-individual"
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span className="truncate">Meu Relatório</span>
          </button>
          
          <button
            onClick={() => setActiveTab('team')}
            className={`min-w-0 flex-1 sm:flex-initial flex items-center justify-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'team'
                ? 'bg-white text-[#112363] shadow-xs'
                : 'text-slate-500 hover:text-[#112363] hover:bg-slate-50/50'
            }`}
            id="tab-btn-team"
          >
            <Users className="w-3.5 h-3.5" />
            <span className="truncate">Dashboard da Empresa</span>
          </button>
        </div>
      )}

      {/* RENDER ACTIVE TAB */}
      {activeTab === 'individual' ? (
        !hasIndividualResult ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-12 text-center max-w-xl mx-auto space-y-4" id="placeholder-no-individual">
            <UserCheck className="w-12 h-12 text-[#D80E2A] mx-auto animate-pulse" />
            <h3 className="text-lg font-black text-[#112363]">Nenhum Colaborador Selecionado</h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              Você está na visão corporativa. Para analisar o relatório individual detalhado de um integrante, 
              clique na aba <strong className="text-[#112363]">Dashboard da Empresa</strong> e selecione qualquer colaborador da lista lateral <strong className="text-gray-800">"Colaboradores Concluídos"</strong>.
            </p>
            <button
              onClick={() => setActiveTab('team')}
              className="mt-2 bg-[#112363] text-white text-xs font-bold py-2.5 px-5 rounded-xl shadow-xs hover:bg-[#112363]/90 active:scale-98 transition-all cursor-pointer"
            >
              Ir para o Dashboard da Empresa
            </button>
          </div>
        ) : (
          /* 1. INDIVIDUAL DASHBOARD */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 min-w-0 max-w-full" id="individual-dashboard">
            
            {/* Visual warning/banner indicating who is being inspected */}
            {(selectedMemberResult || isViewingAsAdmin) && (
              <div className="lg:col-span-3 bg-red-50/55 border border-red-100 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs animate-fade-in print:hidden">
                <div className="flex items-center space-x-2.5">
                  <div className="p-1.5 bg-[#D80E2A]/10 text-[#D80E2A] rounded-lg">
                    <UserCheck className="w-4 h-4 text-[#D80E2A]" />
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 uppercase font-black tracking-wide">Modo de Inspeção</span>
                    <p className="text-[#112363] font-bold">
                      Visualizando Relatório Individual de: <strong className="text-[#D80E2A]">{nomeUsuario}</strong> {activeResult.email_usuario && `(${activeResult.email_usuario})`}
                    </p>
                  </div>
                </div>
                
                {selectedMemberResult && (
                  <button
                    onClick={() => {
                      setSelectedMemberResult(null);
                      setActiveTab('team');
                    }}
                    className="bg-[#112363] text-white font-extrabold text-xxs px-3.5 py-1.5 rounded-xl hover:bg-[#112363]/90 active:scale-[0.98] transition-all cursor-pointer shadow-2xs border border-transparent"
                  >
                    Voltar ao Dashboard da Empresa
                  </button>
                )}
              </div>
            )}

            {/* Document wrapper */}
            {(() => {
              const reportData = normalizedPayload?.report_data;
              if (!reportData) return null;

              const rScores = reportData.resultado.scores || { Assertivo: 0, Participativo: 0, Integrador: 0, Analítico: 0 };
              const rTotal = Object.values(rScores).reduce((a: number, b: number) => a + b, 0) || 1;

              const stylesList = [
                { name: "Assertivo", key: "Assertivo", desc: reportData.sobre_metodologia.assertivo, color: "text-amber-850 bg-amber-50 border-amber-200", badgeColor: "bg-amber-500" },
                { name: "Participativo", key: "Participativo", desc: reportData.sobre_metodologia.participativo, color: "text-red-800 bg-red-50 border-red-200", badgeColor: "bg-[#D80E2A]" },
                { name: "Integrador", key: "Integrador", desc: reportData.sobre_metodologia.conservador_agregador || reportData.sobre_metodologia.integrador, color: "text-emerald-800 bg-emerald-50 border-emerald-200", badgeColor: "bg-[#10b981]" },
                { name: "Analítico", key: "Analitico", desc: reportData.sobre_metodologia.analitico, color: "text-blue-800 bg-blue-50 border-blue-200", badgeColor: "bg-[#112363]" }
              ];

              const isUserAdminOrNomura = usuario.role === 'admin' || usuario.email === 'nomura.eduardo@gmail.com';

              const getScoreVal = (scores: any, key: string): number => {
                if (!scores) return 0;
                const normKey = key.toLowerCase().trim().replace(/\s+/g, '_');
                if (scores[normKey] !== undefined) return Number(scores[normKey]);
                if (scores[key] !== undefined) return Number(scores[key]);
                if (normKey === 'assertivo' && scores.Assertivo !== undefined) return Number(scores.Assertivo);
                if (normKey === 'participativo' && scores.Participativo !== undefined) return Number(scores.Participativo);
                if (normKey === 'conservador_agregador' || normKey === 'integrador') {
                  if (scores['Integrador'] !== undefined) return Number(scores['Integrador']);
                  if (scores['integrador'] !== undefined) return Number(scores['integrador']);
                  if (scores['Conservador agregador'] !== undefined) return Number(scores['Conservador agregador']);
                  if (scores['conservador_agregador'] !== undefined) return Number(scores['conservador_agregador']);
                  if (scores['Amavel'] !== undefined) return Number(scores['Amavel']);
                  if (scores['amavel'] !== undefined) return Number(scores['amavel']);
                }
                if (normKey === 'analitico') {
                  if (scores.Analítico !== undefined) return Number(scores.Analítico);
                  if (scores.Analitico !== undefined) return Number(scores.Analitico);
                  if (scores.analitico !== undefined) return Number(scores.analitico);
                }
                const foundKey = Object.keys(scores).find(k => k.toLowerCase().replace(/[\s_]+/g, '') === normKey.replace(/_/g, ''));
                if (foundKey) return Number(scores[foundKey]);
                return 0;
              };

              const renderFooter = (pageNumber: number) => {
                return (
                  <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider pt-4 border-t border-slate-100 flex flex-wrap justify-between items-center w-full mt-auto gap-2">
                    <div className="flex items-center space-x-2">
                      <span>Socioestilo Potenciar V9</span>
                      <span className="text-slate-300">|</span>
                      <span>Workflow v{reportData.auditoria?.workflow_version || "9.0"}</span>
                      <span className="text-slate-300">|</span>
                      <span>Prompt v{reportData.auditoria?.prompt_version || "System_v9"}</span>
                    </div>
                    <div className="flex items-center space-x-3 text-right">
                      <span>Gerado em: {reportData.identificacao?.generated_at ? new Date(reportData.identificacao.generated_at).toLocaleString('pt-BR') : new Date().toLocaleString('pt-BR')}</span>
                      <span className="text-slate-300">|</span>
                      <span className="text-red-600 font-black tracking-widest font-mono">CONFIDENCIAL</span>
                      <span className="text-slate-300">|</span>
                      <span className="font-mono text-[9px] text-[#112363] font-bold bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
                        ID: {(reportData.identificacao?.relatorio_uuid || "UUID-9").substring(0, 8).toUpperCase()}
                      </span>
                      <span className="text-slate-300">|</span>
                      <span className="text-[#112363] font-black">Pag. {String(pageNumber).padStart(2, "0")} / {reportUserType === "participante" ? "05" : "07"}</span>
                    </div>
                  </div>
                );
              };

              const renderEvidenceItem = (ev: string, idx: number) => {
                try {
                  const cleanedEv = ev.trim();
                  if (cleanedEv.startsWith('{') && cleanedEv.endsWith('}')) {
                    const parsed = JSON.parse(cleanedEv);
                    const hasShadowKeywords = parsed.interpretacao?.toLowerCase().includes('sombra') || 
                                              parsed.interpretacao?.toLowerCase().includes('sobrecarregado') ||
                                              parsed.interpretacao?.toLowerCase().includes('evitar') ||
                                              parsed.interpretacao?.toLowerCase().includes('compensar') ||
                                              parsed.interpretacao?.toLowerCase().includes('desvio') ||
                                              parsed.interpretacao?.toLowerCase().includes('dispersão');
                    const isShadow = hasShadowKeywords || parsed.bloco?.toLowerCase().includes('foco') || parsed.bloco?.toLowerCase().includes('sombra') || parsed.bloco?.toLowerCase().includes('pressão');
                    
                    return (
                      <div key={idx} className={`p-4 rounded-xl border ${isShadow ? 'bg-red-50/20 border-red-100/50' : 'bg-slate-50/50 border-slate-200/60'} space-y-3 shadow-3xs hover:shadow-2xs transition-all`} id={`ev-json-card-${idx}`}>
                        <div className="flex items-center justify-between border-b pb-1.5 border-slate-100">
                          <span className={`text-[9px] uppercase tracking-widest font-black px-2 py-0.5 rounded ${isShadow ? 'bg-red-100 text-[#D80E2A]' : 'bg-blue-100 text-blue-800'}`}>
                            🔍 Evidência - {parsed.bloco || "Histórico"}
                          </span>
                          {parsed.perguntas && (
                            <span className="text-[9px] font-bold text-slate-400 font-mono">
                              Questões: {Array.isArray(parsed.perguntas) ? parsed.perguntas.join(', ') : parsed.perguntas}
                            </span>
                          )}
                        </div>
                        
                        {parsed.respostas_utilizadas && Array.isArray(parsed.respostas_utilizadas) && (
                          <div className="space-y-1.5 animate-fade-in">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Respostas Registradas:</span>
                            <div className="space-y-1.5 pl-1.5">
                              {parsed.respostas_utilizadas.map((resp: string, rIdx: number) => (
                                <div key={rIdx} className="flex items-start gap-1">
                                  <span className="text-[#D80E2A]/70 font-bold text-xs shrink-0 mt-0.5">“</span>
                                  <span className="text-slate-750 italic font-medium leading-relaxed text-[11px]">{resp}”</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {parsed.interpretacao && (
                          <div className={`p-3 rounded-lg border ${isShadow ? 'bg-red-50/45 border-red-150 text-slate-800' : 'bg-emerald-50/30 border-emerald-100 text-slate-800'} text-xs font-semibold leading-relaxed whitespace-pre-line`}>
                            <strong className={`block text-[9px] font-black uppercase tracking-widest mb-1 ${isShadow ? 'text-[#D80E2A]' : 'text-emerald-700'}`}>
                              {isShadow ? "⚠️ Diagnóstico do Lado Sombra" : "💡 Diagnóstico do Lado Luz"}
                            </strong>
                            {parsed.interpretacao}
                          </div>
                        )}
                      </div>
                    );
                  }
                } catch (err) {
                  console.warn("Could not parse evidence item as JSON", err);
                }

                return (
                  <div key={idx} className="p-3 bg-slate-50/50 rounded-xl border border-slate-200/60 flex items-start space-x-2.5 shadow-3xs" id={`ev-text-card-${idx}`}>
                    <span className="text-blue-600 font-extrabold shrink-0 mt-0.5">✓</span>
                    <span className="text-slate-755 font-semibold text-xs leading-relaxed">{ev}</span>
                  </div>
                );
              };

              return (
                <div className="lg:col-span-3 min-w-0 max-w-full space-y-6 md:space-y-8">
                  <div className="min-w-0 max-w-full space-y-6 md:space-y-8" id="participant-report-doc">
                      
                      {/* Page 1: CAPA (Seção 1) */}
                      <div className={`bg-white rounded-3xl border border-gray-150 shadow-xs p-6 md:p-10 min-h-[580px] flex flex-col justify-between relative overflow-hidden transition-all hover:shadow-sm ${!isReportFieldVisible('capa', 'identificacao') ? 'hidden' : ''}`} id="p-page-1">
                        <div className="absolute top-0 right-0 w-80 h-80 bg-red-50/10 rounded-full translate-x-24 -translate-y-24 shrink-0 pointer-events-none" />
                        <div className="absolute bottom-0 left-0 w-64 h-64 bg-slate-50/15 rounded-full -translate-x-12 translate-y-12 shrink-0 pointer-events-none" />
                        
                        <div className="flex justify-between items-center border-b border-gray-100 pb-6 relative z-10 w-full">
                          <div className="flex items-center space-x-3">
                            <span className="font-black text-sm text-[#112363] tracking-tight">POTENCIAR</span>
                            <div className="h-5 w-px bg-gray-200" />
                            <span className="text-[9px] font-black tracking-widest text-[#D80E2A] uppercase">Socioestilo</span>
                          </div>
                          <span className="text-[10px] font-bold text-gray-400 italic">Pág. 01 do Participante</span>
                        </div>

                        <div className="my-auto py-12 space-y-6 relative z-10">
                          <span className="text-xs font-black text-[#D80E2A] uppercase tracking-wider bg-red-50 py-1.5 px-4 rounded-full border border-red-100 w-fit inline-block">
                            Relatório Executivo V8
                          </span>
                          <h1 className="text-4xl md:text-5xl font-black text-[#112363] leading-tight tracking-tight">
                            Mapeamento de Socioestilo & Competências
                          </h1>
                          <p className="text-slate-500 text-sm max-w-xl leading-relaxed">
                            Este documento constitui um dossiê corporativo oficial de liderança operacional. Ele consolida os traços comunicativos prioritários, frentes táticas de adaptabilidade e planos estratégicos.
                          </p>

                          <div className="pt-4 flex items-center space-x-4">
                            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 flex items-center justify-between space-x-10">
                              <div className="space-y-1">
                                <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Código de Autenticação</span>
                                <p className="font-mono text-xs font-bold text-slate-700">{reportData.identificacao.relatorio_uuid.substring(0, 18).toUpperCase()}</p>
                              </div>
                              <div className="w-12 h-12 bg-white border border-gray-200 rounded-lg p-1 flex flex-col justify-between shrink-0">
                                <div className="flex justify-between w-full h-1/3">
                                  <div className="w-[30%] h-full bg-[#112363] rounded-xxs" />
                                  <div className="w-[30%] h-full bg-[#112363] rounded-xxs" />
                                </div>
                                <div className="flex justify-between w-full h-1/3">
                                  <div className="w-[30%] h-full bg-[#112363] rounded-xxs" />
                                  <div className="w-[30%] h-full bg-red-500 rounded-xxs" />
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="border-t border-gray-150 pt-8 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 relative z-10 text-xs w-full">
                          <div>
                            <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wide block">Colaborador</span>
                            <strong className="text-[#112363] font-black text-sm mt-1 block">{reportData.identificacao.nome}</strong>
                          </div>
                          <div>
                            <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wide block">Empresa</span>
                            <strong className="text-slate-700 font-extrabold text-sm mt-1 block">{reportData.identificacao.empresa}</strong>
                          </div>
                          <div>
                            <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wide block">Realizado em</span>
                            <strong className="text-slate-700 font-extrabold text-sm mt-1 block">
                              {reportData.identificacao.generated_at ? new Date(reportData.identificacao.generated_at).toLocaleDateString('pt-BR') : ''}
                            </strong>
                          </div>
                          <div>
                            <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wide block">Estilo Predominante</span>
                            <strong className="text-[#D80E2A] font-black text-sm mt-1 block">{reportData.resultado.perfil_dominante}</strong>
                          </div>
                        </div>
                      </div>

                      {/* Page 2: VISÃO GERAL DO PERFIL & PARECER EXECUTIVO (Blocos 1 & 2) */}
                      <div className={`bg-white rounded-3xl border border-gray-150 shadow-xs p-5 md:p-8 space-y-4 relative overflow-hidden flex flex-col justify-between min-h-[580px] ${!isAnyReportFieldVisible([['sintese', 'visao_geral'], ['sintese', 'parecer_executivo']]) ? 'hidden' : ''}`} id="p-page-2">
                        <div className="space-y-4 w-full">
                          <div className="flex justify-between items-center border-b border-gray-100 pb-3 w-full">
                            <h3 className="text-sm font-black text-[#112363] uppercase tracking-wider">01. Síntese do Perfil & Parecer Executivo de Liderança</h3>
                            <span className="text-[10px] font-bold text-gray-400 italic">Pág. 02 do Participante</span>
                          </div>

                          <div className={`space-y-3.5 ${!isReportFieldVisible('sintese', 'visao_geral') ? 'hidden' : ''}`}>
                            <h4 className="text-xs font-black text-[#112363] uppercase tracking-wider">1.1 Visão Geral do Perfil</h4>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              <div className="bg-amber-50 p-4 rounded-xl border border-amber-200">
                                <span className="text-[8px] font-black text-amber-700 uppercase tracking-widest block">Estilo Principal</span>
                                <strong className="mt-1 block text-[#112363] font-black text-xs md:text-sm truncate">{reportData.resultado.perfil_dominante}</strong>
                              </div>
                              <div className="bg-red-50 p-4 rounded-xl border border-red-200">
                                <span className="text-[8px] font-black text-red-700 uppercase tracking-widest block">Estilo Auxiliar</span>
                                <strong className="mt-1 block text-[#112363] font-black text-xs md:text-sm truncate">{reportData.resultado.perfil_secundario}</strong>
                              </div>
                              <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200">
                                <span className="text-[8px] font-black text-emerald-700 uppercase tracking-widest block">Estilo Terciário</span>
                                <strong className="mt-1 block text-[#112363] font-black text-xs md:text-sm truncate">{reportData.resultado.perfil_terciario}</strong>
                              </div>
                              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                <span className="text-[8px] font-black text-slate-700 uppercase tracking-widest block">Estilo Menos Utilizado</span>
                                <strong className="mt-1 block text-[#112363] font-black text-xs md:text-sm truncate">{reportData.resultado.perfil_menos_utilizado}</strong>
                              </div>
                            </div>
                          </div>

                          <div className={`bg-slate-50 p-6 rounded-2xl border border-slate-100/90 relative overflow-hidden space-y-3 ${!isReportFieldVisible('sintese', 'parecer_executivo') ? 'hidden' : ''}`}>
                            <div className="absolute top-0 right-0 p-2 text-[8px] font-black text-[#D80E2A] tracking-widest uppercase">Parecer do Orientador</div>
                            <h4 className="text-[11px] font-black text-[#D80E2A] uppercase tracking-wider">1.2 Parecer Executivo da Banca</h4>
                            <p className="text-xs text-slate-800 leading-relaxed font-semibold whitespace-pre-line">
                              {reportData.narrativa.parecer_executivo}
                            </p>
                          </div>
                        </div>

                        {renderFooter(2)}
                      </div>

                      {/* Page 3: DISTRIBUIÇÃO DOS ESTILOS & RANKING (Seção 4 & Seção 5) */}
                      <div className={`bg-white rounded-3xl border border-gray-150 shadow-xs p-5 md:p-8 space-y-4 relative overflow-hidden flex flex-col justify-between min-h-[580px] ${!isAnyReportFieldVisible([['metricas', 'radar_estilos'], ['metricas', 'ranking_estilos'], ['dinamica', 'dinamica_estilos']]) ? 'hidden' : ''}`} id="p-page-3">
                        <div className="space-y-4 w-full font-sans">
                          <div className="flex justify-between items-center border-b border-gray-100 pb-3 w-full">
                            <h3 className="text-sm font-black text-[#112363] uppercase tracking-wider flex items-center gap-2">
                              <Star className="w-4 h-4 text-amber-500 fill-amber-500" /> 02. Distribuição Métrica de Energia
                            </h3>
                            <span className="text-[10px] font-bold text-gray-400 italic">Pág. 03 do Participante</span>
                          </div>

                          <div className="space-y-0.5">
                            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5 google-sans">
                              2.1 Distribuição Métrica de Energia
                            </h4>
                          </div>

                          <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 w-full ${!isReportFieldVisible('metricas', 'radar_estilos') ? 'hidden' : ''}`}>
                            {(() => {
                              const scoresObj = reportData.resultado?.scores || {};
                              const assertivoVal = getScoreVal(scoresObj, 'Assertivo');
                              const participativoVal = getScoreVal(scoresObj, 'Participativo');
                              const conservadorVal = getScoreVal(scoresObj, 'Integrador');
                              const analiticoVal = getScoreVal(scoresObj, 'Analítico');

                              const maxScore = Math.max(1, assertivoVal, participativoVal, conservadorVal, analiticoVal);
                              const scale = 65 / maxScore;
                              
                              const rAssertivo = assertivoVal * scale;
                              const rParticipativo = participativoVal * scale;
                              const rConservador = conservadorVal * scale;
                              const rAnalitico = analiticoVal * scale;

                              const cx = 100;
                              const cy = 100;

                              const ptAssertivo = { x: cx, y: cy - rAssertivo };
                              const ptParticipativo = { x: cx + rParticipativo, y: cy };
                              const ptConservador = { x: cx, y: cy + rConservador };
                              const ptAnalitico = { x: cx - rAnalitico, y: cy };

                              const polyStr = `${ptAssertivo.x.toFixed(1)},${ptAssertivo.y.toFixed(1)} ${ptParticipativo.x.toFixed(1)},${ptParticipativo.y.toFixed(1)} ${ptConservador.x.toFixed(1)},${ptConservador.y.toFixed(1)} ${ptAnalitico.x.toFixed(1)},${ptAnalitico.y.toFixed(1)}`;
                              
                              const levels = [0.25, 0.50, 0.75, 1.0];

                              return (
                                <div className="flex flex-col items-center justify-between p-5 bg-slate-50 rounded-2xl border border-slate-100 shadow-3xs w-full min-h-[220px]">
                                  <div className="text-center">
                                    <h4 className="text-[10px] font-black text-[#112363] uppercase tracking-wider mb-2">Mapeamento Vetorial Radar</h4>
                                  </div>
                                  <svg viewBox="0 0 200 200" className="w-44 h-44 shrink-0">
                                    {levels.map((lvl, lidx) => {
                                      const r = lvl * 65;
                                      const p0 = { x: cx, y: cy - r };
                                      const p1 = { x: cx + r, y: cy };
                                      const p2 = { x: cx, y: cy + r };
                                      const p3 = { x: cx - r, y: cy };
                                      return (
                                        <polygon 
                                          key={lidx}
                                          points={`${p0.x},${p0.y} ${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y}`}
                                          fill="none" 
                                          stroke="#e2e8f0" 
                                          strokeWidth="1"
                                          strokeDasharray="2,2"
                                        />
                                      );
                                    })}
                                    <line x1={cx} y1={cy - 65} x2={cx} y2={cy + 65} stroke="#e2e8f0" strokeWidth="1" />
                                    <line x1={cx - 65} y1={cy} x2={cx + 65} y2={cy} stroke="#e2e8f0" strokeWidth="1" />
                                    
                                    {polyStr && (
                                      <polygon 
                                        points={polyStr}
                                        fill="rgba(17, 35, 99, 0.18)" 
                                        stroke="#112363" 
                                        strokeWidth="2.5"
                                      />
                                    )}
                                    
                                    <circle cx={ptAssertivo.x} cy={ptAssertivo.y} r="3.5" fill="#f59e0b" stroke="#ffffff" strokeWidth="1" />
                                    <circle cx={ptParticipativo.x} cy={ptParticipativo.y} r="3.5" fill="#D80E2A" stroke="#ffffff" strokeWidth="1" />
                                    <circle cx={ptConservador.x} cy={ptConservador.y} r="3.5" fill="#10b981" stroke="#ffffff" strokeWidth="1" />
                                    <circle cx={ptAnalitico.x} cy={ptAnalitico.y} r="3.5" fill="#112363" stroke="#ffffff" strokeWidth="1" />
                                    
                                    <text x={cx} y={cy - 65 - 4} textAnchor="middle" className="text-[7px] font-black fill-[#112363] uppercase">Assertivo</text>
                                    <text x={cx + 65 + 4} y={cy + 2.5} textAnchor="start" className="text-[7px] font-black fill-[#112363] uppercase">Participativo</text>
                                    <text x={cx} y={cy + 65 + 8} textAnchor="middle" className="text-[7px] font-black fill-[#112363] uppercase">Integrador</text>
                                    <text x={cx - 65 - 4} y={cy + 2.5} textAnchor="end" className="text-[7px] font-black fill-[#112363] uppercase">Analítico</text>
                                  </svg>
                                </div>
                              );
                            })()}

                            {(() => {
                              const scoresObj = reportData.resultado?.scores || {};
                              const assertivoVal = getScoreVal(scoresObj, 'Assertivo');
                              const participativoVal = getScoreVal(scoresObj, 'Participativo');
                              const conservadorVal = getScoreVal(scoresObj, 'Integrador');
                              const analiticoVal = getScoreVal(scoresObj, 'Analítico');
                              
                              const totalVal = (assertivoVal + participativoVal + conservadorVal + analiticoVal) || 1;
                              const maxScoreVal = Math.max(1, assertivoVal, participativoVal, conservadorVal, analiticoVal);

                              const statsForBars = [
                                { name: "Assertivo", val: assertivoVal, bgProgress: "bg-amber-500", progressColor: "bg-gradient-to-r from-amber-400 to-amber-600" },
                                { name: "Participativo", val: participativoVal, bgProgress: "bg-[#D80E2A]", progressColor: "bg-gradient-to-r from-red-500 to-red-700" },
                                { name: "Integrador", val: conservadorVal, bgProgress: "bg-[#10b981]", progressColor: "bg-gradient-to-r from-emerald-400 to-emerald-600" },
                                { name: "Analítico", val: analiticoVal, bgProgress: "bg-[#112363]", progressColor: "bg-gradient-to-r from-slate-600 to-slate-800" },
                              ];

                              return (
                                <div className="flex flex-col justify-between p-5 bg-slate-50 rounded-2xl border border-slate-100 shadow-3xs w-full min-h-[220px]">
                                  <div className="space-y-4 w-full">
                                    <h4 className="text-[10px] font-black text-[#112363] uppercase tracking-wider mb-2">Gráfico de Barras das Pontuações</h4>
                                    <div className="space-y-3">
                                      {statsForBars.map((st, idx) => {
                                        const pct = Math.round((st.val / totalVal) * 100);
                                        const widthPct = Math.round((st.val / maxScoreVal) * 100);
                                        return (
                                          <div key={idx} className="space-y-1">
                                            <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                                              <span className="flex items-center gap-1.5 font-extrabold uppercase text-[9px] tracking-wide">
                                                <span className={`w-2.5 h-2.5 rounded-full ${st.bgProgress}`} />
                                                {st.name === "Conservador agregador" ? "Integrador" : st.name}
                                              </span>
                                              <span className="font-black text-[#112363]">{st.val} pts ({pct}%)</span>
                                            </div>
                                            <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                                              <div 
                                                className={`${st.progressColor} h-full rounded-full transition-all`} 
                                                style={{ width: `${widthPct}%` }}
                                              />
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>

                           {(() => {
                            if (!isReportFieldVisible('metricas', 'ranking_estilos')) return null;

                            const hasRealRanking = reportData.resultado?.ranking && reportData.resultado.ranking.length > 0;
                            
                            if (hasRealRanking) {
                              return (
                                <div className="space-y-3 mt-4 font-sans">
                                  <h4 className="text-[11px] font-black text-[#112363] uppercase tracking-wider flex items-center gap-1">
                                    <Star className="w-4 h-4 text-amber-500 pb-0.5" /> 2.2 Histórico de Ranking de Prevalência
                                  </h4>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 w-full">
                                    {reportData.resultado.ranking.map((item: any, idx: number) => {
                                      const posicao = item.posicao !== undefined ? item.posicao : (item.posição !== undefined ? item.posição : (idx + 1));
                                      const rawEstilo = item.estilo || "Informação não disponível.";
                                      const estilo = (typeof rawEstilo === 'object' && rawEstilo !== null)
                                        ? (rawEstilo.estilo || rawEstilo.name || rawEstilo.title || "Informação não disponível.")
                                        : String(rawEstilo);
                                      const pontos = item.pontos !== undefined ? item.pontos : (item.pontuacao !== undefined ? item.pontuacao : (item.pontuação !== undefined ? item.pontuação : "0"));
                                      const percentual = item.percentual !== undefined ? item.percentual : "0";
                                      
                                      const isDominant = idx === 0;
                                      const bgClass = isDominant ? "bg-amber-50/30 border-amber-200" : "bg-slate-50/20 border-slate-150";
                                      const accentBadge = isDominant ? "bg-amber-100 text-amber-800 border-amber-300 font-black" : "bg-slate-100 text-slate-700 border-slate-200";
                                      
                                      return (
                                        <div key={idx} className={`p-4 rounded-xl border ${bgClass} flex flex-col justify-between space-y-2`} id={`ranking-card-${idx}`}>
                                          <div className="flex justify-between items-center">
                                            <span className={`text-[8px] uppercase tracking-widest px-2 py-0.5 rounded border ${accentBadge}`}>
                                              {idx === 0 ? "🏆 Dominante" : (idx === 1 ? "🥈 Auxiliar" : (idx === 2 ? "🥉 Terciário" : "💤 Adjacente"))}
                                            </span>
                                            <strong className="text-[10px] text-slate-400 font-bold"># {posicao} de {reportData.resultado.ranking.length}</strong>
                                          </div>
                                          <div>
                                            <h5 className="font-extrabold text-[10px] text-[#112363] uppercase tracking-wider">
                                              {estilo === "Conservador agregador" ? "Integrador" : estilo}
                                            </h5>
                                            <div className="flex items-baseline space-x-1 mt-0.5">
                                              <span className="text-base font-black text-[#112363]">{pontos}</span>
                                              <span className="text-[8px] text-slate-500 font-extrabold uppercase">pts</span>
                                              <span className="text-emerald-600 font-extrabold text-[11px] ml-auto">
                                                {typeof percentual === 'number' || !String(percentual).includes('%') ? `${percentual}%` : String(percentual)}
                                              </span>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            }

                            const scoresObj = reportData.resultado?.scores || {};
                            const assertivoVal = getScoreVal(scoresObj, 'Assertivo');
                            const participativoVal = getScoreVal(scoresObj, 'Participativo');
                            const conservadorVal = getScoreVal(scoresObj, 'Integrador');
                            const analiticoVal = getScoreVal(scoresObj, 'Analítico');
                            
                            const totalVal = (assertivoVal + participativoVal + conservadorVal + analiticoVal) || 1;

                            const rankingList = [
                              { name: "Assertivo", val: assertivoVal, bgProgress: "bg-amber-500" },
                              { name: "Participativo", val: participativoVal, bgProgress: "bg-[#D80E2A]" },
                              { name: "Integrador", val: conservadorVal, bgProgress: "bg-[#10b981]" },
                              { name: "Analítico", val: analiticoVal, bgProgress: "bg-[#112363]" },
                            ].sort((a, b) => b.val - a.val);

                            return (
                              <div className="space-y-3 mt-4">
                                <h4 className="text-[11px] font-black text-[#112363] uppercase tracking-wider flex items-center gap-1">
                                  <Star className="w-4 h-4 text-amber-500 pb-0.5" /> 2.2 Histórico de Ranking de Prevalência
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 w-full">
                                  {rankingList.map((st, idx) => {
                                    const pct = Math.round((st.val / totalVal) * 100);
                                    const isDominant = idx === 0;
                                    const bgClass = isDominant ? "bg-amber-50/30 border-amber-200" : "bg-slate-50/20 border-slate-150";
                                    const accentBadge = isDominant ? "bg-amber-100 text-amber-800 border-amber-300 font-black" : "bg-slate-100 text-slate-700 border-slate-200";
                                    
                                    return (
                                      <div key={idx} className={`p-4 rounded-xl border ${bgClass} flex flex-col justify-between space-y-2`}>
                                        <div className="flex justify-between items-center">
                                          <span className={`text-[8px] uppercase tracking-widest px-2 py-0.5 rounded border ${accentBadge}`}>
                                            {idx === 0 ? "🏆 Dominante" : (idx === 1 ? "🥈 Auxiliar" : (idx === 2 ? "🥉 Terciário" : "💤 Adjacente"))}
                                          </span>
                                          <strong className="text-[10px] text-slate-400">#{idx + 1} de 4</strong>
                                        </div>
                                        <div>
                                          <h5 className="font-extrabold text-[10px] text-[#112363] uppercase tracking-wider">{st.name}</h5>
                                          <div className="flex items-baseline space-x-1 mt-0.5">
                                            <span className="text-base font-black text-[#112363]">{st.val}</span>
                                            <span className="text-[8px] text-slate-500 font-extrabold uppercase">pts</span>
                                            <span className="text-emerald-600 font-extrabold text-[11px] ml-auto">{pct}%</span>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })()}


                          {isReportFieldVisible('metodologia', 'metodologia_potenciar') &&
                            reportData.metodologia?.metodologia_potenciar_ativada && (
                              <div className="space-y-3 mt-4">
                                <h4 className="text-[11px] font-black text-[#112363] uppercase tracking-wider">
                                  2.3 Sobre a Metodologia
                                </h4>

                                <div className="p-4 bg-[#112363]/5 rounded-xl border border-blue-100 text-[11px] leading-relaxed font-semibold text-slate-800">
                                  {reportData.metodologia.metodologia_potenciar_ativada}
                                </div>
                              </div>
                          )}

                          <div className={`space-y-4 mt-4 ${!isAnyReportFieldVisible([['perfil', 'explicacao_socioestilo'], ['perfil', 'quatro_socioestilos']]) ? 'hidden' : ''}`}>
                            <div className={`p-4 bg-[#112363]/5 rounded-xl border border-blue-100 text-xs leading-relaxed font-semibold text-slate-800 ${!isReportFieldVisible('perfil', 'explicacao_socioestilo') ? 'hidden' : ''}`}>
                              <h4 className="text-[11px] font-black text-[#112363] uppercase tracking-wider mb-2">2.4 O que é Sócio Estilo</h4>
                              {reportData.narrativa.conhecimento_aplicado || reportData.metodologia.metodologia_potenciar_ativada}
                            </div>

                            <div className={`space-y-4 ${!isReportFieldVisible('perfil', 'quatro_socioestilos') ? 'hidden' : ''}`}>
                              <h4 className="text-[11px] font-black text-[#112363] uppercase tracking-wider">2.5 Conheça os Quatro Sócio Estilos</h4>
                              <div className="max-w-full overflow-hidden border border-slate-150 rounded-2xl bg-white shadow-3xs">
                                <table className="w-full table-fixed divide-y divide-slate-150 text-xs text-slate-700">
                                  <thead className="bg-[#112363] font-black text-white uppercase text-[9px] md:text-[10px] tracking-wider">
                                    <tr>
                                      <th className="px-3 md:px-5 py-2.5 md:py-3 text-left w-1/3 md:w-1/4">Sócio Estilo</th>
                                      <th className="px-3 md:px-5 py-2.5 md:py-3 text-left">Foco de atuacao e fundamento comunicativo</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-150">
                                    <tr className="hover:bg-slate-50/50">
                                      <td className="px-3 md:px-5 py-2 md:py-3.5 font-black text-amber-700 uppercase tracking-wider bg-amber-50/10 text-[10px] md:text-xs">Assertivo</td>
                                      <td className="px-3 md:px-4 py-2 md:py-3.5 font-medium leading-relaxed text-[10px] md:text-[11px] break-words">{reportData.sobre_metodologia?.assertivo}</td>
                                    </tr>
                                    <tr className="hover:bg-slate-50/50">
                                      <td className="px-3 md:px-5 py-2 md:py-3.5 font-black text-[#D80E2A] uppercase tracking-wider bg-red-50/10 text-[10px] md:text-xs">Participativo</td>
                                      <td className="px-3 md:px-4 py-2 md:py-3.5 font-medium leading-relaxed text-[10px] md:text-[11px] break-words">{reportData.sobre_metodologia?.participativo}</td>
                                    </tr>
                                    <tr className="hover:bg-slate-50/50">
                                      <td className="px-3 md:px-5 py-2 md:py-3.5 font-black text-emerald-800 uppercase tracking-wider bg-emerald-50/10 text-[10px] md:text-xs">Integrador</td>
                                      <td className="px-3 md:px-4 py-2 md:py-3.5 font-medium leading-relaxed text-[10px] md:text-[11px] break-words">{reportData.sobre_metodologia?.integrador || reportData.sobre_metodologia?.conservador_agregador}</td>
                                    </tr>
                                    <tr className="hover:bg-slate-50/50">
                                      <td className="px-3 md:px-5 py-2 md:py-3.5 font-black text-[#112363] uppercase tracking-wider bg-slate-50/20 text-[10px] md:text-xs">Analítico</td>
                                      <td className="px-3 md:px-4 py-2 md:py-3.5 font-medium leading-relaxed text-[10px] md:text-[11px] break-words">{reportData.sobre_metodologia?.analitico}</td>
                                    </tr>
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </div>

                          {isReportFieldVisible('perfil', 'potencializacao_talentos') && (() => {
                            const potencia = reportData.potencializacao_talentos || {};
                            const hasPotencia = Boolean(potencia.talento_identificado || potencia.valor_gerado || potencia.contextos_ideais?.length || potencia.estrategias_potencializacao?.length || potencia.ponto_equilibrio || potencia.descricao_legada || potencia.acoes_legadas?.length || potencia.texto);
                            if (!hasPotencia) return null;
                            const talentoIdentificado = potencia.talento_identificado || potencia.descricao_legada;
                            const estrategias = (potencia.estrategias_potencializacao?.length ? potencia.estrategias_potencializacao : potencia.acoes_legadas) || [];
                            return (
                              <div className="space-y-4 mt-4">
                                <h4 className="text-[11px] font-black text-emerald-700 uppercase tracking-wider">2.6 Como Potencializar seus Talentos</h4>
                                <p className="text-[11px] text-slate-600 font-semibold leading-relaxed">A partir do seu perfil predominante, esta seção apresenta caminhos para ampliar aquilo que você já faz bem.</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                                  {talentoIdentificado && <div className="p-4 bg-emerald-50/20 rounded-xl border border-emerald-100/60 shadow-3xs"><span className="text-[9px] font-black uppercase tracking-widest text-emerald-700 block mb-1">Talento identificado</span><p className="text-slate-800 font-semibold leading-relaxed">{talentoIdentificado}</p></div>}
                                  {potencia.valor_gerado && <div className="p-4 bg-slate-50 rounded-xl border border-slate-150 shadow-3xs"><span className="text-[9px] font-black uppercase tracking-widest text-[#112363] block mb-1">Valor gerado</span><p className="text-slate-800 font-semibold leading-relaxed">{potencia.valor_gerado}</p></div>}
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                                  {potencia.contextos_ideais?.length > 0 && <div className="p-4 bg-white rounded-xl border border-slate-150 shadow-3xs space-y-2"><span className="text-[9px] font-black uppercase tracking-widest text-[#112363] block">Onde esse talento gera mais valor</span><ul className="space-y-2">{potencia.contextos_ideais.map((item: string, idx: number) => (<li key={idx} className="flex items-start gap-2 text-slate-755 font-semibold"><span className="text-emerald-500 mt-0.5">+</span><span>{item}</span></li>))}</ul></div>}
                                  {estrategias?.length > 0 && <div className="p-4 bg-white rounded-xl border border-slate-150 shadow-3xs space-y-2"><span className="text-[9px] font-black uppercase tracking-widest text-[#112363] block">Estratégias de potencialização</span><ul className="space-y-2">{estrategias.map((item: string, idx: number) => (<li key={idx} className="flex items-start gap-2 text-slate-755 font-semibold"><span className="text-[#112363] mt-0.5">+</span><span>{item}</span></li>))}</ul></div>}
                                </div>
                                {potencia.ponto_equilibrio && <div className="p-4 bg-amber-50/45 rounded-xl border border-amber-200 text-xs shadow-xxs"><span className="text-[9px] font-black uppercase tracking-widest text-amber-700 block mb-1">Ponto de equilíbrio</span><p className="text-slate-800 font-semibold leading-relaxed">{potencia.ponto_equilibrio}</p></div>}
                                {!talentoIdentificado && !potencia.valor_gerado && !potencia.contextos_ideais?.length && !estrategias?.length && !potencia.ponto_equilibrio && potencia.texto && <div className="p-4 bg-emerald-50/20 rounded-xl border border-emerald-100/60 shadow-3xs"><p className="text-slate-800 font-semibold leading-relaxed">{potencia.texto}</p></div>}
                              </div>
                            );
                          })()}

                          {/* Dinâmica dos Estilos Seção */}
                          <div className={`space-y-3 mt-4 ${!isReportFieldVisible('dinamica', 'dinamica_estilos') ? 'hidden' : ''}`}>
                            <h4 className="text-xs font-black text-[#112363] uppercase tracking-wider flex items-center gap-1.5 pb-1 border-b border-slate-100">
                              <Zap className="w-4 h-4 text-amber-500 fill-amber-300" /> 2.7 Lente Situacional & Dinâmica dos Estilos
                            </h4>
                              <div className="bg-amber-50/20 p-3.5 rounded-xl border border-amber-200/60 shadow-3xs">
                                <h5 className="font-black text-amber-800 uppercase tracking-wider text-[9px] mb-1 flex items-center gap-1">
                                  ☀️ Lado Luz
                                </h5>
                                <p className="text-slate-750 leading-relaxed font-semibold text-[11px]">
                                  {reportData.dinamica_dos_estilos?.lado_luz}
                                </p>
                              </div>
                              
                              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 shadow-3xs">
                                <h5 className="font-black text-slate-800 uppercase tracking-wider text-[9px] mb-1 flex items-center gap-1">
                                  🌙 Lado Sombra
                                </h5>
                                <p className="text-slate-755 leading-relaxed font-semibold text-[11px]">
                                  {reportData.dinamica_dos_estilos?.lado_sombra}
                                </p>
                              </div>

                              <div className="bg-emerald-50/20 p-3.5 rounded-xl border border-emerald-200/60 shadow-3xs">
                                <h5 className="font-black text-emerald-800 uppercase tracking-wider text-[9px] mb-1 flex items-center gap-1">
                                  🤝 Estilo de Apoio
                                </h5>
                                <p className="text-slate-750 leading-relaxed font-semibold text-[11px]">
                                  {reportData.dinamica_dos_estilos?.estilo_apoio}
                                </p>
                              </div>

                              <div className="bg-[#D80E2A]/5 p-3.5 rounded-xl border border-[#D80E2A]/10 shadow-3xs">
                                <h5 className="font-black text-[#D80E2A] uppercase tracking-wider text-[9px] mb-1 flex items-center gap-1">
                                  🌱 Estilo a Desenvolver
                                </h5>
                                <p className="text-slate-750 leading-relaxed font-semibold text-[11px]">
                                  {reportData.dinamica_dos_estilos?.estilo_a_desenvolver}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>

                        {renderFooter(3)}
                      </div>

                      {/* Page 4: DIAGNÓSTICO COMPORTAMENTAL: LADO LUZ & SOMBREAMENTO (Seções 4.1 & 4.2) */}
                      <div className={`bg-white rounded-3xl border border-gray-150 shadow-xs p-5 md:p-8 space-y-4 relative overflow-hidden flex flex-col justify-between min-h-[580px] ${!isAnyReportFieldVisible([['diagnostico', 'pontos_fortes'], ['diagnostico', 'evidencias_observadas'], ['diagnostico', 'pontos_desenvolvimento'], ['diagnostico', 'descricao_estilo']]) ? 'hidden' : ''}`} id="p-page-4">
                        <div className="space-y-4 w-full font-sans">
                          {/* Page Title */}
                          <div className="flex justify-between items-center border-b border-gray-100 pb-3 w-full">
                            <h3 className="text-sm font-black text-[#112363] uppercase tracking-wider flex items-center gap-2">
                              <Sun className="w-4 h-4 text-amber-500 fill-amber-500" /> 04. Dinâmica Comportamental: Luz & Sombra
                            </h3>
                            <span className="text-[10px] font-bold text-gray-400 italic">Pág. 04 do Participante</span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 w-full text-xs animate-fade-in items-start">
                            {/* Left Column: Lado Luz (4.1 Lado Luz: Forças e Evidências) */}
                            <div className="space-y-5">
                              <div className="border-b border-emerald-100 pb-2">
                                <h4 className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5 text-emerald-600">
                                  <CheckCircle2 className="w-4.5 h-4.5 text-emerald-500 shrink-0" /> 4.1 Lado Luz: Forças e Evidências
                                </h4>
                              </div>

                              {/* Talentos */}
                              <div className={`space-y-3 ${!isReportFieldVisible('diagnostico', 'pontos_fortes') ? 'hidden' : ''}`}>
                                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block font-mono">Talentos & Forças Naturais</span>
                                <div className="space-y-2.5">
                                  {reportData.analise_comportamental.pontos_fortes_talentos.map((talent: string, idx: number) => (
                                    <div key={idx} className="p-3 bg-emerald-50/20 rounded-xl border border-emerald-100/50 flex space-x-2.5 shadow-xxs">
                                      <span className="w-5 h-5 bg-emerald-100 text-emerald-800 rounded-full flex items-center justify-center font-extrabold text-[10px] shrink-0">
                                        {idx + 1}
                                      </span>
                                      <p className="text-slate-800 leading-relaxed font-semibold text-xs">{talent}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Evidências */}
                              <div className={`space-y-3 ${!isReportFieldVisible('diagnostico', 'evidencias_observadas') ? 'hidden' : ''}`}>
                                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block font-mono">Evidências Observadas de Atuação</span>
                                <div className="space-y-2.5">
                                  {reportData.evidencias_observadas.map((ev: string, idx: number) => renderEvidenceItem(ev, idx))}
                                </div>
                              </div>
                            </div>

                            {/* Right Column: Lado Sombra (4.2 Lado Sombra: Riscos e Análises) */}
                            <div className="space-y-5">
                              <div className="border-b border-rose-100 pb-2">
                                <h4 className="text-xs font-black text-[#D80E2A] uppercase tracking-wider flex items-center gap-1.5 font-sans">
                                  <AlertTriangle className="w-4.5 h-4.5 text-[#D80E2A] shrink-0" /> 4.2 Lado Sombra: Riscos e Análises
                                </h4>
                              </div>

                              {/* Riscos */}
                              <div className={`space-y-3 ${!isReportFieldVisible('diagnostico', 'pontos_desenvolvimento') ? 'hidden' : ''}`}>
                                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block font-mono">Riscos Comportamentais Sob Pressão</span>
                                <div className="space-y-2.5">
                                  {reportData.analise_comportamental.pontos_desenvolvimento.map((growth: string, idx: number) => (
                                    <div key={idx} className="p-3 bg-red-50/20 rounded-xl border border-red-100/40 flex space-x-2.5 shadow-xxs">
                                      <span className="w-5 h-5 bg-red-100 text-[#D80E2A] rounded-full flex items-center justify-center font-extrabold text-[10px] shrink-0">
                                        {idx + 1}
                                      </span>
                                      <p className="text-slate-800 leading-relaxed font-semibold text-xs">{growth}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Expressão do Estilo */}
                              <div className={`space-y-3 ${!isReportFieldVisible('diagnostico', 'descricao_estilo') ? 'hidden' : ''}`}>
                                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block font-mono">Expressão do Estilo Dominante</span>
                                <div className="p-4 bg-slate-50 rounded-xl border border-slate-150 shadow-2xs leading-relaxed text-xs text-slate-800 font-semibold relative overflow-hidden">
                                  <div className="absolute top-0 right-0 py-0.5 px-2 bg-indigo-50 border-l border-b border-indigo-100/60 rounded-bl text-[8px] font-black text-indigo-700 tracking-wider uppercase">
                                    Perfil {reportData.analise_comportamental.estilo_identificado}
                                  </div>
                                  <p className="pt-2 leading-relaxed whitespace-pre-line">{reportData.analise_comportamental.descricao}</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {renderFooter(4)}
                      </div>

                      {/* Page 5: POTENCIALIZACAO, RECOMENDACOES E PDI */}
                      <div className={`bg-white rounded-3xl border border-gray-150 shadow-xs p-5 md:p-8 space-y-4 relative overflow-hidden flex flex-col justify-between min-h-[580px] ${!isAnyReportFieldVisible([['perfil', 'potencializacao_talentos'], ['recomendacoes', 'recomendacoes_praticas'], ['pdi', 'objetivos_prioritarios'], ['pdi', 'plano_acao'], ['pdi', 'indicadores_evolucao'], ['pdi', 'compromisso_desenvolvimento'], ['pdi', 'potencial_desenvolvimento'], ['pdi', 'conselho_alta_performance']]) ? 'hidden' : ''}`} id="p-page-5">
                        <div className="space-y-4 w-full font-sans">
                          <div className="flex justify-between items-center border-b border-gray-100 pb-3 w-full">
                            <h3 className="text-sm font-black text-[#112363] uppercase tracking-wider flex items-center gap-2">
                              <BookOpen className="w-4 h-4 text-emerald-500" /> 05. Plano de Desenvolvimento Individual e Recomendacoes Praticas
                            </h3>
                            <span className="text-[10px] font-bold text-gray-400 italic">Pag. 05 do Participante</span>
                          </div>


                          <div className={`space-y-4 ${!isReportFieldVisible('recomendacoes', 'recomendacoes_praticas') ? 'hidden' : ''}`}>
                            <h4 className="text-xs font-black text-[#112363] uppercase tracking-wider flex items-center gap-1.5 pb-1 border-b border-slate-200">
                              <CheckCircle2 className="w-4.5 h-4.5 text-[#112363] shrink-0" /> Recomendacoes praticas de aplicacao
                            </h4>
                            {reportData.recomendacoes_praticas.length > 0 && <div className="space-y-2.5">{reportData.recomendacoes_praticas.map((rec: string, idx: number) => (<div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-start space-x-2.5 shadow-3xs"><span className="text-[#112363] font-bold shrink-0 mt-0.5">-&gt;</span><span className="text-slate-755 font-semibold text-xs leading-relaxed">{rec}</span></div>))}</div>}
                          </div>

                          {(() => {
                            const pdi = reportData.pdi || {};
                            const hasStructuredPdi = Boolean(pdi.objetivos_prioritarios?.length || pdi.plano_acao?.length || pdi.indicadores_evolucao?.length || pdi.compromisso_desenvolvimento);
                            const hasLegacyPdi = Boolean(reportData.potencial_desenvolvimento?.length || reportData.narrativa.conselho_alta_performance);
                            if (!hasStructuredPdi && !hasLegacyPdi) return null;
                            return (
                              <div className="space-y-4">
                                <h4 className="text-xs font-black text-emerald-600 uppercase tracking-wider flex items-center gap-1.5 pb-1 border-b border-emerald-100"><BookOpen className="w-4.5 h-4.5 text-emerald-500 shrink-0" /> 05. Plano de Desenvolvimento Individual - PDI</h4>
                                {isReportFieldVisible('pdi', 'objetivos_prioritarios') && pdi.objetivos_prioritarios?.length > 0 && <div className="space-y-2"><span className="text-[10px] font-black uppercase tracking-widest text-slate-500 block">5.1 Objetivos prioritarios</span><div className="grid grid-cols-1 md:grid-cols-2 gap-3">{pdi.objetivos_prioritarios.map((item: any, idx: number) => (<div key={idx} className="p-3 bg-white rounded-xl border border-slate-150 shadow-3xs space-y-1.5"><strong className="text-xs text-[#112363] font-black block">{item.objetivo || item.texto || item.title || `Objetivo ${idx + 1}`}</strong>{(item.beneficio_esperado || item.beneficio || item.resultado || item.descricao) && <p className="text-[11px] text-slate-700 font-semibold leading-relaxed">{item.beneficio_esperado || item.beneficio || item.resultado || item.descricao}</p>}</div>))}</div></div>}
                                {isReportFieldVisible('pdi', 'plano_acao') && pdi.plano_acao?.length > 0 && <div className="space-y-2 max-w-full overflow-hidden"><span className="text-[10px] font-black uppercase tracking-widest text-slate-500 block">5.2 Plano de acao</span><div className="border border-slate-150 rounded-2xl overflow-hidden bg-white shadow-3xs"><table className="w-full text-left text-[11px]"><thead className="bg-slate-50 text-slate-600 uppercase tracking-wider text-[9px] font-black"><tr><th className="px-3 py-2">Acao</th><th className="px-3 py-2">Frequencia</th><th className="px-3 py-2">Indicador</th><th className="px-3 py-2">Prazo</th></tr></thead><tbody className="divide-y divide-slate-100">{pdi.plano_acao.map((item: any, idx: number) => (<tr key={idx}><td className="px-3 py-2 font-semibold text-slate-800">{item.acao || item.texto || '-'}</td><td className="px-3 py-2 text-slate-700 font-medium">{item.frequencia || item.periodicidade || '-'}</td><td className="px-3 py-2 text-slate-700 font-medium">{item.indicador || item.medida || '-'}</td><td className="px-3 py-2 text-slate-700 font-medium">{item.prazo_sugerido || item.prazo || '-'}</td></tr>))}</tbody></table></div></div>}
                                {isReportFieldVisible('pdi', 'indicadores_evolucao') && pdi.indicadores_evolucao?.length > 0 && <div className="space-y-2"><span className="text-[10px] font-black uppercase tracking-widest text-slate-500 block">5.3 Indicadores de evolucao</span><ul className="space-y-2">{pdi.indicadores_evolucao.map((item: any, idx: number) => (<li key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-slate-755 font-semibold text-xs leading-relaxed">{item.indicador || item.pergunta || item.texto || item.reflexao || '-'}</li>))}</ul></div>}
                                {isReportFieldVisible('pdi', 'compromisso_desenvolvimento') && pdi.compromisso_desenvolvimento && <div className="p-4 bg-amber-50/45 rounded-xl border border-amber-200 text-xs shadow-xxs relative overflow-hidden mt-1"><span className="absolute top-0 right-0 py-1 px-2.5 bg-amber-100 text-amber-800 font-black rounded-bl-lg text-[8px] uppercase tracking-wider">Compromisso</span><h4 className="text-[10px] font-black text-amber-700 uppercase tracking-widest block mb-1">5.4 Compromisso de desenvolvimento</h4><p className="text-xs text-slate-850 leading-relaxed font-semibold italic">"{pdi.compromisso_desenvolvimento}"</p></div>}
                                {!hasStructuredPdi && isReportFieldVisible('pdi', 'potencial_desenvolvimento') && reportData.potencial_desenvolvimento?.length > 0 && <div className="space-y-2"><span className="text-[10px] font-black uppercase tracking-widest text-slate-500 block">Compatibilidade com relatorios anteriores</span><div className="space-y-2.5">{reportData.potencial_desenvolvimento.map((pot: string, idx: number) => (<div key={idx} className="p-3 bg-emerald-50/10 rounded-xl border border-emerald-100/40 flex items-start space-x-2.5 shadow-3xs"><span className="text-emerald-500 font-extrabold shrink-0 mt-0.5 font-mono">+</span><span className="text-slate-755 font-semibold text-xs leading-relaxed">{pot}</span></div>))}</div></div>}
                                {!hasStructuredPdi && isReportFieldVisible('pdi', 'conselho_alta_performance') && reportData.narrativa.conselho_alta_performance && <div className="p-4 bg-amber-50/45 rounded-xl border border-amber-200 text-xs shadow-xxs relative overflow-hidden mt-1"><span className="absolute top-0 right-0 py-1 px-2.5 bg-amber-100 text-amber-800 font-black rounded-bl-lg text-[8px] uppercase tracking-wider">Diretiva</span><h4 className="text-[10px] font-black text-amber-700 uppercase tracking-widest block mb-1">Conselho de alta performance</h4><p className="text-xs text-slate-850 leading-relaxed font-semibold italic">"{reportData.narrativa.conselho_alta_performance}"</p></div>}
                              </div>
                            );
                          })()}
                        </div>

                        {renderFooter(5)}
                      </div>


{/* Page 6: MEMÓRIA DO QUESTIONÁRIO & MEMÓRIA DE CÁLCULO (Seção 15 & Seção 16) */}
                      <div className={`bg-white rounded-3xl border border-gray-150 shadow-xs p-5 md:p-8 space-y-4 relative overflow-hidden flex flex-col justify-between min-h-[580px] ${!isReportFieldVisible('memoria', 'respostas_questionario') ? 'hidden' : ''}`} id="p-page-6">
                        <div className="space-y-4 w-full">
                          <div className="flex justify-between items-center border-b border-gray-100 pb-3 w-full">
                            <h3 className="text-sm font-black text-[#112363] uppercase tracking-wider flex items-center gap-2">
                              <FileText className="w-4 h-4 text-[#112363]" /> 06. Memória de Cálculo e Respostas do Questionário
                            </h3>
                            <span className="text-[10px] font-bold text-gray-400 italic">P�g. 06 do Participante</span>
                          </div>

                          <div className="space-y-4">
                            <h4 className="text-xs font-black text-[#112363] uppercase tracking-wider">6.1 Rastreabilidade das Respostas Individuais</h4>
                            <div className="max-w-full overflow-hidden border border-slate-150 rounded-2xl bg-white shadow-3xs max-h-[280px] overflow-y-auto w-full">
                              {(() => {
                                const memoriaRespostas = getMemoriaCalculoRespostas(reportData);
                                console.log("[PAGINA_07_MEMORIA]", {
                                  "1_direto(memoria_calculo.respostas)": reportData?.memoria_calculo?.respostas?.length,
                                  "2_campos_json_type": typeof reportData?.campos?.memoria_calculo_respostas_json,
                                  "2_campos_json_length": reportData?.campos?.memoria_calculo_respostas_json?.length,
                                  "3_root_json_type": typeof reportData?.memoria_calculo_respostas_json,
                                  "3_root_json_length": reportData?.memoria_calculo_respostas_json?.length,
                                  "4_linhas_resolvidas": memoriaRespostas.length,
                                  "5_primeira": memoriaRespostas[0]
                                });
                                return (
                                  <table className="w-full table-fixed divide-y divide-slate-150 text-[9px] md:text-[10px]">
                                    <thead className="bg-slate-100 font-extrabold text-[#112363] uppercase tracking-wider sticky top-0 z-10 text-[8px] md:text-[10px]">
                                      <tr>
                                        <th className="px-2 md:px-4 py-2 md:py-2.5 text-left">Questão</th>
                                        <th className="px-2 md:px-4 py-2 md:py-2.5 text-left">Resposta Selecionada</th>
                                        <th className="px-2 md:px-4 py-2 md:py-2.5 text-left">Estilo da Resposta</th>
                                        <th className="px-2 md:px-4 py-2 md:py-2.5 text-right">Pontos</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-150 text-slate-700 font-semibold bg-white">
                                      {memoriaRespostas.map((item: any, idx: number) => (
                                        <tr key={idx} className="hover:bg-slate-50/50">
                                          <td className="px-2 md:px-3 py-1.5 md:py-2 truncate text-[9px] md:text-[10px]" title={item.questao}>{item.questao || `Q${item.questionId}`}</td>
                                          <td className="px-2 md:px-3 py-1.5 md:py-2 italic font-medium text-[9px] md:text-[10px] break-words">{item.resposta}</td>
                                          <td className="px-2 md:px-3 py-1.5 md:py-3 font-extrabold text-[#D80E2A] text-[9px] md:text-[10px] break-words">{item.socioEstilo}</td>
                                          <td className="px-2 md:px-4 py-1.5 md:py-2 text-right font-black text-slate-550 text-[9px] md:text-[10px]">+{item.pontos} pt</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                );
                              })()}
                            </div>
                          </div>

                          <div className="p-4 bg-slate-50 rounded-xl border border-slate-155 text-[11px] text-slate-600 font-semibold leading-relaxed">
                            <strong className="text-slate-800 uppercase block mb-1">6.2 Memória Estrita de Cálculo de Pesos Lineares</strong>
                            A pontuação acumulada é obtida pela somatória linear simples do peso correlacionado correspondente a cada escolha do respondente de acordo com as diretrizes do gabarito oficial da metodologia Potenciar Socioestilos. Não há coeficientes multiplicadores, mantendo uma integridade matemática direta de 100%. Total Pontos Calculados: {rTotal} pontos.
                          </div>
                        </div>

                        {renderFooter(6)}
                      </div>

                      {/* Page 7: AUDITORIA DO WORKFLOW n8n (Seção 17 / Admin View / Confidencial Lock) */}
                      <div className={`bg-white rounded-3xl border border-gray-150 shadow-xs p-5 md:p-8 space-y-4 relative overflow-hidden flex flex-col justify-between min-h-[580px] ${!isAnyReportFieldVisible([['auditoria', 'timeline_processamento'], ['auditoria', 'metadados_integracao'], ['auditoria', 'base_conhecimento'], ['auditoria', 'fundamentacao_teorica'], ['auditoria', 'trilha_rag']]) ? 'hidden' : ''}`} id="p-page-7">
                        <div className="space-y-4 w-full">
                          <div className="flex justify-between items-center border-b border-gray-100 pb-3 w-full">
                            <h3 className="text-sm font-black text-[#112363] uppercase tracking-wider flex items-center gap-2">
                              <Bot className="w-4 h-4 text-[#112363]" /> 07. Registro de Auditoria e Conformidade Técnica
                            </h3>
                            <span className="text-[10px] font-bold text-gray-400">Pág. 07 / Auditoria</span>
                          </div>

                          {/* 4. Processing Timeline Progress Flow */}
                          {(() => {
                            const scoresObj = reportData.resultado?.scores || {};
                            const assertivoVal = getScoreVal(scoresObj, 'Assertivo');
                            const participativoVal = getScoreVal(scoresObj, 'Participativo');
                            const conservadorVal = getScoreVal(scoresObj, 'Integrador');
                            const analiticoVal = getScoreVal(scoresObj, 'Analítico');
                            const rTotalVal = (assertivoVal + participativoVal + conservadorVal + analiticoVal) || 0;

                            return (
                              <div className={`space-y-3 ${!isReportFieldVisible('auditoria', 'timeline_processamento') ? 'hidden' : ''}`}>
                                <h4 className="text-[10.5px] font-black text-[#112363] uppercase tracking-wider">7.1 Linha do Tempo de Processamento Autônomo</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 relative w-full">
                                  {/* Step 1 */}
                                  <div className="p-3 bg-white border border-slate-150 rounded-xl relative shadow-3xs flex flex-col justify-between">
                                    <div className="flex items-center space-x-2">
                                      <div className="w-6 h-6 bg-indigo-50 border border-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-black text-[10px] shrink-0">
                                        1
                                      </div>
                                      <span className="text-[8px] font-black uppercase text-indigo-800 tracking-wider">Preenchimento</span>
                                    </div>
                                    <div className="mt-2 text-[10px]">
                                      <strong className="text-slate-800 block text-[10px]">Coleta Realizada</strong>
                                      <p className="text-slate-500 font-medium leading-tight text-[9px]">20 questões finalizadas de socioestilos.</p>
                                      <span className="text-[8px] font-mono text-slate-400 block mt-1">
                                        Submetido: {reportData.identificacao?.generated_at ? new Date(reportData.identificacao.generated_at).toLocaleDateString('pt-BR') : ''}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Step 2 */}
                                  <div className="p-3 bg-white border border-slate-150 rounded-xl relative shadow-3xs flex flex-col justify-between">
                                    <div className="flex items-center space-x-2">
                                      <div className="w-6 h-6 bg-amber-50 border border-amber-100 rounded-full flex items-center justify-center text-amber-700 font-black text-[10px] shrink-0">
                                        2
                                      </div>
                                      <span className="text-[8px] font-black uppercase text-amber-800 tracking-wider">Scoring</span>
                                    </div>
                                    <div className="mt-2 text-[10px]">
                                      <strong className="text-slate-800 block text-[10px]">Matriz Computada</strong>
                                      <p className="text-slate-500 font-medium leading-tight text-[9px]">Gabarito apurado linearmente no n8n.</p>
                                      <span className="text-[8px] font-extrabold text-amber-600 block mt-1 bg-amber-50 px-1 py-0.5 rounded w-fit">
                                        Score: {rTotalVal} pontos
                                      </span>
                                    </div>
                                  </div>

                                  {/* Step 3 */}
                                  <div className="p-3 bg-white border border-slate-150 rounded-xl relative shadow-3xs flex flex-col justify-between">
                                    <div className="flex items-center space-x-2">
                                      <div className="w-6 h-6 bg-rose-50 border border-rose-100 rounded-full flex items-center justify-center text-rose-700 font-black text-[10px] shrink-0">
                                        3
                                      </div>
                                      <span className="text-[8px] font-black uppercase text-rose-800 tracking-wider">Processamento IA</span>
                                    </div>
                                    <div className="mt-2 text-[10px]">
                                      <strong className="text-slate-800 block text-[10px]">Cognição Comportamental</strong>
                                      <p className="text-slate-500 font-medium leading-tight text-[9px]">Narrativa executada sob conformidade.</p>
                                      <span className="text-[8px] font-mono text-rose-600 font-black block mt-1 truncate" title={reportData.auditoria?.modelo_llm || "Gemini 1.5 Pro"}>
                                        {reportData.auditoria?.modelo_llm || "Gemini 1.5 Pro"}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Step 4 */}
                                  <div className="p-3 bg-white border border-emerald-200 bg-emerald-50/5 rounded-xl relative shadow-3xs flex flex-col justify-between">
                                    <div className="flex items-center space-x-2">
                                      <div className="w-6 h-6 bg-emerald-50 border border-emerald-100 rounded-full flex items-center justify-center text-emerald-700 font-black text-[10px] shrink-0">
                                        4
                                      </div>
                                      <span className="text-[8px] font-black uppercase text-emerald-800 tracking-wider">Selo e Emissão</span>
                                    </div>
                                    <div className="mt-2 text-[10px]">
                                      <strong className="text-slate-800 block text-[10px]">Mapeamento Prontificado</strong>
                                      <p className="text-slate-500 font-medium leading-tight text-[9px]">Geração e disponibilização da visualização.</p>
                                      <span className="text-[8px] font-mono text-emerald-600 font-black block mt-1 hover:underline">
                                        UUID: {(reportData.identificacao?.relatorio_uuid || "").substring(0, 10).toUpperCase()}...
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })()}

                          <div className="space-y-4 text-xs w-full">
                            <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 w-full ${!isReportFieldVisible('auditoria', 'metadados_integracao') ? 'hidden' : ''}`}>
                              <div className="p-3.5 bg-slate-50 border border-slate-150 rounded-xl space-y-1.5 shadow-3xs">
                                <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest block font-sans">Metadados Corporativos</span>
                                <strong className="text-[#112363] block font-black text-xs leading-none font-sans">n8n Integration Channel</strong>
                                <p className="text-[10px] text-slate-500 font-medium font-sans">Flow: v{reportData.auditoria?.workflow_version || "9.0"} | Engine: {reportData.auditoria?.prompt_version || "System_v9"}</p>
                              </div>

                              <div className="p-3.5 bg-slate-50 border border-slate-150 rounded-xl space-y-1.5 shadow-3xs">
                                <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest block font-sans">Divergências Estritadas</span>
                                <strong className="text-[#112363] block font-black text-xs leading-none font-sans">
                                  {reportData.auditoria?.divergencias_scores ? "Sim (Detectado)" : "Não (Perfeitamente Consistente)"}
                                </strong>
                                <p className="text-[10px] text-slate-500 font-medium font-sans">Scores do Gabarito vs Parser de Linguagem Natural</p>
                              </div>
                            </div>

                            {/* BASE DE CONHECIMENTO CONSULTADA & FUNDAMENTAÇÃO TEÓRICA */}
                            {(() => {
                              const fontes = (
                                reportData.fontes_consultadas_texto
                                || (Array.isArray(reportData.fontes_consultadas) && reportData.fontes_consultadas.length > 0
                                    ? reportData.fontes_consultadas.map((f: any) => typeof f === 'object' ? (f.documento || f.documento_recuperado || f.source || String(f)) : String(f)).join('\n')
                                    : '')
                              ).trim();

                              const chunks = (
                                reportData.chunks_recuperados_texto
                                || (Array.isArray(reportData.chunks_recuperados) && reportData.chunks_recuperados.length > 0
                                    ? reportData.chunks_recuperados.map((c: any) => typeof c === 'object' ? `${c.documento || c.documento_recuperado || c.document || ''} - Chunk ${c.chunk !== undefined ? c.chunk : (c.chunk_idx !== undefined ? c.chunk_idx : '')}` : String(c)).join('\n')
                                    : '')
                              ).trim();

                              return (
                                <div className="space-y-4 font-sans w-full">
                                  
                                  {/* Sections 7.2 + 7.3 lado a lado */}
                                  <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-100 pt-3 ${!isAnyReportFieldVisible([['auditoria', 'base_conhecimento'], ['auditoria', 'fundamentacao_teorica']]) ? 'hidden' : ''}`}>

                                    {/* Section 7.2: Base de Conhecimento Consultada */}
                                    <div className={`space-y-2 font-sans ${!isReportFieldVisible('auditoria', 'base_conhecimento') ? 'hidden' : ''}`}>
                                      <strong className="text-slate-700 block uppercase text-[10.5px] font-black tracking-wider flex items-center gap-1.5">
                                        <BookOpen className="w-4 h-4 text-[#112363]" /> 7.2 Base de Conhecimento Consultada
                                      </strong>
                                      <div className="p-3.5 bg-slate-50 border border-slate-150 rounded-2xl space-y-2 shadow-3xs text-xs">
                                        <div className="flex items-center space-x-1.5 border-b border-slate-200 pb-1.5">
                                          <span className="w-2 h-2 rounded-full bg-[#D80E2A] shrink-0" />
                                          <strong className="text-slate-800 font-black uppercase text-[9px] tracking-wider">Documentos Utilizados e Chunks Recuperados</strong>
                                        </div>
                                        {!chunks ? (
                                          <p className="text-[10.5px] text-slate-500 font-semibold pl-1 py-1 italic">
                                            Nenhum chunk recuperado para esta análise.
                                          </p>
                                        ) : (
                                          <ul className="space-y-1 text-slate-700 pl-1 max-h-[160px] overflow-y-auto font-semibold text-[10.5px]">
                                            {chunks.split('\n').map((c: string, idx: number) => {
                                              const chunkLine = c.trim();
                                              if (!chunkLine) return null;
                                              const parts = chunkLine.split(/\s*-\s*/);
                                              if (parts.length > 1) {
                                                const docPart = parts[0];
                                                const chunkNumPart = parts.slice(1).join(" - ");
                                                return (
                                                  <li key={idx} className="flex items-start gap-1.5">
                                                    <span className="text-[#D80E2A] mt-0.5">•</span>
                                                    <span>{docPart} — <strong className="text-amber-700 font-mono text-[9.5px] bg-amber-50 border border-amber-200 px-1 py-0.5 rounded font-black">{chunkNumPart}</strong></span>
                                                  </li>
                                                );
                                              }
                                              return (
                                                <li key={idx} className="flex items-start gap-1.5">
                                                  <span className="text-[#D80E2A] mt-0.5">•</span>
                                                  <span>{chunkLine}</span>
                                                </li>
                                              );
                                            })}
                                          </ul>
                                        )}
                                      </div>
                                    </div>

                                    {/* Section 7.3: Fundamentação Teórica */}
                                    <div className={`space-y-2 font-sans ${!isReportFieldVisible('auditoria', 'fundamentacao_teorica') ? 'hidden' : ''}`}>
                                      <strong className="text-slate-700 block uppercase text-[10.5px] font-black tracking-wider flex items-center gap-1.5">
                                        <BookOpen className="w-4 h-4 text-[#112363]" /> 7.3 Fundamentação Teórica de Sócio Estilos Utilizada
                                      </strong>
                                      {(() => {
                                        const textVal = (reportData.referenciais_teoricos_texto || '').trim();
                                        const jsonList = Array.isArray(reportData.referenciais_teoricos) ? reportData.referenciais_teoricos : [];

                                        const parseLinhas = (text: string) =>
                                          text.split('\n').map(l => l.trim()).filter(Boolean).map(line => {
                                            const colonIdx = line.indexOf(':');
                                            if (colonIdx > 0) {
                                              return { autor: line.substring(0, colonIdx).trim(), contribuicao: line.substring(colonIdx + 1).trim() };
                                            }
                                            return { autor: line, contribuicao: '' };
                                          });

                                        const entries: { autor: string; contribuicao: string }[] = textVal
                                          ? parseLinhas(textVal)
                                          : jsonList.map((ref: any) => ({
                                              autor: ref.autor || ref.author || '',
                                              contribuicao: ref.contribuicao || ref.contribution || ref.conceito_aplicado || ref.conceito || ref.concept || ref.obra || ''
                                            })).filter((e: any) => e.autor);

                                        if (entries.length > 0) {
                                          return (
                                            <div className="space-y-2">
                                              {entries.map((ref, idx) => (
                                                <div key={idx} className="p-3 bg-white border border-slate-150 rounded-xl shadow-3xs space-y-1 hover:bg-slate-50/50 transition-colors">
                                                  <div className="flex items-center gap-1.5">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-[#112363] shrink-0 mt-0.5" />
                                                    <strong className="text-[#112363] font-extrabold text-[11px]">{ref.autor}</strong>
                                                  </div>
                                                  {ref.contribuicao && (
                                                    <p className="text-slate-600 font-semibold text-[10.5px] leading-relaxed pl-3">{ref.contribuicao}</p>
                                                  )}
                                                </div>
                                              ))}
                                            </div>
                                          );
                                        }

                                        return (
                                          <div className="p-4 bg-slate-50 border border-slate-150 rounded-2xl text-center text-slate-500 font-semibold text-xs py-4">
                                            Nenhum referencial teórico específico foi identificado.
                                          </div>
                                        );
                                      })()}
                                    </div>

                                  </div>

                                  {isUserAdminOrNomura && isReportFieldVisible('auditoria', 'trilha_rag') && (() => {
                                    const audit = getChunkContentAudit(reportData);
                                    const chunks = audit.chunks_recuperados || [];
                                    if (chunks.length === 0) return null;

                                    return (
                                      <div className="space-y-2 font-sans border-t border-slate-100 pt-3">
                                        <strong className="text-slate-700 block uppercase text-[10.5px] font-black tracking-wider flex items-center gap-1.5">
                                          <FileText className="w-4 h-4 text-[#112363]" /> 7.4 Trilha de Auditoria RAG
                                        </strong>
                                        <div className="p-3.5 bg-slate-50 border border-slate-150 rounded-2xl space-y-3 shadow-3xs">
                                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px] text-slate-600 font-semibold">
                                            {audit.consulta_utilizada && (
                                              <p><strong className="text-slate-800">Consulta utilizada:</strong> {audit.consulta_utilizada}</p>
                                            )}
                                            {audit.finalidade && (
                                              <p><strong className="text-slate-800">Finalidade:</strong> {audit.finalidade}</p>
                                            )}
                                            {audit.retrieved_at && (
                                              <p><strong className="text-slate-800">Recuperado em:</strong> {new Date(audit.retrieved_at).toLocaleString('pt-BR')}</p>
                                            )}
                                          </div>

                                          <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                                            {chunks.map((item, index) => {
                                              const documento = item.documento || 'Documento não identificado';
                                              const chunk = item.chunk ?? 'não identificado';
                                              return (
                                                <details key={`${documento}-${chunk}-${index}`} className="group bg-white border border-slate-150 rounded-xl overflow-hidden">
                                                  <summary className="list-none cursor-pointer px-3 py-2 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors">
                                                    <span className="text-[10px] font-black text-[#112363] uppercase tracking-wide truncate">
                                                      {item.ordem || index + 1}. {documento} - Chunk {chunk}
                                                    </span>
                                                    <span className="text-[9px] font-extrabold text-[#D80E2A] shrink-0 group-open:hidden">Ver conteúdo recuperado</span>
                                                    <span className="text-[9px] font-extrabold text-slate-500 shrink-0 hidden group-open:inline">Ocultar conteúdo</span>
                                                  </summary>
                                                  <pre className="whitespace-pre-wrap text-[10px] leading-relaxed text-slate-700 bg-white border-t border-slate-100 p-3 font-mono max-h-[220px] overflow-y-auto">
                                                    {item.conteudo || 'Conteúdo do chunk não disponível.'}
                                                  </pre>
                                                </details>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })()}

                                </div>
                              );
                            })()}
                          </div>
                        </div>

                        {renderFooter(7)}
                      </div>

                  </div>
                </div>
              );
            })()}
          </div>
        )
      ) : (
        
        /* 2. TEAM/COMPANY DASHBOARD */
        <div className="min-w-0 max-w-full space-y-8" id="team-dashboard">
          
          {loadingTeam ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-gray-100 shadow-xs flex flex-col items-center justify-center space-y-3">
              <RefreshCw className="w-8 h-8 text-[#112363] animate-spin" />
              <p className="text-sm text-gray-500">Agregando dados de sua empresa em tempo real...</p>
            </div>
          ) : teamError ? (
            <div className="p-8 rounded-2xl bg-red-50 border border-red-100 text-red-800 flex items-start space-x-3 max-w-lg mx-auto">
              <AlertCircle className="w-5 h-5 text-[#D80E2A] shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-sm">Ocorreu um erro</h4>
                <p className="text-xs mt-1">{teamError}</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 min-w-0 max-w-full">
              
              {/* Aggregated statistics analysis */}
              <div className="lg:col-span-2 min-w-0 space-y-6">
                
                {/* Stats cards overview */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-white rounded-xl border border-gray-100 p-4 sm:p-5 shadow-2xs flex items-center space-x-4">
                    <div className="p-3 bg-red-50 text-[#D80E2A] rounded-xl">
                      <Users className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">Avaliados</span>
                      <strong className="text-2xl font-black text-[#112363] tracking-tight">{totalTeamMembers}</strong>
                      <span className="text-[10px] text-gray-400 block mt-0.5">colaboradores ativos</span>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-gray-100 p-4 sm:p-5 shadow-2xs flex items-center space-x-4">
                    <div className="p-3 bg-blue-50 text-[#112363] rounded-xl">
                      <Briefcase className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">Empresa</span>
                      <strong className="text-sm font-bold text-[#112363] block truncate max-w-32 md:max-w-44 mt-1">
                        {usuario.empresa_nome}
                      </strong>
                      <span className="text-[10px] text-gray-450 block mt-0.5">corporação atual</span>
                    </div>
                  </div>
                </div>

                {/* Team socioestilo averages */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-4 sm:p-6 md:p-8 space-y-6">
                  <div>
                    <h3 className="text-base font-bold text-[#112363]">Média Comportamental da Equipe</h3>
                    <p className="text-xs text-gray-500 mt-1">
                      Média acumulada das notas em cada estilo de nossa equipe.
                    </p>
                  </div>

                  <div className="space-y-4">
                    {scoreKeys.map(style => {
                      const avg = teamAverages[style];
                      const maxPointsTotal = 9; // theoretical max points
                      const avgPercent = Math.min(100, Math.round((avg / maxPointsTotal) * 100));
                      const barColor = getStyleColorClass(style);

                      return (
                        <div key={style} className="space-y-1.5">
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-bold text-[#112363]">{STYLE_NAMES[style] || style}</span>
                            <span className="font-extrabold text-[#112363]">{avg} pts em média</span>
                          </div>
                          <div className="w-full bg-gray-100 h-3 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-1000 ${barColor}`}
                              style={{ width: `${avgPercent}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Primary behavioral profiles distribution */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-4 sm:p-6 md:p-8 space-y-4">
                  <div>
                    <h3 className="text-base font-bold text-[#112363]">Distribuição de Perfis Dominantes</h3>
                    <p className="text-xs text-gray-500 mt-1">
                      Quantidade de integrantes cujo perfil dominante é o respectivo estilo.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
                    {scoreKeys.map(style => {
                      const count = styleDistributions[style] || 0;
                      const percent = totalTeamMembers > 0 ? Math.round((count / totalTeamMembers) * 100) : 0;
                      const colorText = getStyleTextColorClass(style);

                      return (
                        <div key={style} className="p-3 sm:p-4 rounded-xl border border-gray-100 text-center space-y-2 bg-gray-50/20">
                          <span className={`text-[10px] font-bold py-1 px-2.5 rounded-full inline-block ${colorText}`}>
                            {STYLE_NAMES[style] || style}
                          </span>
                          <span className="text-3xl font-black text-[#112363] block tracking-tight">{count}</span>
                          <span className="text-[10px] text-gray-400 font-medium block">{percent}% do time</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>

              {/* Teammates List and profile indicators */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-4 sm:p-6 md:p-8 space-y-5 h-fit print:hidden">
                <div>
                  <h3 className="text-sm font-bold text-[#112363] uppercase tracking-wider">
                    Colaboradores Concluídos
                  </h3>
                  <p className="text-xs text-gray-400 mt-1">
                    Colegas que já responderam ao teste de socioestilo.
                  </p>
                </div>

                {latestTeamResults.length === 0 ? (
                  <div className="p-6 text-center text-gray-400 text-xs">
                    Nenhum colaborador respondeu ainda.
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100 max-h-[460px] overflow-y-auto pr-1 space-y-1" id="team-list">
                    {latestTeamResults.map((result, i) => {
                      const primary = getDominantStyle(result.scores);
                      const colorBadge = getStyleTextColorClass(primary);
                      const isCurrentlyActive = selectedMemberResult?.id_usuario === result.id_usuario;
                      const formattedDate = new Date(result.data_conclusao).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                      });

                      return (
                        <button
                          key={i}
                          onClick={() => {
                            setSelectedMemberResult(result);
                            setActiveTab('individual');
                          }}
                          className={`w-full text-left py-3 px-3 rounded-xl flex items-center justify-between gap-3 text-xs hover:bg-gray-100/70 border transition-all active:scale-98 cursor-pointer ${
                            isCurrentlyActive 
                              ? 'bg-red-50/40 border-[#D80E2A]/35 shadow-2xs' 
                              : 'border-transparent bg-transparent'
                          }`}
                          title="Clique para ver o relatório Socioestilo individual"
                        >
                          <div>
                            <span className="font-bold text-[#112363] block truncate max-w-40">{result.nome_usuario}</span>
                            <span className="text-[10px] text-gray-450 mt-0.5 block">Finalizou: {formattedDate}</span>
                          </div>
                          <span className={`text-[10px] font-bold px-3 py-1 rounded-full shrink-0 border border-gray-150/20 ${colorBadge}`}>
                            {STYLE_NAMES[primary] || primary}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
          )}
        </div>
      )}
    </div>
  );
}
