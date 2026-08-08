import React, { useEffect, useMemo, useState } from "react";
import { Empresa } from "../types";
import {
    applyVisibilityToGeneralView,
    buildCompanyOverrideDiff,
    getSectionInheritanceStatus,
    getSubitemConfigKey,
    normalizeViewerRole,
    resolveReportVisibility,
    type ReportViewType,
    type ReportVisibilityConfig,
    type ViewerRole,
} from "../lib/report-visibility-v42";
import {
    getAnalyticalReportConfig,
    getSyntheticReportConfig,
    resetCompanyAnalyticalOverride,
    saveCompanyAnalyticalOverride,
    saveGlobalAnalyticalConfig,
    saveGlobalSyntheticConfig,
} from "../lib/report-configurations";

type AnalyticalRole = ViewerRole;
type ScopeType = "global" | "company";

type SectionNode = {
    codigo: string;
    titulo: string;
    ordem: number;
    subitems: Array<{
        key: string;
        title: string;
        ordem: number;
    }>;
};

const FALLBACK_SECTIONS: SectionNode[] = [
    { codigo: "conheca_quatro_socioestilos", titulo: "Conheça os Quatro Sócio Estilos", ordem: 1, subitems: [] },
    { codigo: "distribuicao_metrica_energia", titulo: "Distribuição Métrica de Energia", ordem: 2, subitems: [] },
    { codigo: "perfil_dominante", titulo: "Perfil Dominante", ordem: 3, subitems: [] },
    { codigo: "perfil_secundario", titulo: "Perfil Secundário", ordem: 4, subitems: [] },
    { codigo: "lado_luz", titulo: "Lado Luz", ordem: 5, subitems: [] },
    { codigo: "lado_sombra", titulo: "Lado Sombra", ordem: 6, subitems: [] },
    { codigo: "estilo_a_desenvolver", titulo: "Estilo a Desenvolver", ordem: 7, subitems: [] },
    { codigo: "relacoes_entre_socioestilos", titulo: "Relações entre Socioestilos", ordem: 8, subitems: [] },
    { codigo: "recomendacoes", titulo: "Recomendações", ordem: 9, subitems: [] },
];

