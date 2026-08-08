import { supabase, parseBigIntId } from "./supabase";
import { auth as firebaseAuth } from "./firebase";
import {
  getDefaultVisibilityConfig,
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

const CONFIGURATION_TABLE = "relatorio_configuracoes";
const isDev = Boolean((import.meta as { env?: { DEV?: boolean } }).env?.DEV);

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

function isMissingConflictConstraintError(error: any): boolean {
  const code = String(error?.code || "");
  const message =
    `${error?.message || ""} ${error?.details || ""}`.toLowerCase();
  return (
    code === "42P10" ||
    message.includes("no unique or exclusion constraint") ||
    message.includes(
      "there is no unique or exclusion constraint matching the on conflict specification",
    )
  );
}

function toErrorMessage(error: unknown, fallback: string): string {
  if (!error) return fallback;
  if (typeof error === "string") return error;
  if (error instanceof Error && error.message) return error.message;
  const maybe = error as Record<string, unknown>;
  const message = String(maybe?.message || "");
  const details = String(maybe?.details || "");
  const hint = String(maybe?.hint || "");
  return [message, details, hint].filter(Boolean).join(" | ") || fallback;
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

type ConfigurationKey = {
  scope: ConfigurationScope;
  empresaId: number | null;
  viewType: ReportViewType;
  viewerRole: ViewerRole | null;
};

function devLogConfigurationOperation(
  operation: "SELECT" | "INSERT" | "UPDATE" | "UPSERT" | "DELETE" | "ERROR",
  key: ConfigurationKey,
  extra?: Record<string, unknown>,
): void {
  if (!isDev) return;
  console.info("[REPORT-CONFIG]", {
    operation,
    scope: key.scope,
    view_type: key.viewType,
    viewer_role: key.viewerRole,
    empresa_id: key.empresaId,
    ...(extra || {}),
  });
}

async function devLogFirebaseRlsClaimsBeforeSave(): Promise<void> {
  if (!isDev) return;

  const uid = firebaseAuth.currentUser?.uid || null;
  const tokenResult = firebaseAuth.currentUser
    ? await firebaseAuth.currentUser.getIdTokenResult()
    : null;
  const claims = tokenResult?.claims || null;

  console.info("[REPORT-CONFIG][AUTH-CHECK] firebase_uid", uid);
  console.info("[REPORT-CONFIG][AUTH-CHECK] firebase_claims", claims);
  console.info("[REPORT-CONFIG][AUTH-CHECK] role_is_authenticated", {
    role: (claims as Record<string, unknown> | null)?.role ?? null,
    ok: (claims as Record<string, unknown> | null)?.role === "authenticated",
  });
}

async function selectConfigurations(where: {
  scope?: ConfigurationScope;
  empresaId?: number | null;
  viewType?: ReportViewType;
  viewerRole?: ViewerRole | null;
  ativo?: boolean;
}): Promise<ReportConfigurationRow[]> {
  let query = supabase.from(CONFIGURATION_TABLE).select("*");

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

  throw new Error(
    "Nenhuma tabela de configuração de relatório foi encontrada.",
  );
}

async function getConfigurationRow(
  key: ConfigurationKey,
): Promise<ReportConfigurationRow | null> {
  const rows = await selectConfigurations({
    scope: key.scope,
    empresaId: key.empresaId,
    viewType: key.viewType,
    viewerRole: key.viewerRole,
    ativo: true,
  });

  devLogConfigurationOperation("SELECT", key, { found: rows.length > 0 });
  return rows[0] || null;
}

async function saveConfiguration(
  row: Omit<ReportConfigurationRow, "id" | "created_at" | "updated_at">,
): Promise<void> {
  await devLogFirebaseRlsClaimsBeforeSave();

  const key: ConfigurationKey = {
    scope: row.scope,
    empresaId: row.empresa_id,
    viewType: row.view_type,
    viewerRole: row.viewer_role,
  };
  const existing = await getConfigurationRow(key);

  const payload = {
    scope: row.scope,
    empresa_id: row.empresa_id,
    view_type: row.view_type,
    viewer_role: row.viewer_role,
    configuracao: row.configuracao,
    ativo: row.ativo,
    updated_at: new Date().toISOString(),
  };

  // Prefer upsert for first save/update by logical key.
  const { error: upsertError } = await supabase
    .from(CONFIGURATION_TABLE)
    .upsert(
      [
        {
          ...payload,
          created_at: existing?.created_at || new Date().toISOString(),
        },
      ],
      {
        onConflict: "scope,view_type,viewer_role,empresa_id",
      },
    );

  if (!upsertError) {
    devLogConfigurationOperation("UPSERT", key, {
      logicalOperation: existing ? "UPDATE" : "INSERT",
    });
    return;
  }

  if (!isMissingConflictConstraintError(upsertError)) {
    devLogConfigurationOperation("ERROR", key, {
      action: "UPSERT",
      error: toErrorMessage(upsertError, "Erro no upsert"),
    });
    throw upsertError;
  }

  // Fallback for environments where onConflict cannot target partial indexes.
  if (existing?.id) {
    const { error: updateError } = await supabase
      .from(CONFIGURATION_TABLE)
      .update(payload)
      .eq("id", existing.id);

    if (updateError) {
      devLogConfigurationOperation("ERROR", key, {
        action: "UPDATE",
        error: toErrorMessage(updateError, "Erro no update"),
      });
      throw updateError;
    }

    devLogConfigurationOperation("UPDATE", key, { mode: "fallback" });
    return;
  }

  const { error: insertError } = await supabase
    .from(CONFIGURATION_TABLE)
    .insert({
      ...payload,
      created_at: new Date().toISOString(),
    });

  if (insertError) {
    devLogConfigurationOperation("ERROR", key, {
      action: "INSERT",
      error: toErrorMessage(insertError, "Erro no insert"),
    });
    throw insertError;
  }

  devLogConfigurationOperation("INSERT", key, { mode: "fallback" });
}

async function deleteConfiguration(where: {
  scope: ConfigurationScope;
  empresaId: number | null;
  viewType: ReportViewType;
  viewerRole: ViewerRole | null;
}): Promise<void> {
  let query = supabase
    .from(CONFIGURATION_TABLE)
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

  if (error) throw error;

  devLogConfigurationOperation("DELETE", {
    scope: where.scope,
    empresaId: where.empresaId,
    viewType: where.viewType,
    viewerRole: where.viewerRole,
  });
}

export async function getSyntheticGlobalConfig(): Promise<ReportVisibilityConfig> {
  const row = await getConfigurationRow({
    scope: "global",
    empresaId: null,
    viewType: "synthetic",
    viewerRole: null,
  });

  return row?.configuracao || getDefaultVisibilityConfig("synthetic", null);
}

export async function getAnalyticalGlobalConfig(
  role: string,
): Promise<ReportVisibilityConfig> {
  const viewerRole = normalizeViewerRole(role);
  const row = await getConfigurationRow({
    scope: "global",
    empresaId: null,
    viewType: "analytical",
    viewerRole,
  });

  return (
    row?.configuracao || getDefaultVisibilityConfig("analytical", viewerRole)
  );
}

export async function getCompanyAnalyticalOverride(
  companyId: string | number,
  role: string,
): Promise<ReportVisibilityConfig | null> {
  const viewerRole = normalizeViewerRole(role);
  const empresaId = parseBigIntId(companyId);
  if (empresaId === null) return null;

  const row = await getConfigurationRow({
    scope: "company",
    empresaId,
    viewType: "analytical",
    viewerRole,
  });

  return row?.configuracao || null;
}

export async function saveSyntheticGlobalConfig(
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

export async function saveAnalyticalGlobalConfig(
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

// Backward-compatible aliases during migration.
export async function getSyntheticReportConfig(): Promise<ReportVisibilityConfig> {
  return getSyntheticGlobalConfig();
}

export async function getAnalyticalReportConfig(
  role: string,
  companyId?: string | number | null,
): Promise<{
  globalConfig: ReportVisibilityConfig;
  companyOverride: ReportVisibilityConfig | null;
}> {
  const globalConfig = await getAnalyticalGlobalConfig(role);
  const companyOverride =
    companyId === undefined || companyId === null
      ? null
      : await getCompanyAnalyticalOverride(companyId, role);

  return {
    globalConfig,
    companyOverride,
  };
}

export async function saveGlobalSyntheticConfig(
  config: ReportVisibilityConfig,
): Promise<void> {
  await saveSyntheticGlobalConfig(config);
}

export async function saveGlobalAnalyticalConfig(
  role: string,
  config: ReportVisibilityConfig,
): Promise<void> {
  await saveAnalyticalGlobalConfig(role, config);
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
