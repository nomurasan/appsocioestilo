import { Resultado } from '../types';
import { getFullReportData } from './report-integration';
import { resolveV30Report, V30Content, V30PublicReport, V30ReportFieldName } from './report-v30';

export interface ReportTextFieldView {
  id: string;
  title: string;
  style?: string;
  text: string;
  status: 'generated' | 'insufficient_evidence' | 'error';
  enabled: boolean;
}

export interface RelationsView extends ReportTextFieldView {
  combinations: string[];
  practicalSituations: string[];
  cautions: string[];
  opportunities: string[];
}

export interface TalentPotentializationView {
  baseStyle: string;
  identifiedTalent: string;
  generatedValue: string;
  idealContexts: string[];
  strategies: string[];
  balancePoint: string;
}

export interface PdiObjectiveView {
  objective: string;
  expectedBenefit: string;
}

export interface PdiActionView {
  action: string;
  frequency: string;
  indicator: string;
  suggestedDeadline: string;
}

export interface PdiView {
  priorityObjectives: PdiObjectiveView[];
  actionPlan: PdiActionView[];
  evolutionIndicators: string[];
  developmentCommitment: string;
}

export interface RecommendationsView extends ReportTextFieldView {
  list: string[];
  talentPotentialization: TalentPotentializationView;
  pdi: PdiView;
  firstSteps: string[];
}

export interface ReportV36ViewModel {
  identification: {
    name: string;
    company: string;
    generatedAt: string;
    reportUuid: string;
  };
  ranking: Array<{
    position: number;
    role: 'Dominante' | 'Auxiliar' | 'Terciário' | 'Adjacente';
    style: string;
    points: number;
    percentage: number;
  }>;
  fields: {
    predominant: ReportTextFieldView;
    secondary: ReportTextFieldView;
    light: ReportTextFieldView;
    shadow: ReportTextFieldView;
    development: ReportTextFieldView;
    relations: RelationsView;
    recommendations: RecommendationsView;
  };
  memory: unknown;
  ragAudit: unknown;
}

type ObjectRecord = Record<string, unknown>;

const ROLE_LABELS = ['Dominante', 'Auxiliar', 'Terciário', 'Adjacente'] as const;

function isRecord(value: unknown): value is ObjectRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function asRecord(value: unknown): ObjectRecord {
  return isRecord(value) ? value : {};
}

function asString(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

function asList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(item => asString(item)).filter(Boolean);
}

function normalizeStyleName(value: unknown): string {
  const text = asString(value);
  if (!text) return '';
  const normalized = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (normalized.includes('conservador')) return 'Integrador';
  return text === 'Analitico' ? 'Analítico' : text;
}

function isV30Content(value: unknown): value is V30Content {
  return isRecord(value) && typeof value.kind === 'string';
}

function contentText(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string' || typeof value === 'number') return asString(value);
  if (Array.isArray(value)) return value.map(asString).filter(Boolean).join('\n');
  if (isV30Content(value)) {
    if (value.kind === 'text') return asString(value.text);
    if (value.kind === 'list') return value.items.map(asString).filter(Boolean).join('\n');
    return contentText(value.value);
  }
  if (!isRecord(value)) return '';
  return asString(value.text ?? value.texto ?? value.resumo ?? value.summary ?? value.descricao ?? value.title ?? value.titulo);
}

function contentList(value: unknown, preferredKeys: string[] = []): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return asList(value);
  if (isV30Content(value)) {
    if (value.kind === 'list') return asList(value.items);
    if (value.kind === 'structured') return contentList(value.value, preferredKeys);
    return [];
  }
  if (!isRecord(value)) return [];
  for (const key of preferredKeys) {
    const list = asList(value[key]);
    if (list.length > 0) return list;
  }
  return [];
}

function unwrapStructuredObject(value: unknown): ObjectRecord {
  if (isV30Content(value)) {
    if (value.kind === 'structured') return asRecord(value.value);
    if (value.kind === 'list') return { items: value.items };
    return { text: value.text };
  }
  return asRecord(value);
}

function pickObject(...values: unknown[]): ObjectRecord {
  for (const value of values) {
    if (isRecord(value) && Object.keys(value).length > 0) return value;
  }
  return {};
}

