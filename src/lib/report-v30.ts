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
export type V30ReportStatus = 'complete' | 'partial' | 'failed' | 'invalid';

export type V30Content =
  | { kind: 'text'; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'structured'; value: Record<string, unknown> };

export interface V30Evidence {
  id?: string;
  trecho?: string;
  referencia?: string;
  [key: string]: unknown;
}

export interface V30UcReference {
  id?: string;
  codigo?: string;
  versao?: string | number;
  [key: string]: unknown;
}

export interface V30Fallback {
  used: boolean;
  source?: string;
  reason?: string;
}

export interface V30Audit {
  [key: string]: unknown;
}

export interface NormalizedV30Element {
  id: V30ReportFieldName;
  title: string;
  content: V30Content | null;
  status: V30FieldStatus;
  enabled: boolean;
  order: number;
  fallback: V30Fallback;
  evidence: V30Evidence[];
  usedUcs: V30UcReference[];
  audit?: V30Audit;
}

export interface PublicV30Element {
  id: V30ReportFieldName;
  title: string;
  content: V30Content | null;
  status: V30FieldStatus;
  enabled: boolean;
  order: number;
  fallback: V30Fallback;
}

export interface V30PublicReport {
  contractVersion: 'V30';
  resultadoId: string;
  relatorioUuid: string;
  elements: PublicV30Element[];
}

export interface V30PrivateAuditEnvelope {
  rawAudit?: V30Audit;
  elements: Pick<NormalizedV30Element, 'id' | 'evidence' | 'usedUcs' | 'audit'>[];
}

export interface NormalizedV30Report {
  contractVersion: 'V30';
  workflowVersion?: string;
  resultadoId: string;
  relatorioUuid: string;
  elements: Record<V30ReportFieldName, NormalizedV30Element>;
  publicReport: V30PublicReport;
  privateAudit: V30PrivateAuditEnvelope;
  reportStatus: Exclude<V30ReportStatus, 'invalid'>;
  reportOutput: Record<string, unknown>;
  persistence: { persisted: boolean; resultado_id: string; relatorio_uuid: string };
}

export interface V30ValidationError {
  path: string;
  code: string;
  message: string;
}

export interface V30ValidationResult {
  valid: boolean;
  errors: V30ValidationError[];
  report?: NormalizedV30Report;
}

type ObjectRecord = Record<string, unknown>;

const isObject = (value: unknown): value is ObjectRecord =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const asObject = (value: unknown): ObjectRecord => isObject(value) ? value : {};

function parseObject(value: unknown): ObjectRecord {
  if (isObject(value)) return value;
  if (typeof value !== 'string') return {};
  try {
    const parsed: unknown = JSON.parse(value);
    return asObject(parsed);
  } catch {
    return {};
  }
}

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const isUuid = (value: unknown): value is string =>
  typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const isCompatibleV30Version = (value: unknown): value is string =>
  typeof value === 'string' && (/^V30$/i.test(value) || /\/v30$/i.test(value));

function getReportOutput(root: ObjectRecord): ObjectRecord {
  const reportData = parseObject(root.report_data);
  if (isObject(root.report_output)) return root.report_output;
  if (isObject(reportData.report_output)) return reportData.report_output;
  return parseObject(root.relatorio_pronto_para_app);
}

function getContractVersion(root: ObjectRecord): unknown {
  const reportData = parseObject(root.report_data);
  const output = getReportOutput(root);
  return root.contractVersion ?? root.contract_version ?? root.schema_version
    ?? reportData.contractVersion ?? reportData.contract_version ?? output.contractVersion ?? output.contract_version;
}

export function isV30ReportCandidate(response: unknown): boolean {
  const root = parseObject(response);
  const reportData = parseObject(root.report_data);
  const version = getContractVersion(root);
  return 'report_output' in root || 'report_output' in reportData
    || isCompatibleV30Version(version);
}

