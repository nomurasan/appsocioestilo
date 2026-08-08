/**
 * Normalizar resposta do webhook n8n para estrutura canônica
 * Fonte principal para o contrato público: response.report_output
 * Fallbacks legados: response.report_data, response.metadata, response.assessment, response.persistence
 *
 * Estrutura esperada de memoria_respostas:
 * [{
 *   questionId: number,
 *   question: string,
 *   answer: string,
 *   socioStyle: string,
 *   points: number
 * }]
 */
export function normalizeReportResponse(response: any): {
  success: boolean;
  reportGenerated: boolean;
  persisted: boolean;
  reportOutput?: any;
  reportData: any;
  summary: string;
  metadata: any;
  assessment: any;
  persistence: any;
} {
  // Validação básica
  const success = response?.success === true;
  const reportGenerated = response?.report_generated === true;
  const persisted = response?.persisted === true;

  const parseIfNeeded = (value: any) => {
    if (typeof value !== "string") return value;
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  };

  // Extrair contrato público primeiro, mantendo report_data como fallback rico
  const reportOutput = parseIfNeeded(
    response?.report_output || response?.report_data?.report_output || {},
  );
  const reportData = parseIfNeeded(response?.report_data || {});

  // Extrair identificação
  const identificacao = reportData.identificacao || response?.metadata || {};
  const metadata = {
    userId: identificacao.usuario_id || response?.metadata?.userId,
    userName: identificacao.nome || response?.metadata?.userName,
    companyId: identificacao.empresa_id || response?.metadata?.companyId,
    companyName: identificacao.empresa || response?.metadata?.companyName,
    completedAt:
      identificacao.data_conclusao || response?.metadata?.completedAt,
    generatedAt: identificacao.generated_at || response?.metadata?.generatedAt,
  };

  // Extrair resultado/scores
  const resultado = reportData.resultado || response?.assessment || {};
  const assessment = {
    scores: resultado.scores || response?.assessment?.scores || {},
    ranking: resultado.ranking || response?.assessment?.ranking || [],
    totalPoints:
      resultado.total_pontos || response?.assessment?.totalPoints || 0,
    dominantProfile:
      resultado.perfil_dominante || response?.assessment?.dominantProfile,
    secondaryProfile:
      resultado.perfil_secundario || response?.assessment?.secondaryProfile,
    thirdProfile:
      resultado.perfil_terciario || response?.assessment?.thirdProfile,
    lowestProfile:
      resultado.perfil_menos_utilizado || response?.assessment?.lowestProfile,
  };

  // Extrair narrativa/resumo para summary
  const narrativa = reportData.narrativa || {};
  const summary =
    reportOutput?.campos_relatorio?.recomendacoes?.conteudo?.texto ||
    reportOutput?.campos_relatorio?.perfil_predominante?.conteudo?.resumo ||
    reportOutput?.campos_relatorio?.perfil_predominante?.conteudo?.texto ||
    narrativa.parecer_executivo ||
    narrativa.resumo ||
    narrativa.insights ||
    response?.assessment?.summary ||
    "Seu relatório de Socioestilo foi gerado com sucesso.";

  // Extrair persistência
  const persistence = response?.persistence || {
    persisted: persisted,
    timestamp: new Date().toISOString(),
  };

  return {
    success,
    reportGenerated,
    persisted,
    reportOutput,
    reportData,
    summary,
    metadata,
    assessment,
    persistence,
  };
}

/**
 * Extrair apenas o resumo da resposta do webhook
 */
export function extractReportSummary(response: any): string {
  const reportOutput =
    response?.report_output || response?.report_data?.report_output || {};
  const reportData = response?.report_data || {};
  const narrativa = reportData.narrativa || {};

  return (
    reportOutput?.campos_relatorio?.recomendacoes?.conteudo?.texto ||
    reportOutput?.campos_relatorio?.perfil_predominante?.conteudo?.resumo ||
    reportOutput?.campos_relatorio?.perfil_predominante?.conteudo?.texto ||
    narrativa.parecer_executivo ||
    narrativa.resumo ||
    narrativa.insights ||
    response?.assessment?.summary ||
    "Seu relatório de Socioestilo foi gerado com sucesso."
  );
}
