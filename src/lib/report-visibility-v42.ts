export type ReportViewType = "synthetic" | "analytical";

export type ViewerRole = "participant" | "consultant" | "admin";

export interface ReportVisibilitySectionConfig {
  enabled?: boolean;
  subitems?: Record<string, boolean>;
}

export interface ReportVisibilityComplianceConfig {
  calculationMemory?: boolean;
  auditTrail?: boolean;
  auditUnitContent?: boolean;
}

export interface ReportVisibilityConfig {
  enabled?: boolean;
  sections?: Record<string, ReportVisibilitySectionConfig>;
  compliance?: ReportVisibilityComplianceConfig;
}

export interface EffectiveReportVisibility {
  viewType: ReportViewType;
  viewerRole: ViewerRole | null;
  enabled: boolean;
  sections: Record<string, ReportVisibilitySectionConfig>;
  compliance: Required<ReportVisibilityComplianceConfig>;
}

export interface ResolveReportVisibilityInput {
  viewType: ReportViewType;
  viewerRole?: string | null;
  globalConfig?: ReportVisibilityConfig | null;
  companyOverride?: ReportVisibilityConfig | null;
  systemDefaults?: ReportVisibilityConfig | null;
}

export interface GeneralViewSubitem {
  ordem?: number;
  codigo?: string;
  id_unidade?: string | null;
  subitem_relatorio?: string;
  titulo?: string;
  [key: string]: unknown;
}

export interface GeneralViewRelation {
  ordem?: number;
  subitens?: GeneralViewSubitem[];
  [key: string]: unknown;
}

export interface GeneralViewSection {
  codigo: string;
  ordem?: number;
  subitens?: GeneralViewSubitem[];
  relacoes?: GeneralViewRelation[];
  [key: string]: unknown;
}

export interface GeneralViewV42 {
  secoes: GeneralViewSection[];
  [key: string]: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeString(value: unknown): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  return fallback;
}

function mergeSubitems(
  base?: Record<string, boolean>,
  override?: Record<string, boolean>,
): Record<string, boolean> {
  return {
    ...(base || {}),
    ...(override || {}),
  };
}

function mergeSections(
  base?: Record<string, ReportVisibilitySectionConfig>,
  override?: Record<string, ReportVisibilitySectionConfig>,
): Record<string, ReportVisibilitySectionConfig> {
  const result: Record<string, ReportVisibilitySectionConfig> = {
    ...(base || {}),
  };

  Object.entries(override || {}).forEach(([sectionCode, sectionConfig]) => {
    const prev = result[sectionCode] || {};
    result[sectionCode] = {
      ...prev,
      ...sectionConfig,
      subitems: mergeSubitems(prev.subitems, sectionConfig?.subitems),
    };
  });

  return result;
}

function mergeVisibilityConfig(
  base?: ReportVisibilityConfig | null,
  override?: ReportVisibilityConfig | null,
): ReportVisibilityConfig {
  const baseSections = base?.sections || {};
  const overrideSections = override?.sections || {};

  return {
    enabled: override?.enabled ?? base?.enabled,
    sections: mergeSections(baseSections, overrideSections),
    compliance: {
      ...(base?.compliance || {}),
      ...(override?.compliance || {}),
    },
  };
}

export function normalizeViewerRole(rawRole: unknown): ViewerRole {
  const role = normalizeString(rawRole);

  if (
    role === "admin" ||
    role === "administrator" ||
    role === "administrador"
  ) {
    return "admin";
  }

  if (role === "consultant" || role === "consultor") {
    return "consultant";
  }

  if (
    role === "participant" ||
    role === "participante" ||
    role === "user" ||
    role === "usuario"
  ) {
    return "participant";
  }

  return "participant";
}

export function getSubitemConfigKey(subitem: GeneralViewSubitem): string {
  const byCode = normalizeString(subitem.codigo);
  if (byCode) return byCode;

  const bySemanticTitle = normalizeString(subitem.subitem_relatorio);
  if (bySemanticTitle) return bySemanticTitle.replace(/\s+/g, "_");

  const byUnitId = normalizeString(subitem.id_unidade);
  if (byUnitId) return `uc_${byUnitId}`;

  const ordem = Number(subitem.ordem);
  if (Number.isFinite(ordem) && ordem > 0) {
    return `ordem_${ordem}`;
  }

  return "subitem_sem_chave";
}