function addError(errors: V30ValidationError[], path: string, code: string, message: string): void {
  errors.push({ path, code, message });
}

function normalizeContent(value: unknown): V30Content | null {
  if (isNonEmptyString(value)) return { kind: 'text', text: value.trim() };
  if (!isObject(value)) return null;
  const text = value.text ?? value.texto ?? value.resumo ?? value.summary;
  const structuredKeys = ['estilo', 'descricao', 'forcas_naturais', 'pontos_fortes', 'pontos_de_atencao', 'itens', 'relacoes', 'acoes'];
  if (isNonEmptyString(text) && !structuredKeys.some(key => key in value)) return { kind: 'text', text: text.trim() };
  const list = value.items ?? value.lista;
  if (Array.isArray(list) && list.every(isNonEmptyString) && list.length > 0) {
    return { kind: 'list', items: list.map(item => item.trim()) };
  }
  return { kind: 'structured', value };
}

function normalizeCollection(value: unknown): ObjectRecord[] | null {
  if (!Array.isArray(value)) return null;
  return value.filter(isObject);
}

function normalizeFallback(value: unknown, path: string, errors: V30ValidationError[]): V30Fallback {
  if (!isObject(value) || typeof value.used !== 'boolean') {
    addError(errors, path, 'invalid_fallback', 'fallback.used deve ser booleano explícito.');
    return { used: false };
  }
  if (value.used && !isNonEmptyString(value.source) && !isNonEmptyString(value.reason)) {
    addError(errors, path, 'fallback_origin_required', 'Fallback usado exige source ou reason.');
  }
  return {
    used: value.used,
    ...(isNonEmptyString(value.source) ? { source: value.source } : {}),
    ...(isNonEmptyString(value.reason) ? { reason: value.reason } : {})
  };
}

function validateScores(output: ObjectRecord, errors: V30ValidationError[]): void {
  const calculated = asObject(output.resultado_calculado);
  const scores = asObject(calculated.scores);
  for (const key of ['assertivo', 'participativo', 'integrador', 'analitico']) {
    const value = scores[key] ?? scores[key[0].toUpperCase() + key.slice(1)];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      addError(errors, `report_output.resultado_calculado.scores.${key}`, 'invalid_score', 'Score obrigatório deve ser numérico, finito e igual ou superior a zero.');
    }
  }
}

function buildNormalized(root: ObjectRecord, output: ObjectRecord, elements: Record<V30ReportFieldName, NormalizedV30Element>, resultadoId: string, relatorioUuid: string): NormalizedV30Report {
  const publicElements = V30_REPORT_FIELDS.map(key => {
    const element = elements[key];
    return { id: element.id, title: element.title, content: element.content, status: element.status, enabled: element.enabled, order: element.order, fallback: element.fallback };
  });
  const enabled = V30_REPORT_FIELDS.map(key => elements[key]).filter(element => element.enabled);
  const generated = enabled.filter(element => element.status === 'generated' && element.content !== null).length;
  const reportStatus: Exclude<V30ReportStatus, 'invalid'> = generated === enabled.length ? 'complete' : generated === 0 ? 'failed' : 'partial';
  const rawAudit = asObject(root.audit ?? root.auditoria);
  return {
    contractVersion: 'V30',
    workflowVersion: isNonEmptyString(root.workflow_version) ? root.workflow_version : undefined,
    resultadoId,
    relatorioUuid,
    elements,
    publicReport: { contractVersion: 'V30', resultadoId, relatorioUuid, elements: publicElements },
    privateAudit: { rawAudit: Object.keys(rawAudit).length > 0 ? rawAudit : undefined, elements: V30_REPORT_FIELDS.map(key => { const e = elements[key]; return { id: e.id, evidence: e.evidence, usedUcs: e.usedUcs, audit: e.audit }; }) },
    reportStatus,
    reportOutput: output,
    persistence: { persisted: true, resultado_id: resultadoId, relatorio_uuid: relatorioUuid }
  };
}