function getReportOutputPublic(report: any): V30PublicReport | null {
  const resolution = resolveV30Report(report);
  return resolution.declared && resolution.validation.valid && resolution.validation.report
    ? resolution.validation.report.publicReport
    : null;
}

function getPublicElement(report: any, fieldId: V30ReportFieldName): ObjectRecord {
  const publicReport = getReportOutputPublic(report);
  if (!publicReport) return {};
  return asRecord(publicReport.elements.find(element => element.id === fieldId));
}

function buildTextField(id: string, title: string, source: unknown, fallback: unknown = null): ReportTextFieldView {
  const sourceRecord = isRecord(source) ? source : {};
  const fieldStatus = asString(sourceRecord.status) as ReportTextFieldView['status'];
  const enabled = sourceRecord.enabled !== false;
  const content = sourceRecord.content ?? sourceRecord.conteudo ?? fallback;
  const text = contentText(content) || contentText(sourceRecord) || contentText(fallback);
  const status = fieldStatus === 'generated' || fieldStatus === 'insufficient_evidence' || fieldStatus === 'error'
    ? fieldStatus
    : text ? 'generated' : 'insufficient_evidence';

  return {
    id,
    title,
    text,
    status,
    enabled,
    ...(asString(sourceRecord.style) ? { style: asString(sourceRecord.style) } : {})
  };
}

function buildRelationsView(report: any, reportData: ObjectRecord, reportNarrativa: ObjectRecord): RelationsView {
  const source = pickObject(
    getPublicElement(report, 'relacoes_entre_estilos'),
    asRecord(reportData.relacoes_entre_estilos),
    asRecord(reportData.dinamica_dos_estilos),
    asRecord(reportNarrativa.relacoes_entre_estilos),
    asRecord(reportNarrativa.dinamica_dos_estilos)
  );

  const structured = unwrapStructuredObject(source.content ?? source.conteudo ?? source);
  const text = contentText(structured.text ?? structured.texto ?? structured.resumo ?? source) || contentText(source);
  const combinations = contentList(structured.combinacoes_analisadas ?? structured.combinacoes ?? structured.relacoes ?? source.combinacoes_analisadas ?? source.combinacoes, ['combinacoes_analisadas', 'combinacoes', 'casos', 'exemplos']);
  const practicalSituations = contentList(structured.situacoes_praticas ?? structured.situacoes ?? structured.casos ?? structured.exemplos ?? source.situacoes_praticas ?? source.casos, ['situacoes_praticas', 'situacoes', 'casos', 'exemplos']);
  const cautions = contentList(structured.cuidados ?? structured.pontos_de_atencao ?? source.cuidados ?? source.pontos_de_atencao, ['cuidados', 'pontos_de_atencao']);
  const opportunities = contentList(structured.oportunidades ?? source.oportunidades, ['oportunidades']);

  return {
    id: 'relacoes_entre_estilos',
    title: 'Relações entre Estilos',
    text,
    status: text || combinations.length || practicalSituations.length || cautions.length || opportunities.length ? 'generated' : 'insufficient_evidence',
    enabled: source.enabled !== false,
    combinations,
    practicalSituations,
    cautions,
    opportunities,
    ...(asString(source.style) ? { style: asString(source.style) } : {})
  };
}