export function getDefaultVisibilityConfig(
  viewType: ReportViewType,
  viewerRole?: ViewerRole | null,
): ReportVisibilityConfig {
  if (viewType === "synthetic") {
    return {
      enabled: true,
      sections: {},
      compliance: {
        calculationMemory: false,
        auditTrail: false,
        auditUnitContent: false,
      },
    };
  }

  const role = viewerRole || "participant";

  if (role === "participant") {
    return {
      enabled: true,
      sections: {},
      compliance: {
        calculationMemory: false,
        auditTrail: false,
        auditUnitContent: false,
      },
    };
  }

  if (role === "consultant") {
    return {
      enabled: true,
      sections: {},
      compliance: {
        calculationMemory: true,
        auditTrail: true,
        auditUnitContent: true,
      },
    };
  }

  return {
    enabled: true,
    sections: {},
    compliance: {
      calculationMemory: true,
      auditTrail: true,
      auditUnitContent: true,
    },
  };
}

function applyMandatoryAccessRules(
  resolved: EffectiveReportVisibility,
): EffectiveReportVisibility {
  if (resolved.viewType === "synthetic") {
    return {
      ...resolved,
      compliance: {
        calculationMemory: false,
        auditTrail: false,
        auditUnitContent: false,
      },
    };
  }

  if (resolved.viewerRole === "participant") {
    return {
      ...resolved,
      compliance: {
        calculationMemory: false,
        auditTrail: false,
        auditUnitContent: false,
      },
    };
  }

  return resolved;
}

export function resolveReportVisibility(
  input: ResolveReportVisibilityInput,
): EffectiveReportVisibility {
  const role =
    input.viewType === "synthetic"
      ? null
      : normalizeViewerRole(input.viewerRole || "participant");

  const defaults =
    input.systemDefaults || getDefaultVisibilityConfig(input.viewType, role);

  const mergedDefaultsAndGlobal = mergeVisibilityConfig(
    defaults,
    input.globalConfig,
  );
  const mergedAll = mergeVisibilityConfig(
    mergedDefaultsAndGlobal,
    input.companyOverride,
  );

  const resolved: EffectiveReportVisibility = {
    viewType: input.viewType,
    viewerRole: role,
    enabled: asBoolean(mergedAll.enabled, true),
    sections: mergedAll.sections || {},
    compliance: {
      calculationMemory: asBoolean(
        mergedAll.compliance?.calculationMemory,
        false,
      ),
      auditTrail: asBoolean(mergedAll.compliance?.auditTrail, false),
      auditUnitContent: asBoolean(
        mergedAll.compliance?.auditUnitContent,
        false,
      ),
    },
  };

  return applyMandatoryAccessRules(resolved);
}

function toOrderedArray<T extends { ordem?: number }>(list: T[] = []): T[] {
  return [...list].sort((a, b) => {
    const oa = Number(a.ordem || 0);
    const ob = Number(b.ordem || 0);
    return oa - ob;
  });
}

function isSectionEnabled(
  section: GeneralViewSection,
  visibility: EffectiveReportVisibility,
): boolean {
  if (!visibility.enabled) return false;
  const sectionConfig = visibility.sections[section.codigo] || {};
  return sectionConfig.enabled !== false;
}

function isSubitemEnabled(
  sectionCode: string,
  subitem: GeneralViewSubitem,
  visibility: EffectiveReportVisibility,
): boolean {
  const sectionConfig = visibility.sections[sectionCode] || {};
  if (sectionConfig.enabled === false) return false;
  const key = getSubitemConfigKey(subitem);
  const map = sectionConfig.subitems || {};
  if (Object.prototype.hasOwnProperty.call(map, key)) {
    return map[key] !== false;
  }
  return true;
}

