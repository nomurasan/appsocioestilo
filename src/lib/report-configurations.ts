import { supabase, parseBigIntId } from "./supabase";
import {
  ReportVisibilityConfig,
  ReportViewType,
  ViewerRole,
  normalizeViewerRole,
} from "./report-visibility-v42";

export type ConfigurationScope = "global" | "company";

export interface ReportConfigurationRow {
  id?: number;
  scope: ConfigurationScope;
  empresa_id: number | null;
  view_type: ReportViewType;
  viewer_role: ViewerRole | null;
  configuracao: ReportVisibilityConfig;
  ativo: boolean;
  created_at?: string;
  updated_at?: string;
}

const CONFIGURATION_TABLES = [
  "relatorio_configuracoes",
  "report_configurations",
];

function isMissingTableError(error: any): boolean {
  const code = String(error?.code || "");
  const message =
    `${error?.message || ""} ${error?.details || ""}`.toLowerCase();
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    (message.includes("relation") && message.includes("does not exist")) ||
    message.includes("could not find the table")
  );
}

function safeConfig(value: unknown): ReportVisibilityConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as ReportVisibilityConfig;
}

function normalizeViewerRoleOrNull(role?: string | null): ViewerRole | null {
  if (!role) return null;
  return normalizeViewerRole(role);
}

