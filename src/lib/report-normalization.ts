/**
 * Normalizar resposta do webhook n8n para estrutura canônica
 * Fonte principal: response.report_data
 * Fallbacks: response.metadata, response.assessment, response.persistence
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

  // Extrair report_data como fonte principal
  const reportData = response?.report_data || {};

  // Extrair identificação
  const identificacao = reportData.identificacao || response?.metadata || {};
  const metadata = {
    userId: identificacao.usuario_id || response?.metadata?.userId,
    userName: identificacao.nome || response?.metadata?.userName,
    companyId: identificacao.empresa_id || response?.metadata?.companyId,
    companyName: identificacao.empresa || response?.metadata?.companyName,
    completedAt: identificacao.data_conclusao || response?.metadata?.completedAt,
    generatedAt: identificacao.generated_at || response?.metadata?.generatedAt
  };

  // Extrair resultado/scores
  const resultado = reportData.resultado || response?.assessment || {};
  const assessment = {
    scores: resultado.scores || response?.assessment?.scores || {},
    ranking: resultado.ranking || response?.assessment?.ranking || [],
    totalPoints: resultado.total_pontos || response?.assessment?.totalPoints || 0,
    dominantProfile: resultado.perfil_dominante || response?.assessment?.dominantProfile,
    secondaryProfile: resultado.perfil_secundario || response?.assessment?.secondaryProfile,
    thirdProfile: resultado.perfil_terciario || response?.assessment?.thirdProfile,
    lowestProfile: resultado.perfil_menos_utilizado || response?.assessment?.lowestProfile
  };

  // Extrair narrativa/resumo para summary
  const narrativa = reportData.narrativa || {};
  const summary =
    narrativa.parecer_executivo ||
    narrativa.resumo ||
    narrativa.insights ||
    response?.assessment?.summary ||
    "Seu relatório de Socioestilo foi gerado com sucesso.";

  // Extrair persistência
  const persistence = response?.persistence || {
    persisted: persisted,
    timestamp: new Date().toISOString()
  };

  return {
    success,
    reportGenerated,
    persisted,
    reportData,
    summary,
    metadata,
    assessment,
    persistence
  };
}

/**
 * Extrair apenas o resumo da resposta do webhook
 */
export function extractReportSummary(response: any): string {
  const reportData = response?.report_data || {};
  const narrativa = reportData.narrativa || {};

  return (
    narrativa.parecer_executivo ||
    narrativa.resumo ||
    narrativa.insights ||
    response?.assessment?.summary ||
    "Seu relatório de Socioestilo foi gerado com sucesso."
  );
}