export function applyVisibilityToGeneralView(
  visaoGeral: GeneralViewV42,
  visibility: EffectiveReportVisibility,
): GeneralViewV42 {
  const sourceSections = Array.isArray(visaoGeral?.secoes)
    ? visaoGeral.secoes
    : [];

  const sections = toOrderedArray(sourceSections)
    .filter((section) => isSectionEnabled(section, visibility))
    .map((section) => {
      const subitems = toOrderedArray(section.subitens || []).filter(
        (subitem) => isSubitemEnabled(section.codigo, subitem, visibility),
      );

      const relations = toOrderedArray(section.relacoes || []).map(
        (relation) => {
          const relationSubitems = toOrderedArray(
            relation.subitens || [],
          ).filter((subitem) =>
            isSubitemEnabled(section.codigo, subitem, visibility),
          );

          return {
            ...relation,
            ...(relationSubitems.length > 0
              ? { subitens: relationSubitems }
              : { subitens: [] }),
          };
        },
      );

      return {
        ...section,
        ...(subitems.length > 0
          ? { subitens: subitems }
          : section.subitens
            ? { subitens: [] }
            : {}),
        ...(relations.length > 0
          ? { relacoes: relations }
          : section.relacoes
            ? { relacoes: [] }
            : {}),
      };
    });

  return {
    ...visaoGeral,
    secoes: sections,
  };
}

export function getSectionInheritanceStatus(
  sectionCode: string,
  companyOverride?: ReportVisibilityConfig | null,
): "HERDADO" | "PERSONALIZADO" {
  const section = companyOverride?.sections?.[sectionCode];
  if (!section) return "HERDADO";

  const hasSectionEnabled = typeof section.enabled === "boolean";
  const hasSubitems = Object.keys(section.subitems || {}).length > 0;

  return hasSectionEnabled || hasSubitems ? "PERSONALIZADO" : "HERDADO";
}

export function buildCompanyOverrideDiff(
  globalConfig: ReportVisibilityConfig,
  editedConfig: ReportVisibilityConfig,
): ReportVisibilityConfig {
  const diff: ReportVisibilityConfig = {};

  if (editedConfig.enabled !== globalConfig.enabled) {
    diff.enabled = editedConfig.enabled;
  }

  const sectionDiff: Record<string, ReportVisibilitySectionConfig> = {};
  const sectionKeys = new Set([
    ...Object.keys(globalConfig.sections || {}),
    ...Object.keys(editedConfig.sections || {}),
  ]);

  sectionKeys.forEach((sectionCode) => {
    const baseSection = globalConfig.sections?.[sectionCode] || {};
    const nextSection = editedConfig.sections?.[sectionCode] || {};

    const local: ReportVisibilitySectionConfig = {};

    if (nextSection.enabled !== baseSection.enabled) {
      local.enabled = nextSection.enabled;
    }

    const baseSubitems = baseSection.subitems || {};
    const nextSubitems = nextSection.subitems || {};
    const subitemKeys = new Set([
      ...Object.keys(baseSubitems),
      ...Object.keys(nextSubitems),
    ]);

    const subitemsDiff: Record<string, boolean> = {};
    subitemKeys.forEach((key) => {
      if (nextSubitems[key] !== baseSubitems[key]) {
        subitemsDiff[key] = nextSubitems[key];
      }
    });

    if (Object.keys(subitemsDiff).length > 0) {
      local.subitems = subitemsDiff;
    }

    if (Object.keys(local).length > 0) {
      sectionDiff[sectionCode] = local;
    }
  });

  if (Object.keys(sectionDiff).length > 0) {
    diff.sections = sectionDiff;
  }

  const complianceDiff: ReportVisibilityComplianceConfig = {};
  if (
    editedConfig.compliance?.calculationMemory !==
    globalConfig.compliance?.calculationMemory
  ) {
    complianceDiff.calculationMemory =
      editedConfig.compliance?.calculationMemory;
  }
  if (
    editedConfig.compliance?.auditTrail !== globalConfig.compliance?.auditTrail
  ) {
    complianceDiff.auditTrail = editedConfig.compliance?.auditTrail;
  }
  if (
    editedConfig.compliance?.auditUnitContent !==
    globalConfig.compliance?.auditUnitContent
  ) {
    complianceDiff.auditUnitContent = editedConfig.compliance?.auditUnitContent;
  }

  if (Object.keys(complianceDiff).length > 0) {
    diff.compliance = complianceDiff;
  }

  return diff;
}