function normalizeRow(row: any): ReportConfigurationRow {
  const viewerRole = normalizeViewerRoleOrNull(row.viewer_role);
  return {
    id: row.id ? Number(row.id) : undefined,
    scope: row.scope === "company" ? "company" : "global",
    empresa_id:
      row.empresa_id === null || row.empresa_id === undefined
        ? null
        : Number(row.empresa_id),
    view_type: row.view_type === "analytical" ? "analytical" : "synthetic",
    viewer_role: viewerRole,
    configuracao: safeConfig(row.configuracao),
    ativo: row.ativo !== false,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function selectConfigurations(where: {
  scope?: ConfigurationScope;
  empresaId?: number | null;
  viewType?: ReportViewType;
  viewerRole?: ViewerRole | null;
  ativo?: boolean;
}): Promise<ReportConfigurationRow[]> {
  for (const table of CONFIGURATION_TABLES) {
    let query = supabase.from(table).select("*");

    if (where.scope) query = query.eq("scope", where.scope);
    if (where.viewType) query = query.eq("view_type", where.viewType);
    if (where.ativo !== undefined) query = query.eq("ativo", where.ativo);

    if (where.empresaId === null) {
      query = query.is("empresa_id", null);
    } else if (typeof where.empresaId === "number") {
      query = query.eq("empresa_id", where.empresaId);
    }

    if (where.viewerRole === null) {
      query = query.is("viewer_role", null);
    } else if (where.viewerRole) {
      query = query.eq("viewer_role", where.viewerRole);
    }

    const { data, error } = await query
      .order("updated_at", { ascending: false })
      .order("created_at", { ascending: false });

    if (!error) {
      return Array.isArray(data) ? data.map(normalizeRow) : [];
    }

    if (!isMissingTableError(error)) {
      throw error;
    }
  }

  return [];
}

async function saveConfiguration(
  row: Omit<ReportConfigurationRow, "id" | "created_at" | "updated_at">,
): Promise<void> {
  for (const table of CONFIGURATION_TABLES) {
    const existing = await selectConfigurations({
      scope: row.scope,
      empresaId: row.empresa_id,
      viewType: row.view_type,
      viewerRole: row.viewer_role,
      ativo: true,
    });

    const payload = {
      scope: row.scope,
      empresa_id: row.empresa_id,
      view_type: row.view_type,
      viewer_role: row.viewer_role,
      configuracao: row.configuracao,
      ativo: row.ativo,
      updated_at: new Date().toISOString(),
    };

    if (existing.length > 0 && existing[0].id) {
      const { error: updateError } = await supabase
        .from(table)
        .update(payload)
        .eq("id", existing[0].id);

      if (!updateError) return;
      if (!isMissingTableError(updateError)) throw updateError;
      continue;
    }

    const { error: insertError } = await supabase.from(table).insert({
      ...payload,
      created_at: new Date().toISOString(),
    });

    if (!insertError) return;
    if (!isMissingTableError(insertError)) throw insertError;
  }

  throw new Error(
    "Nenhuma tabela de configuração de relatório V42 foi encontrada.",
  );
}

async function deleteConfiguration(where: {
  scope: ConfigurationScope;
  empresaId: number | null;
  viewType: ReportViewType;
  viewerRole: ViewerRole | null;
}): Promise<void> {
  for (const table of CONFIGURATION_TABLES) {
    let query = supabase
      .from(table)
      .delete()
      .eq("scope", where.scope)
      .eq("view_type", where.viewType);

    if (where.empresaId === null) {
      query = query.is("empresa_id", null);
    } else {
      query = query.eq("empresa_id", where.empresaId);
    }

    if (where.viewerRole === null) {
      query = query.is("viewer_role", null);
    } else {
      query = query.eq("viewer_role", where.viewerRole);
    }

    const { error } = await query;

    if (!error) return;
    if (!isMissingTableError(error)) throw error;
  }
}

export async function getSyntheticReportConfig(): Promise<ReportVisibilityConfig> {
  const rows = await selectConfigurations({
    scope: "global",
    empresaId: null,
    viewType: "synthetic",
    viewerRole: null,
    ativo: true,
  });

  return rows[0]?.configuracao || {};
}

export async function getAnalyticalReportConfig(
  role: string,
  companyId?: string | number | null,
): Promise<{
  globalConfig: ReportVisibilityConfig;
  companyOverride: ReportVisibilityConfig | null;
}> {
  const viewerRole = normalizeViewerRole(role);
  const parsedCompanyId =
    companyId === undefined || companyId === null
      ? null
      : parseBigIntId(companyId);

  const globalRows = await selectConfigurations({
    scope: "global",
    empresaId: null,
    viewType: "analytical",
    viewerRole,
    ativo: true,
  });

  if (parsedCompanyId === null) {
    return {
      globalConfig: globalRows[0]?.configuracao || {},
      companyOverride: null,
    };
  }

  const companyRows = await selectConfigurations({
    scope: "company",
    empresaId: parsedCompanyId,
    viewType: "analytical",
    viewerRole,
    ativo: true,
  });

  return {
    globalConfig: globalRows[0]?.configuracao || {},
    companyOverride: companyRows[0]?.configuracao || null,
  };
}

export async function saveGlobalSyntheticConfig(
  config: ReportVisibilityConfig,
): Promise<void> {
  await saveConfiguration({
    scope: "global",
    empresa_id: null,
    view_type: "synthetic",
    viewer_role: null,
    configuracao: config,
    ativo: true,
  });
}

export async function saveGlobalAnalyticalConfig(
  role: string,
  config: ReportVisibilityConfig,
): Promise<void> {
  await saveConfiguration({
    scope: "global",
    empresa_id: null,
    view_type: "analytical",
    viewer_role: normalizeViewerRole(role),
    configuracao: config,
    ativo: true,
  });
}

export async function saveCompanyAnalyticalOverride(
  companyId: string | number,
  role: string,
  configOverride: ReportVisibilityConfig,
): Promise<void> {
  const empresaId = parseBigIntId(companyId);
  if (empresaId === null) {
    throw new Error("empresa_id inválido para override analítico.");
  }

  await saveConfiguration({
    scope: "company",
    empresa_id: empresaId,
    view_type: "analytical",
    viewer_role: normalizeViewerRole(role),
    configuracao: configOverride,
    ativo: true,
  });
}

export async function resetCompanyAnalyticalOverride(
  companyId: string | number,
  role: string,
): Promise<void> {
  const empresaId = parseBigIntId(companyId);
  if (empresaId === null) return;

  await deleteConfiguration({
    scope: "company",
    empresaId,
    viewType: "analytical",
    viewerRole: normalizeViewerRole(role),
  });
}

export async function inspectLegacyReportParameterDependencies(): Promise<{
  relatorio_parametrizacoes: number;
  parametrizacao_relatorio: number;
  relatorio_parametros: number;
}> {
  const result = {
    relatorio_parametrizacoes: 0,
    parametrizacao_relatorio: 0,
    relatorio_parametros: 0,
  };

  const tableMap: Record<string, keyof typeof result> = {
    relatorio_parametrizacoes: "relatorio_parametrizacoes",
    parametrizacao_relatorio: "parametrizacao_relatorio",
    relatorio_parametros: "relatorio_parametros",
  };

  for (const table of Object.keys(tableMap)) {
    const { count, error } = await supabase
      .from(table)
      .select("*", { count: "exact", head: true });

    if (!error) {
      result[tableMap[table]] = Number(count || 0);
      continue;
    }

    if (!isMissingTableError(error)) {
      throw error;
    }
  }

  return result;
}