function normalizeText(value: unknown): string {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

function isEmptyConfig(config?: ReportVisibilityConfig | null): boolean {
    if (!config) return true;
    return (
        config.enabled === undefined &&
        Object.keys(config.sections || {}).length === 0 &&
        Object.keys(config.compliance || {}).length === 0
    );
}

function extractGeneralViewSections(previewReportOutput: unknown): SectionNode[] {
    const output =
        previewReportOutput && typeof previewReportOutput === "object"
            ? (previewReportOutput as Record<string, unknown>)
            : {};

    const visaoGeralRaw =
        output.visao_geral && typeof output.visao_geral === "object"
            ? (output.visao_geral as Record<string, unknown>)
            : {};

    const secoes = Array.isArray(visaoGeralRaw.secoes) ? visaoGeralRaw.secoes : [];
    if (secoes.length === 0) return FALLBACK_SECTIONS;

    return secoes
        .map((section: any, index: number) => {
            const subitemsRaw = Array.isArray(section?.subitens) ? section.subitens : [];
            const subitems = subitemsRaw
                .map((subitem: any, subIndex: number) => ({
                    key: getSubitemConfigKey(subitem || { ordem: subIndex + 1 }),
                    title:
                        String(subitem?.titulo || subitem?.subitem_relatorio || `Subitem ${subIndex + 1}`),
                    ordem: Number(subitem?.ordem || subIndex + 1),
                }))
                .sort((a, b) => a.ordem - b.ordem);

            return {
                codigo: String(section?.codigo || `secao_${index + 1}`),
                titulo: String(section?.titulo || `Seção ${index + 1}`),
                ordem: Number(section?.ordem || index + 1),
                subitems,
            };
        })
        .sort((a, b) => a.ordem - b.ordem);
}

function cloneConfig(config: ReportVisibilityConfig): ReportVisibilityConfig {
    return JSON.parse(JSON.stringify(config || {}));
}

function ensureSection(config: ReportVisibilityConfig, sectionCode: string) {
    if (!config.sections) config.sections = {};
    if (!config.sections[sectionCode]) config.sections[sectionCode] = {};
    if (!config.sections[sectionCode].subitems) config.sections[sectionCode].subitems = {};
}

function isRoleLockedParticipant(role: AnalyticalRole): boolean {
    return role === "participant";
}

function asLabelRole(role: AnalyticalRole): string {
    if (role === "participant") return "Participante";
    if (role === "consultant") return "Consultor";
    return "Admin";
}

export default function ReportConfigurationPage({
    empresas,
    previewReportOutput,
}: {
    empresas: Empresa[];
    previewReportOutput?: unknown;
}) {
    const sections = useMemo(
        () => extractGeneralViewSections(previewReportOutput),
        [previewReportOutput],
    );

    const [viewType, setViewType] = useState<ReportViewType>("synthetic");
    const [analyticalRole, setAnalyticalRole] = useState<AnalyticalRole>("participant");
    const [scope, setScope] = useState<ScopeType>("global");
    const [companyId, setCompanyId] = useState<string>("");

    const [globalConfig, setGlobalConfig] = useState<ReportVisibilityConfig>({});
    const [companyOverride, setCompanyOverride] = useState<ReportVisibilityConfig | null>(null);
    const [editConfig, setEditConfig] = useState<ReportVisibilityConfig>({});

    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [previewOpen, setPreviewOpen] = useState(false);

    const [savedSnapshot, setSavedSnapshot] = useState("{}");

    const isDirty = JSON.stringify(editConfig) !== savedSnapshot;

    useEffect(() => {
        const handler = (event: BeforeUnloadEvent) => {
            if (!isDirty) return;
            event.preventDefault();
            event.returnValue = "";
        };
        window.addEventListener("beforeunload", handler);
        return () => window.removeEventListener("beforeunload", handler);
    }, [isDirty]);

    const loadConfigs = async () => {
        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            if (viewType === "synthetic") {
                const config = await getSyntheticReportConfig();
                const nextConfig = cloneConfig(config || {});
                setGlobalConfig(nextConfig);
                setCompanyOverride(null);
                setEditConfig(nextConfig);
                setSavedSnapshot(JSON.stringify(nextConfig));
            } else {
                const result = await getAnalyticalReportConfig(analyticalRole, scope === "company" ? companyId : null);
                const baseGlobal = cloneConfig(result.globalConfig || {});
                const override = result.companyOverride ? cloneConfig(result.companyOverride) : null;

                const effective = resolveReportVisibility({
                    viewType: "analytical",
                    viewerRole: analyticalRole,
                    globalConfig: baseGlobal,
                    companyOverride: scope === "company" ? override : null,
                });

                const effectiveConfig: ReportVisibilityConfig = {
                    enabled: effective.enabled,
                    sections: cloneConfig({ sections: effective.sections }).sections,
                    compliance: { ...effective.compliance },
                };

                setGlobalConfig(baseGlobal);
                setCompanyOverride(override);
                setEditConfig(scope === "global" ? baseGlobal : effectiveConfig);
                setSavedSnapshot(JSON.stringify(scope === "global" ? baseGlobal : effectiveConfig));
            }
        } catch (err) {
            console.error(err);
            setError("Não foi possível carregar a configuração V42 de visibilidade.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadConfigs();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [viewType, analyticalRole, scope, companyId]);

    const handleSafeContextChange = (next: () => void) => {
        if (!isDirty) {
            next();
            return;
        }
        const proceed = window.confirm("Existem alterações não salvas. Deseja descartá-las?");
        if (proceed) {
            next();
        }
    };

    const toggleSection = (sectionCode: string) => {
        setEditConfig((prev) => {
            const next = cloneConfig(prev);
            ensureSection(next, sectionCode);
            const current = next.sections?.[sectionCode]?.enabled;
            next.sections![sectionCode].enabled = current === false ? true : false;
            return next;
        });
    };

    const toggleSubitem = (sectionCode: string, subitemKey: string) => {
        setEditConfig((prev) => {
            const next = cloneConfig(prev);
            ensureSection(next, sectionCode);
            const current = next.sections?.[sectionCode]?.subitems?.[subitemKey];
            next.sections![sectionCode].subitems![subitemKey] = current === false ? true : false;
            return next;
        });
    };

    const setAllCurrentScope = (value: boolean) => {
        setEditConfig((prev) => {
            const next = cloneConfig(prev);
            if (!next.sections) next.sections = {};

            sections.forEach((section) => {
                ensureSection(next, section.codigo);
                next.sections![section.codigo].enabled = value;
                section.subitems.forEach((subitem) => {
                    next.sections![section.codigo].subitems![subitem.key] = value;
                });
            });

            return next;
        });
    };

    const updateCompliance = (
        key: "calculationMemory" | "auditTrail" | "auditUnitContent",
        value: boolean,
    ) => {
        setEditConfig((prev) => {
            const next = cloneConfig(prev);
            if (!next.compliance) next.compliance = {};
            next.compliance[key] = value;
            return next;
        });
    };

    const save = async () => {
        setSaving(true);
        setError(null);
        setSuccess(null);

        try {
            if (viewType === "synthetic") {
                await saveGlobalSyntheticConfig(editConfig);
            } else if (scope === "global") {
                await saveGlobalAnalyticalConfig(analyticalRole, editConfig);
            } else {
                if (!companyId) {
                    throw new Error("Selecione uma empresa para salvar override.");
                }
                const diff = buildCompanyOverrideDiff(globalConfig, editConfig);
                if (isEmptyConfig(diff)) {
                    await resetCompanyAnalyticalOverride(companyId, analyticalRole);
                } else {
                    await saveCompanyAnalyticalOverride(companyId, analyticalRole, diff);
                }
            }

            setSavedSnapshot(JSON.stringify(editConfig));
            setSuccess("Configuração salva com sucesso.");
            await loadConfigs();
        } catch (err) {
            console.error(err);
            setError("Erro ao salvar configuração V42.");
        } finally {
            setSaving(false);
        }
    };

    const resetCompanyOverride = async () => {
        if (!companyId) return;
        setSaving(true);
        setError(null);
        setSuccess(null);

        try {
            await resetCompanyAnalyticalOverride(companyId, analyticalRole);
            setSuccess("Override da empresa removido. Configuração voltou para o padrão global.");
            await loadConfigs();
        } catch (err) {
            console.error(err);
            setError("Não foi possível restaurar o padrão global.");
        } finally {
            setSaving(false);
        }
    };

    const canShowCompliance = viewType === "analytical";
    const participantLocked = viewType === "analytical" && isRoleLockedParticipant(analyticalRole);

    const filteredSections = sections.filter((section) => {
        const q = normalizeText(search);
        if (!q) return true;
        if (normalizeText(section.titulo).includes(q)) return true;
        return section.subitems.some((subitem) => normalizeText(subitem.title).includes(q));
    });

    const previewData = useMemo(() => {
        if (!previewOpen) return null;

        const base =
            previewReportOutput && typeof previewReportOutput === "object"
                ? (previewReportOutput as Record<string, unknown>)
                : {};

        const visaoGeral =
            base.visao_geral && typeof base.visao_geral === "object"
                ? (base.visao_geral as any)
                : { versao: "1.0", secoes: sections.map((s) => ({ codigo: s.codigo, titulo: s.titulo, ordem: s.ordem, subitens: s.subitems.map((si) => ({ ordem: si.ordem, titulo: si.title, subitem_relatorio: si.title })) })) };

        const effective = resolveReportVisibility({
            viewType,
            viewerRole: analyticalRole,
            globalConfig: viewType === "synthetic" ? editConfig : scope === "global" ? editConfig : globalConfig,
            companyOverride: viewType === "analytical" && scope === "company"
                ? buildCompanyOverrideDiff(globalConfig, editConfig)
                : null,
        });

        return applyVisibilityToGeneralView(visaoGeral, effective);
    }, [previewOpen, previewReportOutput, sections, viewType, analyticalRole, editConfig, scope, globalConfig]);

    return (
        <div className="bg-white border border-gray-100 rounded-3xl p-5 md:p-6 shadow-xs space-y-5 animate-fade-in" id="report-parametrization-v42-panel">
            <div className="flex flex-col gap-4">
                <div>
                    <h4 className="text-sm font-black text-[#112363] uppercase tracking-wider">Parametrização do Relatório V42</h4>
                    <p className="text-xs text-gray-500 mt-1">
                        A fonte editorial é única em visao_geral. Sintético e Analítico são composições de visibilidade.
                    </p>
                </div>

                <div className="flex flex-wrap gap-2 bg-gray-100 p-1 rounded-xl w-fit">
                    <button
                        onClick={() => handleSafeContextChange(() => setViewType("synthetic"))}
                        className={`px-4 py-2 rounded-lg text-xs font-black uppercase border transition-all ${viewType === "synthetic"
                                ? "bg-[#112363] text-white border-[#112363]"
                                : "bg-white text-[#071A5F] border-gray-200"
                            }`}
                    >
                        Visão Sintética
                    </button>
                    <button
                        onClick={() => handleSafeContextChange(() => setViewType("analytical"))}
                        className={`px-4 py-2 rounded-lg text-xs font-black uppercase border transition-all ${viewType === "analytical"
                                ? "bg-[#112363] text-white border-[#112363]"
                                : "bg-white text-[#071A5F] border-gray-200"
                            }`}
                    >
                        Visão Analítica
                    </button>
                </div>

                {viewType === "analytical" ? (
                    <div className="space-y-3">
                        <div className="flex flex-wrap gap-2 bg-gray-100 p-1 rounded-xl w-fit">
                            {(["participant", "consultant", "admin"] as AnalyticalRole[]).map((role) => (
                                <button
                                    key={role}
                                    onClick={() => handleSafeContextChange(() => setAnalyticalRole(role))}
                                    className={`px-4 py-2 rounded-lg text-xs font-black uppercase border transition-all ${analyticalRole === role
                                            ? "bg-[#D80E2A] text-white border-[#D80E2A]"
                                            : "bg-white text-[#071A5F] border-gray-200"
                                        }`}
                                >
                                    {asLabelRole(role)}
                                </button>
                            ))}
                        </div>

                        <div className="flex flex-wrap gap-3 items-center">
                            <div className="flex gap-2 bg-gray-100 p-1 rounded-xl">
                                <button
                                    onClick={() => handleSafeContextChange(() => setScope("global"))}
                                    className={`px-4 py-2 rounded-lg text-xs font-black uppercase border transition-all ${scope === "global"
                                            ? "bg-[#112363] text-white border-[#112363]"
                                            : "bg-white text-[#071A5F] border-gray-200"
                                        }`}
                                >
                                    Padrão Global
                                </button>
                                <button
                                    onClick={() => handleSafeContextChange(() => setScope("company"))}
                                    className={`px-4 py-2 rounded-lg text-xs font-black uppercase border transition-all ${scope === "company"
                                            ? "bg-[#112363] text-white border-[#112363]"
                                            : "bg-white text-[#071A5F] border-gray-200"
                                        }`}
                                >
                                    Empresa Específica
                                </button>
                            </div>

                            {scope === "company" ? (
                                <select
                                    value={companyId}
                                    onChange={(event) => handleSafeContextChange(() => setCompanyId(event.target.value))}
                                    className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs min-w-[260px]"
                                >
                                    <option value="">Selecionar empresa</option>
                                    {empresas.map((empresa) => (
                                        <option key={empresa.id} value={empresa.id}>
                                            {empresa.nome}
                                        </option>
                                    ))}
                                </select>
                            ) : null}

                            {scope === "company" ? (
                                <div className="text-[11px] text-gray-500">
                                    {companyOverride ? "Status: PERSONALIZADO" : "Status: HERDADO do padrão global"}
                                </div>
                            ) : null}
                        </div>
                    </div>
                ) : (
                    <div className="text-xs text-gray-500">
                        Configuração global única para a experiência resumida. Não há separação por perfil.
                    </div>
                )}
            </div>

            {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">{error}</div> : null}
            {success ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">{success}</div> : null}

            <div className="flex flex-wrap items-center gap-2">
                <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Buscar seção ou subitem..."
                    className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs min-w-[280px]"
                />
                <button
                    onClick={() => setAllCurrentScope(true)}
                    className="px-3 py-2 rounded-lg text-xs font-black uppercase border border-gray-200 bg-white"
                >
                    Todos
                </button>
                <button
                    onClick={() => setAllCurrentScope(false)}
                    className="px-3 py-2 rounded-lg text-xs font-black uppercase border border-gray-200 bg-white"
                >
                    Nenhum
                </button>
                <button
                    onClick={() => setPreviewOpen((value) => !value)}
                    className="px-3 py-2 rounded-lg text-xs font-black uppercase border border-[#112363] text-[#112363] bg-white"
                >
                    Pré-visualizar
                </button>
            </div>

            {canShowCompliance ? (
                <div className="rounded-2xl border border-gray-150 p-4 space-y-2">
                    <h5 className="text-xs font-black text-[#112363] uppercase tracking-wider">Acesso Técnico</h5>

                    {!participantLocked ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                            <label className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2 text-xs">
                                <span>Memória de Cálculo</span>
                                <input
                                    type="checkbox"
                                    checked={editConfig.compliance?.calculationMemory !== false}
                                    onChange={(event) => updateCompliance("calculationMemory", event.target.checked)}
                                />
                            </label>
                            <label className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2 text-xs">
                                <span>Trilha de Auditoria</span>
                                <input
                                    type="checkbox"
                                    checked={editConfig.compliance?.auditTrail !== false}
                                    onChange={(event) => updateCompliance("auditTrail", event.target.checked)}
                                />
                            </label>
                            <label className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2 text-xs">
                                <span>Conteúdo integral das UCs</span>
                                <input
                                    type="checkbox"
                                    checked={editConfig.compliance?.auditUnitContent !== false}
                                    onChange={(event) => updateCompliance("auditUnitContent", event.target.checked)}
                                />
                            </label>
                        </div>
                    ) : (
                        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">
                            Participante nunca pode acessar Memória de Cálculo, Auditoria técnica ou conteúdo integral das UCs.
                        </div>
                    )}
                </div>
            ) : null}

            {loading ? (
                <div className="p-8 text-center text-xs font-bold text-gray-400">Carregando configuração...</div>
            ) : (
                <div className="space-y-4">
                    {filteredSections.map((section) => {
                        const sectionConfig = editConfig.sections?.[section.codigo] || {};
                        const sectionEnabled = sectionConfig.enabled !== false;
                        const inheritStatus = scope === "company" && viewType === "analytical"
                            ? getSectionInheritanceStatus(section.codigo, companyOverride)
                            : null;

                        return (
                            <div key={section.codigo} className="border border-gray-150 rounded-2xl overflow-hidden">
                                <div className="bg-gray-50 px-4 py-3 flex items-center justify-between gap-3">
                                    <div>
                                        <strong className="text-xs font-black text-[#112363] uppercase tracking-wider">{section.titulo}</strong>
                                        {inheritStatus ? (
                                            <p className="text-[10px] text-gray-500 mt-1">{inheritStatus}</p>
                                        ) : null}
                                    </div>
                                    <button
                                        onClick={() => toggleSection(section.codigo)}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${sectionEnabled ? "bg-[#112363]" : "bg-gray-300"}`}
                                        aria-label={`Alternar seção ${section.titulo}`}
                                    >
                                        <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${sectionEnabled ? "translate-x-5" : "translate-x-1"}`} />
                                    </button>
                                </div>

                                {section.subitems.length > 0 ? (
                                    <div className="divide-y divide-gray-100">
                                        {section.subitems.map((subitem) => {
                                            const itemEnabled = sectionConfig.subitems?.[subitem.key] !== false;
                                            return (
                                                <div key={`${section.codigo}-${subitem.key}`} className="px-4 py-3 flex items-center justify-between gap-3">
                                                    <div>
                                                        <strong className="text-xs font-bold text-gray-800">{subitem.title}</strong>
                                                        <p className="text-[10px] text-gray-400">Chave: {subitem.key}</p>
                                                    </div>
                                                    <button
                                                        onClick={() => toggleSubitem(section.codigo, subitem.key)}
                                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${itemEnabled ? "bg-[#D80E2A]" : "bg-gray-300"}`}
                                                        aria-label={`Alternar subitem ${subitem.title}`}
                                                    >
                                                        <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${itemEnabled ? "translate-x-5" : "translate-x-1"}`} />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : null}
                            </div>
                        );
                    })}
                </div>
            )}

            {previewOpen && previewData ? (
                <div className="rounded-2xl border border-gray-150 p-4 bg-gray-50 space-y-2">
                    <h5 className="text-xs font-black text-[#112363] uppercase tracking-wider">Pré-visualização</h5>
                    <p className="text-xs text-gray-600">
                        Seções visíveis: {Array.isArray(previewData.secoes) ? previewData.secoes.length : 0}
                    </p>
                    <ul className="text-xs text-gray-700 space-y-1">
                        {(previewData.secoes || []).map((section: any) => (
                            <li key={section.codigo}>
                                {section.ordem}. {section.titulo}
                                {Array.isArray(section.subitens) ? ` (${section.subitens.length} subitens)` : ""}
                            </li>
                        ))}
                    </ul>
                </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
                <button
                    onClick={save}
                    disabled={saving || loading || (viewType === "analytical" && scope === "company" && !companyId)}
                    className="bg-[#D80E2A] hover:bg-[#D80E2A]/90 disabled:opacity-60 text-white text-xs font-black px-5 py-2.5 rounded-xl transition-all"
                >
                    {saving ? "Salvando..." : "Salvar configuração"}
                </button>

                {viewType === "analytical" && scope === "company" ? (
                    <button
                        onClick={resetCompanyOverride}
                        disabled={!companyId || saving}
                        className="bg-white border border-gray-200 hover:border-[#112363] text-[#112363] text-xs font-black px-5 py-2.5 rounded-xl transition-all disabled:opacity-60"
                    >
                        Restaurar padrão
                    </button>
                ) : null}

                {isDirty ? <span className="text-xs text-amber-700 self-center">Alterações não salvas</span> : null}
            </div>
        </div>
    );
}