function buildRecommendationsView(report: any, reportData: ObjectRecord, reportResultado: ObjectRecord): RecommendationsView {
  const source = pickObject(
    getPublicElement(report, 'recomendacoes'),
    asRecord(reportData.recomendacoes),
    asRecord(reportData.recomendacoes_praticas),
    asRecord(reportData.potencializacao_talentos),
    asRecord(reportData.pdi)
  );

  const structured = unwrapStructuredObject(source.content ?? source.conteudo ?? source);
  const text = contentText(structured.text ?? structured.texto ?? structured.resumo ?? source);
  const list = contentList(structured.lista ?? structured.recomendacoes ?? source.lista ?? source.recomendacoes, ['lista', 'recomendacoes', 'items']);
  const firstSteps = contentList(structured.primeiros_passos ?? source.primeiros_passos, ['primeiros_passos']);

  const talentSource = pickObject(structured.potencializacao_talentos, source.potencializacao_talentos, reportData.potencializacao_talentos);
  const pdiSource = pickObject(structured.plano_desenvolvimento_individual, structured.pdi, source.plano_desenvolvimento_individual, reportData.pdi);
  const dominantProfile = asRecord(reportResultado.perfil_dominante);

  const talentPotentialization: TalentPotentializationView = {
    baseStyle: asString(talentSource['estilo_base'] ?? talentSource['base_style'] ?? talentSource['estilo']) || normalizeStyleName(dominantProfile.estilo ?? reportResultado.perfil_dominante),
    identifiedTalent: asString(talentSource.talento_identificado ?? talentSource.talento ?? talentSource.descricao_legada),
    generatedValue: asString(talentSource.valor_gerado ?? talentSource.valor ?? talentSource.descricao ?? talentSource.texto),
    idealContexts: contentList(talentSource.contextos_ideais ?? talentSource.contextos ?? talentSource.cenarios, ['contextos_ideais', 'contextos', 'cenarios']),
    strategies: contentList(talentSource.estrategias_potencializacao ?? talentSource.estrategias ?? talentSource.acoes_legadas, ['estrategias_potencializacao', 'estrategias', 'acoes_legadas']),
    balancePoint: asString(talentSource.ponto_equilibrio ?? talentSource.equilibrio ?? talentSource.ponto_de_equilibrio)
  };

  const pdi: PdiView = {
    priorityObjectives: Array.isArray(pdiSource.objetivos_prioritarios)
      ? pdiSource.objetivos_prioritarios.map((item: unknown) => ({
          objective: asString((item as ObjectRecord).objetivo ?? (item as ObjectRecord).texto ?? (item as ObjectRecord).title),
          expectedBenefit: asString((item as ObjectRecord).beneficio_esperado ?? (item as ObjectRecord).beneficio ?? (item as ObjectRecord).resultado ?? (item as ObjectRecord).descricao)
        })).filter(item => item.objective.length > 0)
      : [],
    actionPlan: Array.isArray(pdiSource.plano_acao)
      ? pdiSource.plano_acao.map((item: unknown) => ({
          action: asString((item as ObjectRecord).acao ?? (item as ObjectRecord).texto ?? (item as ObjectRecord).title),
          frequency: asString((item as ObjectRecord).frequencia ?? (item as ObjectRecord).periodicidade),
          indicator: asString((item as ObjectRecord).indicador ?? (item as ObjectRecord).medida),
          suggestedDeadline: asString((item as ObjectRecord).prazo_sugerido ?? (item as ObjectRecord).prazo)
        })).filter(item => item.action.length > 0)
      : [],
    evolutionIndicators: contentList(pdiSource.indicadores_evolucao ?? structured.indicadores_evolucao ?? source.indicadores_evolucao, ['indicadores_evolucao']),
    developmentCommitment: asString(pdiSource.compromisso_desenvolvimento ?? structured.compromisso_desenvolvimento ?? source.compromisso_desenvolvimento)
  };

  return {
    id: 'recomendacoes',
    title: 'Recomendações',
    text,
    status: text || list.length || firstSteps.length || pdi.priorityObjectives.length || pdi.actionPlan.length || pdi.evolutionIndicators.length || pdi.developmentCommitment ? 'generated' : 'insufficient_evidence',
    enabled: source.enabled !== false,
    list,
    talentPotentialization,
    pdi,
    firstSteps,
    ...(asString(source.style) ? { style: asString(source.style) } : {})
  };
}

