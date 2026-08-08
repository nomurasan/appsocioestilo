import { Scores } from "../types";
import { normalizeV30Report, resolveV30Report, v30Scores } from "./report-v30";

export interface AnalysisPersistenceState {
  persisted: boolean;
  invalidPersistedResponse: boolean;
  invalidV30Response: boolean;
  resultadoId?: string;
  resultadoIdNormalized?: number;
  relatorioUuid?: string;
}

export interface SocioEstiloAnalysisResponse {
  success?: boolean;
  persisted?: boolean;
  report_generated?: boolean;
  status?: string;
  contractVersion?: string;
  contract_version?: string;
  workflow_version?: string;
  resultado_id?: number | string | null;
  id_resultado?: number | string | null;
  id?: number | string | null;
  relatorio_uuid?: string | null;
  report_output?: {
    identificacao?: {
      relatorio_uuid?: string | null;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

export function unwrapAnalysisResponse(
  response: unknown,
): Record<string, unknown> {
  const root = asRecord(response);
  return isRecord(root.data) ? root.data : root;
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizePositiveInteger(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value.trim(),
    )
  );
}

function isV30Contract(payload: Record<string, unknown>): boolean {
  const version = String(
    payload.contractVersion ??
      payload.contract_version ??
      payload.schema_version ??
      "",
  ).toLowerCase();
  if (!version) return false;
  return version === "v30" || version.endsWith("/v30");
}

export function getAnalysisPersistenceState(
  response: unknown,
): AnalysisPersistenceState {
  const payload = unwrapAnalysisResponse(
    response,
  ) as SocioEstiloAnalysisResponse;
  const nestedPersistence = asRecord(payload.persistence);
  const persisted =
    payload.persisted === true || nestedPersistence.persisted === true;
  const reportOutput = asRecord(payload.report_output);
  const identification = asRecord(reportOutput.identificacao);
  const rawResultadoId =
    payload.resultado_id ??
    payload.id_resultado ??
    payload.id ??
    nestedPersistence.resultado_id ??
    identification.resultado_id ??
    null;
  const resultadoIdNormalized = normalizePositiveInteger(rawResultadoId);
  const resultadoId =
    resultadoIdNormalized !== undefined
      ? String(resultadoIdNormalized)
      : undefined;

  const relatorioUuidCandidate = nonEmptyString(
    payload.relatorio_uuid ??
      nestedPersistence.relatorio_uuid ??
      identification.relatorio_uuid,
  );
  const relatorioUuid =
    relatorioUuidCandidate && isUuid(relatorioUuidCandidate)
      ? relatorioUuidCandidate
      : undefined;

  const v30 = resolveV30Report(payload);
  const persistenceConfirmed =
    persisted &&
    (resultadoIdNormalized !== undefined || Boolean(relatorioUuid));
  const invalidV30Response =
    isV30Contract(payload as Record<string, unknown>) &&
    v30.declared &&
    !v30.validation.valid;

  return {
    persisted: persistenceConfirmed,
    invalidPersistedResponse: persisted && !persistenceConfirmed,
    invalidV30Response,
    ...(resultadoId ? { resultadoId } : {}),
    ...(resultadoIdNormalized !== undefined ? { resultadoIdNormalized } : {}),
    ...(relatorioUuid ? { relatorioUuid } : {}),
  };
}

export function getV30ScoresFromAnalysis(response: unknown): Scores | null {
  const validation = normalizeV30Report(unwrapAnalysisResponse(response));
  return validation.valid && validation.report
    ? v30Scores(validation.report)
    : null;
}

export function getReportOutputFromAnalysis(
  response: unknown,
): Record<string, unknown> | null {
  const payload = unwrapAnalysisResponse(response);
  if (isRecord(payload.report_output)) return payload.report_output;
  const reportData = asRecord(payload.report_data);
  if (isRecord(reportData.report_output)) return reportData.report_output;
  if (typeof payload.relatorio_pronto_para_app === "string") {
    try {
      const parsed: unknown = JSON.parse(payload.relatorio_pronto_para_app);
      return isRecord(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return isRecord(payload.relatorio_pronto_para_app)
    ? payload.relatorio_pronto_para_app
    : null;
}

export function getFullReportData(
  response: unknown,
): Record<string, unknown> | null {
  const payload = unwrapAnalysisResponse(response);

  if (isRecord(payload.report_data)) return payload.report_data;

  const rawPayload = asRecord(payload.raw_payload);
  if (isRecord(rawPayload.report_data)) return rawPayload.report_data;

  if (isRecord(payload.relatorio)) return payload.relatorio;
  if (isRecord(rawPayload.relatorio)) return rawPayload.relatorio;

  return null;
}

export function hasRichSocioEstiloReport(value: unknown): boolean {
  if (!isRecord(value)) return false;

  return (
    isRecord(value.resultado) &&
    isRecord(value.narrativa) &&
    isRecord(value.dinamica_dos_estilos) &&
    isRecord(value.memoria_calculo) &&
    isRecord(value.auditoria)
  );
}
