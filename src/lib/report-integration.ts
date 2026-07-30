import { Scores } from '../types';
import { normalizeV30Report, v30Scores } from './report-v30';

export interface AnalysisPersistenceState {
  persisted: boolean;
  invalidPersistedResponse: boolean;
  resultadoId?: string;
  relatorioUuid?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

export function unwrapAnalysisResponse(response: unknown): Record<string, unknown> {
  const root = asRecord(response);
  return isRecord(root.data) ? root.data : root;
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function getAnalysisPersistenceState(response: unknown): AnalysisPersistenceState {
  const payload = unwrapAnalysisResponse(response);
  const persisted = payload.persisted === true;
  const resultadoId = nonEmptyString(payload.resultado_id);
  const relatorioUuid = nonEmptyString(payload.relatorio_uuid);
  return {
    persisted: persisted && Boolean(resultadoId || relatorioUuid),
    invalidPersistedResponse: persisted && !resultadoId && !relatorioUuid,
    ...(resultadoId ? { resultadoId } : {}),
    ...(relatorioUuid ? { relatorioUuid } : {})
  };
}

export function getV30ScoresFromAnalysis(response: unknown): Scores | null {
  const validation = normalizeV30Report(unwrapAnalysisResponse(response));
  return validation.valid && validation.report ? v30Scores(validation.report) : null;
}

export function getReportOutputFromAnalysis(response: unknown): Record<string, unknown> | null {
  const payload = unwrapAnalysisResponse(response);
  if (isRecord(payload.report_output)) return payload.report_output;
  const reportData = asRecord(payload.report_data);
  return isRecord(reportData.report_output) ? reportData.report_output : null;
}