export function validateV30Report(response: unknown): V30ValidationResult {
  const root = parseObject(response);
  const output = getReportOutput(root);
  const errors: V30ValidationError[] = [];
  if (Object.keys(output).length === 0) addError(errors, 'report_output', 'missing_report_output', 'report_output deve existir.');
  const version = getContractVersion(root);
  if (!isCompatibleV30Version(version)) addError(errors, 'contractVersion', 'unsupported_contract', 'contractVersion deve ser compatível com V30.');

  const resultadoIdValue = root.resultado_id ?? root.id_resultado ?? asObject(root.persistence).resultado_id ?? asObject(output.identificacao).resultado_id;
  const uuidValue = root.relatorio_uuid ?? asObject(root.persistence).relatorio_uuid ?? asObject(output.identificacao).relatorio_uuid;
  if (!isNonEmptyString(resultadoIdValue)) addError(errors, 'resultado_id', 'invalid_resultado_id', 'resultado_id deve ser uma string não vazia.');
  if (!isUuid(uuidValue)) addError(errors, 'relatorio_uuid', 'invalid_relatorio_uuid', 'relatorio_uuid deve ser um UUID válido.');

  const rawFields = output.campos_relatorio ?? output.elements;
  const fieldEntries: Array<[string, unknown]> = Array.isArray(rawFields)
    ? rawFields.map(item => [isObject(item) && typeof item.id === 'string' ? item.id : '', item])
    : isObject(rawFields) ? Object.entries(rawFields) : [];
  const seen = new Set<string>();
  const elements = {} as Record<V30ReportFieldName, NormalizedV30Element>;
  for (const key of V30_REPORT_FIELDS) {
    const matches = fieldEntries.filter(([entryKey]) => entryKey === key);
    if (matches.length === 0) {
      addError(errors, `report_output.campos_relatorio.${key}`, 'missing_element', 'Elemento obrigatório ausente.');
      continue;
    }
    if (matches.length > 1 || seen.has(key)) addError(errors, `report_output.campos_relatorio.${key}`, 'duplicate_element', 'Elemento duplicado.');
    seen.add(key);
    const candidate = asObject(matches[0][1]);
    if (candidate.id !== key) addError(errors, `report_output.campos_relatorio.${key}.id`, 'id_key_mismatch', 'id deve corresponder à chave do elemento.');
    if (!isNonEmptyString(candidate.titulo ?? candidate.title)) addError(errors, `report_output.campos_relatorio.${key}.titulo`, 'missing_title', 'Título não pode ser vazio.');
    const status = candidate.status;
    if (status !== 'generated' && status !== 'insufficient_evidence' && status !== 'error') addError(errors, `report_output.campos_relatorio.${key}.status`, 'invalid_status', 'Status não reconhecido.');
    if (typeof candidate.enabled !== 'boolean' && typeof candidate.habilitado !== 'boolean') addError(errors, `report_output.campos_relatorio.${key}.enabled`, 'invalid_enabled', 'enabled/habilitado deve ser booleano explícito.');
    const order = candidate.ordem ?? candidate.order;
    if (typeof order !== 'number' || !Number.isInteger(order)) addError(errors, `report_output.campos_relatorio.${key}.ordem`, 'invalid_order', 'ordem deve ser número inteiro.');
    const content = normalizeContent(candidate.conteudo ?? candidate.content ?? candidate);
    if (status === 'generated' && content === null) addError(errors, `report_output.campos_relatorio.${key}.conteudo`, 'missing_generated_content', 'generated exige conteúdo válido e não vazio.');
    const evidence = normalizeCollection(candidate.evidencias ?? candidate.evidence);
    const ucs = normalizeCollection(candidate.ucs_utilizadas ?? candidate.used_ucs ?? candidate.ucs);
    if (evidence === null) addError(errors, `report_output.campos_relatorio.${key}.evidencias`, 'invalid_evidence', 'evidências devem ser uma coleção.');
    if (ucs === null) addError(errors, `report_output.campos_relatorio.${key}.ucs_utilizadas`, 'invalid_ucs', 'UCs utilizadas devem ser uma coleção.');
    const fallback = normalizeFallback(candidate.fallback, `report_output.campos_relatorio.${key}.fallback`, errors);
    const audit = candidate.auditoria ?? candidate.audit;
    if (audit !== undefined && !isObject(audit)) addError(errors, `report_output.campos_relatorio.${key}.auditoria`, 'invalid_audit', 'auditoria deve ser um objeto.');
    elements[key] = {
      id: key,
      title: String(candidate.titulo ?? candidate.title ?? ''),
      content,
      status: status as V30FieldStatus,
      enabled: candidate.enabled === true || candidate.habilitado === true,
      order: typeof order === 'number' ? order : 0,
      fallback,
      evidence: evidence ?? [],
      usedUcs: ucs ?? [],
      ...(isObject(audit) ? { audit } : {})
    };
  }
  validateScores(output, errors);
  if (errors.length > 0) return { valid: false, errors };
  const report = buildNormalized(root, output, elements, resultadoIdValue as string, uuidValue as string);
  return { valid: true, errors: [], report };
}

