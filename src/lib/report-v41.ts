export type SocioEstilo =
  | "Assertivo"
  | "Participativo"
  | "Integrador"
  | "Analítico";

export type PapelRanking =
  | "Dominante"
  | "Secundário"
  | "Terciário"
  | "Adjacente";

export interface RankingItemV41 {
  ordem: number;
  perfil: SocioEstilo | string;
  papel: PapelRanking | string;
  score: number;
  percentual?: number;
}

export interface ReportSubitemV41 {
  id_unidade?: string | null;
  ordem: number;
  titulo: string;
  conteudo: string;
  perfil_principal?: string | null;
  perfil_relacionado?: string | null;
}

export interface ReportRelationV41 {
  ordem: number;
  titulo: string;
  perfil_principal: string;
  perfil_relacionado: string;
  status: string;
  subitens: ReportSubitemV41[];
  unidades_utilizadas?: string[];
}

export interface ReportSectionV41 {
  codigo: string;
  titulo: string;
  ordem: number;
  tipo?: string;
  perfil?: string | null;
  status?: string;
  subitens?: ReportSubitemV41[];
  relacoes?: ReportRelationV41[];
  dados?: Record<string, unknown>;
}

export interface ReportVariantV41 {
  versao: string;
  tipo: "sintetico" | "detalhado";
  estrategia: string;
  secoes: ReportSectionV41[];
}

export interface AuditUnitV41 {
  id_unidade: string;
  descricao: string;
  conteudo?: string;
  campo_relatorio_principal?: string;
  ordem_subitem?: number;
  subitem_relatorio?: string;
  perfil_principal?: string | null;
  perfil_relacionado?: string | null;
}

export interface ReportOutputV41 {
  contractVersion: "V41" | "V42" | "V43";
  contract_version: string;
  workflow_version: string;
  report_version: string;
  identificacao: Record<string, unknown>;
  resultado_calculado: {
    perfil_dominante: string;
    perfil_secundario: string;
    perfil_terciario: string;
    perfil_adjacente: string;
    lado_luz: string;
    lado_sombra: string;
    estilo_a_desenvolver: string;
    total_pontos: number;
    scores: Record<string, number>;
    ranking: RankingItemV41[];
  };
  visao_geral: {
    versao: string;
    secoes: ReportSectionV41[];
  };
  relatorio_sintetico?: ReportVariantV41;
  relatorio_detalhado?: ReportVariantV41;
  memoria_calculo: Record<string, unknown>;
  auditoria: {
    unidades_utilizadas: AuditUnitV41[];
    total_unidades_utilizadas?: number;
  };
}

export interface ReportV41Validation {
  valid: boolean;
  warnings: string[];
  errors: string[];
}

export interface ReportVariantViewModelV41 {
  variantLabel: "Relatório Sintético" | "Relatório Analítico";
  variantKey: "sintetico" | "detalhado";
  identificacao: Record<string, unknown>;
  resultadoCalculado: ReportOutputV41["resultado_calculado"];
  sections: ReportSectionV41[];
  memoriaCalculo: Record<string, unknown>;
  auditoria: ReportOutputV41["auditoria"];
  output: ReportOutputV41;
  validation: ReportV41Validation;
}

type ObjectRecord = Record<string, unknown>;

