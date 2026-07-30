import { Resultado, Scores } from '../types';

export const V30_REPORT_FIELDS = [
  'perfil_predominante',
  'perfil_secundario',
  'lado_luz',
  'lado_sombra',
  'estilo_a_desenvolver',
  'relacoes_entre_estilos',
  'recomendacoes'
] as const;

export type V30ReportFieldName = typeof V30_REPORT_FIELDS[number];
export type V30FieldStatus = 'generated' | 'insufficient_evidence' | 'error';

export interface ReportFieldV30 {
  status: V30FieldStatus;
  texto?: string;
  resumo?: string;
  estilo?: string | null;
  lista?: string[];
  evidencias?: unknown[];
  ucs_utilizadas?: unknown[];
  [key: string]: unknown;
}

export interface ReportOutputV30 {
  identificacao: Record<string, any>;
  resultado_calculado: {
    scores?: Record<string, number>;
    ranking?: unknown[];
    total_pontos?: number;
    [key: string]: unknown;
  };
  campos_relatorio: Partial<Record<V30ReportFieldName, ReportFieldV30>>;
  variaveis_template?: Record<string, unknown>;
}

export interface NormalizedV30Report {
  contractVersion: string;
  workflowVersion?: string;
  reportOutput: ReportOutputV30;
  persistence: { persisted: boolean; resultado_id?: string; relatorio_uuid?: string };
  reportGenerated: boolean;
  visibility?: Record<string, boolean>;
  rawAudit?: Record<string, unknown>;
}

function asObject(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
}

function parseObject(value: unknown): Record<string, any> {
  if (typeof value !== 'string') return asObject(value);
  try { return asObject(JSON.parse(value)); } catch { return {}; }
}

function hasValidField(field: unknown): field is ReportFieldV30 {
  const candidate = asObject(field);
  return ['generated', 'insufficient_evidence', 'error'].includes(candidate.status)
    && (candidate.status !== 'generated' || Boolean(candidate.texto || candidate.resumo || candidate.lista));
}

/** Canonical V30 adapter. Legacy payloads are deliberately not promoted here. */
export function normalizeV30Report(response: unknown): NormalizedV30Report | null {
  const root = parseObject(response);
  const compatibility = parseObject(root.report_data);
  const output = asObject(root.report_output || compatibility.report_output);
  const contractVersion = String(root.contract_version || root.schema_version || compatibility.contract_version || '');

  if (!contractVersion.toLowerCase().includes('v30') && !contractVersion.includes('socioestilo-report/')) return null;

  const campos = asObject(output.campos_relatorio);
  const validFields: Partial<Record<V30ReportFieldName, ReportFieldV30>> = {};
  for (const key of V30_REPORT_FIELDS) {
    if (hasValidField(campos[key])) validFields[key] = campos[key] as ReportFieldV30;
  }

  const persistence = asObject(root.persistence);
  const reportGenerated = root.report_generated === true
    && V30_REPORT_FIELDS.every(key => hasValidField(campos[key]));
  const persisted = persistence.persisted === true
    && Boolean(persistence.resultado_id || persistence.relatorio_uuid);

  return {
    contractVersion,
    workflowVersion: String(root.workflow_version || compatibility.workflow_version || '') || undefined,
    reportOutput: {
      identificacao: asObject(output.identificacao),
      resultado_calculado: asObject(output.resultado_calculado),
      campos_relatorio: validFields,
      variaveis_template: asObject(output.variaveis_template)
    },
    persistence: {
      persisted,
      resultado_id: persistence.resultado_id,
      relatorio_uuid: persistence.relatorio_uuid
    },
    reportGenerated,
    visibility: asObject(root.resolved_visibility || root.visibility_config),
    rawAudit: asObject(root.audit || root.auditoria)
  };
}

export function v30Scores(report: NormalizedV30Report): Scores | null {
  const raw = asObject(report.reportOutput.resultado_calculado.scores);
  const values = {
    Assertivo: raw.assertivo,
    Participativo: raw.participativo,
    Integrador: raw.integrador,
    Analitico: raw.analitico
  };
  if (Object.values(values).some(value => typeof value !== 'number' || !Number.isFinite(value))) return null;
  return values as Scores;
}

export function v30ToResultado(report: NormalizedV30Report, user: { uid: string; nome: string; empresa_id: string; empresa_nome: string }): Resultado {
  const scores = v30Scores(report) || { Assertivo: 0, Participativo: 0, Integrador: 0, Analitico: 0 };
  const identification = report.reportOutput.identificacao;
  return {
    id: report.persistence.relatorio_uuid || report.persistence.resultado_id,
    id_resultado: report.persistence.resultado_id || report.persistence.relatorio_uuid,
    id_usuario: user.uid,
    nome_usuario: identification.nome || user.nome,
    empresa_id: String(identification.empresa_id || user.empresa_id),
    empresa_nome: identification.empresa || user.empresa_nome,
    scores,
    data_conclusao: identification.data_conclusao || identification.generated_at || new Date().toISOString(),
    generated_at: identification.generated_at,
    relatorio_pronto_para_app: report.reportOutput,
    metadata: { contract_version: report.contractVersion, workflow_version: report.workflowVersion },
    raw_payload: report.rawAudit
  };
}