function toNumber(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildRanking(report: any, reportData: ObjectRecord): ReportV36ViewModel['ranking'] {
  const assessment = pickObject(report?.assessment, reportData?.resultado, report?.report_data?.resultado);
  const rawRanking = Array.isArray(report?.ranking) ? report.ranking : Array.isArray(assessment.ranking) ? assessment.ranking : [];
  if (rawRanking.length > 0) {
    return rawRanking.map((item: unknown, index: number) => {
      const record = asRecord(item);
      const style = normalizeStyleName(record.style ?? record.estilo ?? record.nome ?? record.title);
      const points = toNumber(record.score ?? record.points ?? record.pontos ?? record.pontuacao);
      const percentage = toNumber(record.percentage ?? record.percentual);
      return {
        position: toNumber(record.position ?? record.posicao ?? record['posição'] ?? (index + 1)) || (index + 1),
        role: ROLE_LABELS[index] || 'Adjacente',
        style,
        points,
        percentage
      };
    });
  }

  const scores = asRecord(assessment.scores);
  const ordered = [
    { role: 'Dominante' as const, style: 'Assertivo', points: toNumber(scores.Assertivo ?? scores.assertivo), position: 1 },
    { role: 'Auxiliar' as const, style: 'Participativo', points: toNumber(scores.Participativo ?? scores.participativo), position: 2 },
    { role: 'Terciário' as const, style: 'Integrador', points: toNumber(scores.Integrador ?? scores.integrador), position: 3 },
    { role: 'Adjacente' as const, style: 'Analítico', points: toNumber(scores.Analitico ?? scores.analitico), position: 4 }
  ].map(item => ({ ...item, style: normalizeStyleName(item.style) }));
  const total = ordered.reduce((sum, item) => sum + item.points, 0) || 1;
  return ordered
    .sort((a, b) => b.points - a.points)
    .map((item, index) => ({ ...item, position: index + 1, percentage: Math.round((item.points / total) * 100) }));
}

function extractV30Field(report: any, fieldId: V30ReportFieldName): ObjectRecord {
  const publicReport = getReportOutputPublic(report);
  if (!publicReport) return {};
  return asRecord(publicReport.elements.find(element => element.id === fieldId));
}

export function buildReportV36ViewModel(response: unknown): ReportV36ViewModel {
  const root = asRecord(response);
  const rawPayload = asRecord(root.raw_payload);
  const reportData = pickObject(root.report_data, rawPayload.report_data, getFullReportData(root));
  const reportResultado = asRecord(reportData.resultado);
  const reportNarrativa = asRecord(reportData.narrativa);
  const reportDinamica = asRecord(reportData.dinamica_dos_estilos);
  const reportAuditoria = asRecord(reportData.auditoria);
  const normalizedReport = resolveV30Report(root);
  const v30Report = normalizedReport.declared && normalizedReport.validation.valid && normalizedReport.validation.report ? normalizedReport.validation.report : null;
  const sourceReport = v30Report || null;

  const identification = pickObject(
    asRecord(sourceReport?.reportOutput?.identificacao),
    asRecord(reportData.identificacao),
    asRecord(root.metadata),
    asRecord(root.assessment)
  );

  const resultRanking = buildRanking(root, reportData);
  const publicField = (fieldId: V30ReportFieldName, title: string, legacyFallback: unknown = null): ReportTextFieldView => {
    const source = extractV30Field(root, fieldId);
    const fallback = legacyFallback ?? reportResultado[fieldId] ?? reportData[fieldId];
    return buildTextField(fieldId, title, source, fallback);
  };

  return {
    identification: {
      name: asString(identification.nome ?? identification.userName ?? identification.name),
      company: asString(identification.empresa ?? identification.companyName ?? identification.company),
      generatedAt: asString(identification.generated_at ?? identification.generatedAt ?? identification.completedAt),
      reportUuid: asString(root.relatorio_uuid ?? root.relatorioUuid ?? root.id ?? sourceReport?.relatorioUuid)
    },
    ranking: resultRanking,
    fields: {
      predominant: publicField('perfil_predominante', 'Perfil Predominante', reportResultado.perfil_dominante ?? reportData.perfil_dominante),
      secondary: publicField('perfil_secundario', 'Perfil Secundário', reportResultado.perfil_secundario ?? reportData.perfil_secundario),
      light: publicField('lado_luz', 'Quando você atua no seu melhor', reportDinamica.lado_luz ?? reportData.lado_luz),
      shadow: publicField('lado_sombra', 'Quando o excesso pode limitar seus resultados', reportDinamica.lado_sombra ?? reportData.lado_sombra),
      development: publicField('estilo_a_desenvolver', 'Estilo a Desenvolver', reportDinamica.estilo_a_desenvolver ?? reportData.estilo_a_desenvolver),
      relations: buildRelationsView(root, reportData, reportNarrativa),
      recommendations: buildRecommendationsView(root, reportData, reportResultado)
    },
    memory: reportData.memoria_calculo ?? reportData.memoria ?? null,
    ragAudit: reportAuditoria.trilha_rag ?? reportData.auditoria ?? reportData.chunk_content_audit ?? null
  };
}