function isRecord(value: unknown): value is ObjectRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function asRecord(value: unknown): ObjectRecord {
  return isRecord(value) ? value : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function asNumber(value: unknown): number {
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : 0;
}

function normalizePapel(value: unknown, index = 0): string {
  const raw = asString(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (raw.includes("domin")) return "Dominante";
  if (raw.includes("secund") || raw.includes("auxiliar")) return "Secundário";
  if (raw.includes("terci")) return "Terciário";
  if (raw.includes("adj")) return "Adjacente";
  const fallback = ["Dominante", "Secundário", "Terciário", "Adjacente"];
  return fallback[index] || "Adjacente";
}

function normalizeSubitem(value: unknown, index = 0): ReportSubitemV41 {
  const raw = asRecord(value);
  return {
    id_unidade: asString(raw.id_unidade || raw.id || raw.codigo) || null,
    ordem: asNumber(raw.ordem ?? index + 1) || index + 1,
    titulo: asString(
      raw.titulo ||
        raw.subitem_relatorio ||
        raw.campo_relatorio_principal ||
        `Subitem ${index + 1}`,
    ),
    conteudo: asString(
      raw.conteudo || raw.conteudo_relatorio || raw.texto || raw.text,
    ),
    perfil_principal: asString(raw.perfil_principal) || null,
    perfil_relacionado: asString(raw.perfil_relacionado) || null,
  };
}

function normalizeSubitens(value: unknown): ReportSubitemV41[] {
  return asArray(value)
    .map((item, index) => normalizeSubitem(item, index))
    .sort((a, b) => a.ordem - b.ordem);
}

function normalizeRelation(value: unknown, index = 0): ReportRelationV41 {
  const raw = asRecord(value);
  return {
    ordem: asNumber(raw.ordem ?? index + 1) || index + 1,
    titulo: asString(raw.titulo || `Relação ${index + 1}`),
    perfil_principal: asString(raw.perfil_principal || raw.perfil_dominante),
    perfil_relacionado: asString(raw.perfil_relacionado || raw.outro_perfil),
    status: asString(raw.status) || "generated",
    subitens: normalizeSubitens(raw.subitens),
    unidades_utilizadas: asArray(raw.unidades_utilizadas)
      .map((item) => asString(item))
      .filter(Boolean),
  };
}

function normalizeSection(value: unknown, index = 0): ReportSectionV41 {
  const raw = asRecord(value);
  const subitens = normalizeSubitens(raw.subitens);
  const relacoes = asArray(raw.relacoes)
    .map((item, relIndex) => normalizeRelation(item, relIndex))
    .sort((a, b) => a.ordem - b.ordem);

  return {
    codigo: asString(raw.codigo || raw.id || `secao_${index + 1}`),
    titulo: asString(raw.titulo || raw.nome || `Seção ${index + 1}`),
    ordem: asNumber(raw.ordem ?? index + 1) || index + 1,
    tipo: asString(raw.tipo) || undefined,
    perfil: asString(raw.perfil) || null,
    status: asString(raw.status) || undefined,
    ...(subitens.length > 0 ? { subitens } : {}),
    ...(relacoes.length > 0 ? { relacoes } : {}),
    dados: asRecord(raw.dados),
  };
}

function normalizeSections(value: unknown): ReportSectionV41[] {
  return asArray(value)
    .map((item, index) => normalizeSection(item, index))
    .sort((a, b) => a.ordem - b.ordem)
    .map((section) => ({
      ...section,
      ...(section.subitens
        ? { subitens: [...section.subitens].sort((a, b) => a.ordem - b.ordem) }
        : {}),
      ...(section.relacoes
        ? {
            relacoes: [...section.relacoes]
              .sort((a, b) => a.ordem - b.ordem)
              .map((relation) => ({
                ...relation,
                subitens: [...relation.subitens].sort(
                  (a, b) => a.ordem - b.ordem,
                ),
              })),
          }
        : {}),
    }));
}

function normalizeRanking(value: unknown): RankingItemV41[] {
  const items = asArray(value)
    .map((item, index) => {
      const raw = asRecord(item);
      const ordem = asNumber(raw.ordem ?? index + 1) || index + 1;
      return {
        ordem,
        perfil: asString(raw.perfil || raw.style || raw.estilo),
        papel: normalizePapel(raw.papel || raw.role, index),
        score: asNumber(raw.score || raw.pontuacao || raw.points),
        ...(raw.percentual !== undefined || raw.percentage !== undefined
          ? { percentual: asNumber(raw.percentual ?? raw.percentage) }
          : {}),
      } satisfies RankingItemV41;
    })
    .sort((a, b) => a.ordem - b.ordem);

  return items;
}

function normalizeScores(value: unknown): Record<string, number> {
  const raw = asRecord(value);
  return {
    Assertivo: asNumber(raw.Assertivo ?? raw.assertivo),
    Participativo: asNumber(raw.Participativo ?? raw.participativo),
    Integrador: asNumber(raw.Integrador ?? raw.integrador),
    Analítico: asNumber(raw["Analítico"] ?? raw.Analitico ?? raw.analitico),
  };
}

function normalizeAuditUnits(value: unknown): AuditUnitV41[] {
  return asArray(value).map((item, index) => {
    const raw = asRecord(item);
    return {
      id_unidade:
        asString(raw.id_unidade || raw.id || raw.codigo) || `UC-${index + 1}`,
      descricao:
        asString(
          raw.descricao || raw.titulo || raw.subitem_relatorio || raw.conteudo,
        ) || `Unidade ${index + 1}`,
      conteudo: asString(raw.conteudo) || undefined,
      campo_relatorio_principal:
        asString(raw.campo_relatorio_principal) || undefined,
      ordem_subitem:
        raw.ordem_subitem !== undefined
          ? asNumber(raw.ordem_subitem)
          : undefined,
      subitem_relatorio: asString(raw.subitem_relatorio) || undefined,
      perfil_principal: asString(raw.perfil_principal) || null,
      perfil_relacionado: asString(raw.perfil_relacionado) || null,
    };
  });
}

function normalizeVariant(
  value: unknown,
  tipo: "sintetico" | "detalhado",
): ReportVariantV41 {
  const raw = asRecord(value);
  return {
    versao: asString(raw.versao) || "1.0",
    tipo,
    estrategia: asString(raw.estrategia) || "",
    secoes: normalizeSections(raw.secoes),
  };
}

function normalizeGeneralView(value: unknown): {
  versao: string;
  secoes: ReportSectionV41[];
} {
  const raw = asRecord(value);
  return {
    versao: asString(raw.versao) || "1.0",
    secoes: normalizeSections(raw.secoes),
  };
}

export function isReportOutputV41(
  output: unknown,
  resultado?: unknown,
): boolean {
  const out = asRecord(output);
  const res = asRecord(resultado);
  const rootOut = isRecord(res.report_output)
    ? asRecord(res.report_output)
    : {};
  const hasGeneralView =
    isRecord(out.visao_geral) &&
    Array.isArray(asRecord(out.visao_geral).secoes);
  const hasLegacyV41Views =
    isRecord(out.relatorio_sintetico) || isRecord(out.relatorio_detalhado);

  return (
    out.contractVersion === "V41" ||
    out.contractVersion === "V42" ||
    out.contractVersion === "V43" ||
    out.contract_version === "socioestilo-report/v41" ||
    out.contract_version === "socioestilo-report/v42" ||
    out.contract_version === "socioestilo-report/v43" ||
    rootOut.contractVersion === "V41" ||
    rootOut.contractVersion === "V42" ||
    rootOut.contractVersion === "V43" ||
    rootOut.contract_version === "socioestilo-report/v41" ||
    rootOut.contract_version === "socioestilo-report/v42" ||
    rootOut.contract_version === "socioestilo-report/v43" ||
    res.contract_version === "socioestilo-report/v41" ||
    res.contract_version === "socioestilo-report/v42" ||
    res.contract_version === "socioestilo-report/v43" ||
    ((hasGeneralView || hasLegacyV41Views) &&
      isRecord(out.identificacao) &&
      isRecord(out.resultado_calculado))
  );
}

export function isReportOutputV43(
  output: unknown,
  resultado?: unknown,
): boolean {
  const out = asRecord(output);
  const res = asRecord(resultado);
  const rootOut = isRecord(res.report_output)
    ? asRecord(res.report_output)
    : {};
  const hasGeneralView =
    isRecord(out.visao_geral) &&
    Array.isArray(asRecord(out.visao_geral).secoes);

  const explicitSignal =
    out.contractVersion === "V43" ||
    out.contract_version === "socioestilo-report/v43" ||
    rootOut.contractVersion === "V43" ||
    rootOut.contract_version === "socioestilo-report/v43" ||
    res.contractVersion === "V43" ||
    res.contract_version === "socioestilo-report/v43";

  return explicitSignal && hasGeneralView;
}

export function isReportOutputV42(
  output: unknown,
  resultado?: unknown,
): boolean {
  const out = asRecord(output);
  const res = asRecord(resultado);
  const rootOut = isRecord(res.report_output)
    ? asRecord(res.report_output)
    : {};
  return (
    out.contractVersion === "V42" ||
    out.contract_version === "socioestilo-report/v42" ||
    rootOut.contractVersion === "V42" ||
    rootOut.contract_version === "socioestilo-report/v42" ||
    res.contractVersion === "V42" ||
    res.contract_version === "socioestilo-report/v42"
  );
}

export function detectCanonicalContractVersion(
  output: unknown,
  resultado?: unknown,
): "V43" | "V42" | "V41" {
  if (isReportOutputV43(output, resultado)) return "V43";
  if (isReportOutputV42(output, resultado)) return "V42";
  return "V41";
}

function resolveRawReportOutput(resultado: unknown): ObjectRecord {
  const root = asRecord(resultado);
  if (isRecord(root.report_output)) return root.report_output;
  if (isRecord(root.relatorio_pronto_para_app))
    return root.relatorio_pronto_para_app;
  if (isRecord(asRecord(root.report_data).report_output))
    return asRecord(root.report_data).report_output as ObjectRecord;
  return {};
}

export function validateReportOutputV41(
  resultado: unknown,
): ReportV41Validation {
  const root = asRecord(resultado);
  const output = resolveRawReportOutput(root);
  const warnings: string[] = [];
  const errors: string[] = [];

  if (!isReportOutputV41(output, root)) {
    errors.push("Contrato canônico de relatório não identificado.");
    return { valid: false, warnings, errors };
  }

  if (!isRecord(output.identificacao)) errors.push("identificacao ausente.");
  if (!isRecord(output.resultado_calculado))
    errors.push("resultado_calculado ausente.");
  if (!isRecord(output.visao_geral)) {
    if (
      !isRecord(output.relatorio_sintetico) &&
      !isRecord(output.relatorio_detalhado)
    ) {
      errors.push("visao_geral ausente.");
    } else {
      warnings.push("visao_geral ausente; usando fallback legado V41.");
    }
  }
  if (!isRecord(output.memoria_calculo))
    warnings.push("memoria_calculo ausente.");
  if (!isRecord(output.auditoria)) warnings.push("auditoria ausente.");

  const ranking = normalizeRanking(
    asRecord(output.resultado_calculado).ranking,
  );
  if (ranking.length !== 4) {
    warnings.push("ranking não possui quatro posições.");
  }

  const papeis = ranking.map((item) => normalizePapel(item.papel));
  const preferred = ["Dominante", "Secundário", "Terciário", "Adjacente"];
  const hasPreferred = preferred.every((papel) => papeis.includes(papel));
  if (!hasPreferred) {
    warnings.push(
      "nomenclatura de papéis fora do padrão Dominante/Secundário/Terciário/Adjacente.",
    );
  }

  return {
    valid: errors.length === 0,
    warnings,
    errors,
  };
}

export function parseReportOutputV41(
  resultado: unknown,
): ReportOutputV41 | null {
  const root = asRecord(resultado);
  const output = resolveRawReportOutput(root);
  if (!isReportOutputV41(output, root)) return null;

  const resultadoCalculado = asRecord(output.resultado_calculado);

  const normalizedGeneralView = normalizeGeneralView(output.visao_geral);
  const detailedLegacySections = asArray(
    asRecord(output.relatorio_detalhado).secoes,
  );
  const syntheticLegacySections = asArray(
    asRecord(output.relatorio_sintetico).secoes,
  );
  const fallbackLegacySections = normalizeSections(
    detailedLegacySections.length > 0
      ? detailedLegacySections
      : syntheticLegacySections,
  );

  return {
    contractVersion: detectCanonicalContractVersion(output, root),
    contract_version:
      asString(output.contract_version) ||
      (detectCanonicalContractVersion(output, root) === "V43"
        ? "socioestilo-report/v43"
        : detectCanonicalContractVersion(output, root) === "V42"
          ? "socioestilo-report/v42"
          : "socioestilo-report/v41"),
    workflow_version: asString(output.workflow_version),
    report_version: asString(output.report_version),
    identificacao: asRecord(output.identificacao),
    resultado_calculado: {
      perfil_dominante: asString(resultadoCalculado.perfil_dominante),
      perfil_secundario: asString(resultadoCalculado.perfil_secundario),
      perfil_terciario: asString(resultadoCalculado.perfil_terciario),
      perfil_adjacente: asString(resultadoCalculado.perfil_adjacente),
      lado_luz: asString(resultadoCalculado.lado_luz),
      lado_sombra: asString(resultadoCalculado.lado_sombra),
      estilo_a_desenvolver: asString(resultadoCalculado.estilo_a_desenvolver),
      total_pontos: asNumber(resultadoCalculado.total_pontos),
      scores: normalizeScores(resultadoCalculado.scores),
      ranking: normalizeRanking(resultadoCalculado.ranking),
    },
    visao_geral:
      normalizedGeneralView.secoes.length > 0
        ? normalizedGeneralView
        : {
            versao: "legacy-fallback",
            secoes: fallbackLegacySections,
          },
    ...(isRecord(output.relatorio_sintetico)
      ? {
          relatorio_sintetico: normalizeVariant(
            output.relatorio_sintetico,
            "sintetico",
          ),
        }
      : {}),
    ...(isRecord(output.relatorio_detalhado)
      ? {
          relatorio_detalhado: normalizeVariant(
            output.relatorio_detalhado,
            "detalhado",
          ),
        }
      : {}),
    memoria_calculo: asRecord(output.memoria_calculo),
    auditoria: {
      unidades_utilizadas: normalizeAuditUnits(
        asRecord(output.auditoria).unidades_utilizadas,
      ),
      ...(asRecord(output.auditoria).total_unidades_utilizadas !== undefined
        ? {
            total_unidades_utilizadas: asNumber(
              asRecord(output.auditoria).total_unidades_utilizadas,
            ),
          }
        : {}),
    },
  };
}

function buildVariantViewModel(
  resultado: unknown,
  variant: "sintetico" | "detalhado",
): ReportVariantViewModelV41 | null {
  const output = parseReportOutputV41(resultado);
  if (!output) return null;
  const validation = validateReportOutputV41(resultado);
  const selectedSections = output.visao_geral.secoes;

  return {
    variantLabel:
      variant === "sintetico" ? "Relatório Sintético" : "Relatório Analítico",
    variantKey: variant,
    identificacao: output.identificacao,
    resultadoCalculado: output.resultado_calculado,
    sections: selectedSections,
    memoriaCalculo: output.memoria_calculo,
    auditoria: output.auditoria,
    output,
    validation,
  };
}

export function buildSyntheticReportViewModel(
  resultado: unknown,
): ReportVariantViewModelV41 | null {
  return buildVariantViewModel(resultado, "sintetico");
}

export function buildAnalyticalReportViewModel(
  resultado: unknown,
): ReportVariantViewModelV41 | null {
  return buildVariantViewModel(resultado, "detalhado");
}