export function normalizeV30Report(response: unknown): V30ValidationResult {
  return validateV30Report(response);
}

export function resolveV30Report(response: unknown): { declared: boolean; validation: V30ValidationResult } {
  const root = parseObject(response);
  const nested = parseObject(root.raw_payload);
  const candidate = isV30ReportCandidate(root) ? root : isV30ReportCandidate(nested) ? nested : root;
  const declared = isV30ReportCandidate(root) || isV30ReportCandidate(nested);
  return { declared, validation: declared ? validateV30Report(candidate) : { valid: false, errors: [] } };
}

export function isCompleteV30Report(report: NormalizedV30Report): boolean {
  return report.reportStatus === 'complete';
}

export function resolveV30ReportStatus(report: NormalizedV30Report | V30ValidationResult): V30ReportStatus {
  if ('valid' in report) return report.valid ? report.report?.reportStatus ?? 'invalid' : 'invalid';
  return report.reportStatus;
}

export function v30Scores(report: NormalizedV30Report): Scores | null {
  if (!report || !isObject(report.reportOutput)) return null;
  const scores = asObject(asObject(report.reportOutput.resultado_calculado).scores);
  const values = { Assertivo: scores.assertivo ?? scores.Assertivo, Participativo: scores.participativo ?? scores.Participativo, Integrador: scores.integrador ?? scores.Integrador, Analitico: scores.analitico ?? scores.Analitico };
  return Object.values(values).every(value => typeof value === 'number' && Number.isFinite(value)) ? values as Scores : null;
}

export function v30ToResultado(report: NormalizedV30Report, user: { uid: string; nome: string; empresa_id: string; empresa_nome: string }): Resultado | null {
  const scores = v30Scores(report);
  if (!scores) return null;
  const identification = asObject(report.reportOutput.identificacao);
  return {
    id: report.relatorioUuid,
    id_resultado: report.resultadoId,
    id_usuario: user.uid,
    nome_usuario: isNonEmptyString(identification.nome) ? identification.nome : user.nome,
    empresa_id: isNonEmptyString(identification.empresa_id) ? identification.empresa_id : user.empresa_id,
    empresa_nome: isNonEmptyString(identification.empresa) ? identification.empresa : user.empresa_nome,
    scores,
    data_conclusao: isNonEmptyString(identification.data_conclusao) ? identification.data_conclusao : '',
    generated_at: isNonEmptyString(identification.generated_at) ? identification.generated_at : undefined,
    relatorio_pronto_para_app: report.publicReport,
    metadata: { contract_version: report.contractVersion, workflow_version: report.workflowVersion }
  };
}
