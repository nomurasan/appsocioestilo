import React, { useEffect, useMemo, useState } from 'react';
import { Radar, BarChart3 } from 'lucide-react';
import {
    buildAnalyticalReportViewModel,
    buildSyntheticReportViewModel,
    type AuditUnitV41,
    type ReportRelationV41,
    type ReportSectionV41,
    type ReportSubitemV41,
    type ReportVariantViewModelV41
} from '../lib/report-v41';
import {
    applyVisibilityToGeneralView,
    normalizeViewerRole,
    resolveReportVisibility,
    type EffectiveReportVisibility
} from '../lib/report-visibility-v42';
import {
    getAnalyticalReportConfig,
    getSyntheticReportConfig
} from '../lib/report-configurations';

const isDev = Boolean((import.meta as { env?: { DEV?: boolean } }).env?.DEV);

function asText(value: unknown): string {
    if (typeof value === 'string') return value;
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    return '';
}

function getStyleColor(style: string): string {
    const normalized = style
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();

    if (normalized.includes('assert')) return 'bg-amber-500';
    if (normalized.includes('particip')) return 'bg-[#D80E2A]';
    if (normalized.includes('integr')) return 'bg-emerald-500';
    return 'bg-[#112363]';
}

function getScoreValue(scores: Record<string, number>, key: string): number {
    const normalized = key
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
    if (normalized.includes('assert')) return Number(scores.Assertivo ?? scores.assertivo ?? 0);
    if (normalized.includes('particip')) return Number(scores.Participativo ?? scores.participativo ?? 0);
    if (normalized.includes('integr')) return Number(scores.Integrador ?? scores.integrador ?? 0);
    return Number((scores as Record<string, number>)['Analítico'] ?? scores.Analitico ?? scores.analitico ?? 0);
}

function ReportVariantSwitcher({
    selected,
    onChange
}: {
    selected: 'sintetico' | 'detalhado';
    onChange: (value: 'sintetico' | 'detalhado') => void;
}) {
    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 print:hidden">
            <div className="text-xs font-black uppercase tracking-wider text-[#112363]">Visão do relatório</div>
            <div className="mt-3 flex flex-col sm:flex-row gap-2">
                <button
                    type="button"
                    onClick={() => onChange('sintetico')}
                    className={`px-4 py-2 rounded-xl text-xs font-black transition ${selected === 'sintetico' ? 'bg-[#112363] text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                >
                    Relatório Sintético
                </button>
                <button
                    type="button"
                    onClick={() => onChange('detalhado')}
                    className={`px-4 py-2 rounded-xl text-xs font-black transition ${selected === 'detalhado' ? 'bg-[#112363] text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                >
                    Relatório Analítico
                </button>
            </div>
            <p className="mt-3 text-xs text-slate-500 leading-relaxed">
                {selected === 'sintetico'
                    ? 'Leitura essencial dos principais resultados.'
                    : 'Leitura completa dos conceitos, relações, desenvolvimento e rastreabilidade.'}
            </p>
        </div>
    );
}

function ReportSubitemBlock({
    sectionOrder,
    subitem,
    relationOrder,
    relationSubitemOrder
}: {
    sectionOrder: number;
    subitem: ReportSubitemV41;
    relationOrder?: number;
    relationSubitemOrder?: number;
}) {
    const numbering = relationOrder !== undefined && relationSubitemOrder !== undefined
        ? `${sectionOrder}.${relationOrder}.${relationSubitemOrder}`
        : `${sectionOrder}.${subitem.ordem}`;

    if (!subitem.conteudo) {
        if (isDev) {
            return <p className="text-xs text-amber-700">Conteúdo editorial não disponível.</p>;
        }
        return null;
    }

    return (
        <article className="space-y-2">
            <h5 className="text-[11px] font-black uppercase tracking-wider text-[#112363]">
                {numbering} {subitem.titulo}
            </h5>
            <p className="text-sm leading-7 whitespace-pre-line text-slate-700">{subitem.conteudo}</p>
        </article>
    );
}

function ReportEditorialSection({ section }: { section: ReportSectionV41 }) {
    if (section.status === 'insufficient_evidence') {
        if (isDev) {
            return <p className="text-xs text-amber-700">Conteúdo editorial não disponível.</p>;
        }
        console.warn('[ReportV41] Seção sem evidência:', section.codigo);
        return null;
    }

    return (
        <section className="space-y-4">
            {(section.subitens || []).map((subitem) => (
                <div key={`${section.codigo}-${subitem.ordem}-${subitem.titulo}`}>
                    <ReportSubitemBlock
                        sectionOrder={section.ordem}
                        subitem={subitem}
                    />
                </div>
            ))}
        </section>
    );
}

function ReportRelationsSection({ section }: { section: ReportSectionV41 }) {
    const relacoes = (section.relacoes || []).slice().sort((a, b) => a.ordem - b.ordem);
    if (relacoes.length === 0) {
        if (isDev) return <p className="text-xs text-amber-700">Conteúdo editorial não disponível.</p>;
        return null;
    }

    return (
        <div className="space-y-6">
            {relacoes.map((relacao) => (
                <section key={`${section.codigo}-rel-${relacao.ordem}`} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <h5 className="text-[11px] font-black uppercase tracking-wider text-[#112363]">
                        {section.ordem}.{relacao.ordem} {relacao.titulo || `${relacao.perfil_principal} × ${relacao.perfil_relacionado}`}
                    </h5>
                    <p className="text-[11px] text-slate-500 mt-1 uppercase tracking-wider">
                        {relacao.perfil_principal} × {relacao.perfil_relacionado}
                    </p>

                    <div className="mt-4 space-y-4">
                        {relacao.subitens.map((subitem, index) => (
                            <div key={`${section.codigo}-rel-${relacao.ordem}-sub-${index + 1}`}>
                                <ReportSubitemBlock
                                    sectionOrder={section.ordem}
                                    relationOrder={relacao.ordem}
                                    relationSubitemOrder={subitem.ordem}
                                    subitem={subitem}
                                />
                            </div>
                        ))}
                    </div>
                </section>
            ))}
        </div>
    );
}

function RadarChart({ scores }: { scores: Record<string, number> }) {
    const assertivo = getScoreValue(scores, 'Assertivo');
    const participativo = getScoreValue(scores, 'Participativo');
    const integrador = getScoreValue(scores, 'Integrador');
    const analitico = getScoreValue(scores, 'Analítico');

    const maxScore = Math.max(1, assertivo, participativo, integrador, analitico);
    const scale = 65 / maxScore;

    const rAssertivo = assertivo * scale;
    const rParticipativo = participativo * scale;
    const rIntegrador = integrador * scale;
    const rAnalitico = analitico * scale;

    const cx = 100;
    const cy = 100;

    const ptAssertivo = { x: cx, y: cy - rAssertivo };
    const ptParticipativo = { x: cx + rParticipativo, y: cy };
    const ptIntegrador = { x: cx, y: cy + rIntegrador };
    const ptAnalitico = { x: cx - rAnalitico, y: cy };

    const polyStr = `${ptAssertivo.x.toFixed(1)},${ptAssertivo.y.toFixed(1)} ${ptParticipativo.x.toFixed(1)},${ptParticipativo.y.toFixed(1)} ${ptIntegrador.x.toFixed(1)},${ptIntegrador.y.toFixed(1)} ${ptAnalitico.x.toFixed(1)},${ptAnalitico.y.toFixed(1)}`;
    const levels = [0.25, 0.5, 0.75, 1.0];

    return (
        <div className="flex flex-col items-center justify-between p-5 bg-slate-50 rounded-2xl border border-slate-100 shadow-3xs w-full min-h-[220px]">
            <h4 className="text-[10px] font-black text-[#112363] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Radar className="w-4 h-4" /> Gráfico Radial
            </h4>
            <svg viewBox="0 0 200 200" className="w-44 h-44 shrink-0">
                {levels.map((lvl, index) => {
                    const r = lvl * 65;
                    const p0 = { x: cx, y: cy - r };
                    const p1 = { x: cx + r, y: cy };
                    const p2 = { x: cx, y: cy + r };
                    const p3 = { x: cx - r, y: cy };
                    return (
                        <polygon
                            key={`level-${index}`}
                            points={`${p0.x},${p0.y} ${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y}`}
                            fill="none"
                            stroke="#e2e8f0"
                            strokeWidth="1"
                            strokeDasharray="2,2"
                        />
                    );
                })}
                <line x1={cx} y1={cy - 65} x2={cx} y2={cy + 65} stroke="#e2e8f0" strokeWidth="1" />
                <line x1={cx - 65} y1={cy} x2={cx + 65} y2={cy} stroke="#e2e8f0" strokeWidth="1" />

                <polygon points={polyStr} fill="rgba(17, 35, 99, 0.18)" stroke="#112363" strokeWidth="2.5" />

                <circle cx={ptAssertivo.x} cy={ptAssertivo.y} r="3.5" fill="#f59e0b" stroke="#ffffff" strokeWidth="1" />
                <circle cx={ptParticipativo.x} cy={ptParticipativo.y} r="3.5" fill="#D80E2A" stroke="#ffffff" strokeWidth="1" />
                <circle cx={ptIntegrador.x} cy={ptIntegrador.y} r="3.5" fill="#10b981" stroke="#ffffff" strokeWidth="1" />
                <circle cx={ptAnalitico.x} cy={ptAnalitico.y} r="3.5" fill="#112363" stroke="#ffffff" strokeWidth="1" />
            </svg>
        </div>
    );
}

function BarsChart({ ranking }: { ranking: ReportVariantViewModelV41['resultadoCalculado']['ranking'] }) {
    const ordered = [...ranking].sort((a, b) => a.ordem - b.ordem);
    const max = Math.max(1, ...ordered.map((item) => item.score));

    return (
        <div className="flex flex-col justify-between p-5 bg-slate-50 rounded-2xl border border-slate-100 shadow-3xs w-full min-h-[220px]">
            <h4 className="text-[10px] font-black text-[#112363] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <BarChart3 className="w-4 h-4" /> Gráfico de Barras
            </h4>
            <div className="space-y-3">
                {ordered.map((item) => {
                    const width = Math.round((item.score / max) * 100);
                    return (
                        <div key={`${item.ordem}-${item.perfil}-${item.papel}`} className="space-y-1">
                            <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                                <span className="flex items-center gap-1.5 font-extrabold uppercase text-[9px] tracking-wide">
                                    <span className={`w-2.5 h-2.5 rounded-full ${getStyleColor(item.perfil)}`} />
                                    {item.perfil}
                                    <span className="text-slate-400 normal-case">{item.papel}</span>
                                </span>
                                <span className="font-black text-[#112363]">
                                    {item.score} pts{item.percentual !== undefined ? ` (${item.percentual}%)` : ''}
                                </span>
                            </div>
                            <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                                <div className="bg-gradient-to-r from-slate-600 to-slate-800 h-full rounded-full" style={{ width: `${Math.max(8, width)}%` }} />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function ReportMetricsSection({ section, vm }: { section: ReportSectionV41; vm: ReportVariantViewModelV41 }) {
    const dados = section.dados || {};
    const sectionScores = (dados.scores as Record<string, number> | undefined) || vm.resultadoCalculado.scores;
    const sectionRanking = (Array.isArray(dados.ranking) && dados.ranking.length > 0
        ? (dados.ranking as ReportVariantViewModelV41['resultadoCalculado']['ranking'])
        : vm.resultadoCalculado.ranking
    ).slice().sort((a, b) => a.ordem - b.ordem);

    const showRadar = dados.exibir_grafico_radial !== false;
    const showBars = dados.exibir_grafico_barras !== false;

    return (
        <section className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
                {showRadar ? <RadarChart scores={sectionScores} /> : null}
                {showBars ? <BarsChart ranking={sectionRanking} /> : null}
            </div>
        </section>
    );
}

function ReportCalculationMemory({ memoriaCalculo }: { memoriaCalculo: Record<string, unknown> }) {
    const respostas = Array.isArray(memoriaCalculo.respostas) ? memoriaCalculo.respostas : [];

    return (
        <div className="space-y-4">
            <h4 className="text-xs font-black text-[#112363] uppercase tracking-wider">10.1 Respostas do Questionário</h4>
            {respostas.length > 0 ? (
                <div className="max-w-full overflow-hidden border border-slate-150 rounded-2xl bg-white shadow-3xs max-h-[280px] overflow-y-auto w-full">
                    <table className="w-full table-fixed divide-y divide-slate-150 text-[9px] md:text-[10px]">
                        <thead className="bg-slate-100 font-extrabold text-[#112363] uppercase tracking-wider sticky top-0 z-10 text-[8px] md:text-[10px]">
                            <tr>
                                <th className="px-2 md:px-4 py-2 md:py-2.5 text-left">Questão</th>
                                <th className="px-2 md:px-4 py-2 md:py-2.5 text-left">Resposta Selecionada</th>
                                <th className="px-2 md:px-4 py-2 md:py-2.5 text-left">Estilo da Resposta</th>
                                <th className="px-2 md:px-4 py-2 md:py-2.5 text-right">Pontos</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-150 text-slate-700 font-semibold bg-white">
                            {respostas.map((item, index) => {
                                const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
                                return (
                                    <tr key={`mem-v41-${index}`}>
                                        <td className="px-2 md:px-3 py-1.5 md:py-2 truncate text-[9px] md:text-[10px]">{asText(row.questao || row.question || `Q${row.questionId || row.question_id || index + 1}`)}</td>
                                        <td className="px-2 md:px-3 py-1.5 md:py-2 italic font-medium text-[9px] md:text-[10px] break-words">{asText(row.resposta || row.answer || row.user_answer)}</td>
                                        <td className="px-2 md:px-3 py-1.5 md:py-3 font-extrabold text-[#D80E2A] text-[9px] md:text-[10px] break-words">{asText(row.socioEstilo || row.socioStyle || row.socio_estilo)}</td>
                                        <td className="px-2 md:px-4 py-1.5 md:py-2 text-right font-black text-slate-550 text-[9px] md:text-[10px]">{asText(row.pontos || row.points || 0)}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            ) : isDev ? (
                <p className="text-xs text-amber-700">Conteúdo editorial não disponível.</p>
            ) : null}
        </div>
    );
}

function ReportAuditTrail({ units, canShowUnitContent }: { units: AuditUnitV41[]; canShowUnitContent: boolean }) {
    return (
        <div className="space-y-4">
            <h4 className="text-xs font-black text-[#112363] uppercase tracking-wider">10.2 Trilha de Auditoria das Unidades de Conhecimento</h4>
            <div className="space-y-3">
                {units.length === 0 ? (isDev ? <p className="text-xs text-amber-700">Conteúdo editorial não disponível.</p> : null) : null}
                {units.map((unit, index) => (
                    <details key={`${unit.id_unidade}-${index}`} className="rounded-xl border border-slate-200 bg-white p-3" open>
                        <summary className="cursor-pointer text-sm font-bold text-slate-700">
                            {unit.id_unidade} | {unit.descricao}
                        </summary>
                        <div className="mt-3 space-y-2 text-xs text-slate-600">
                            {unit.campo_relatorio_principal ? <p><strong>Campo:</strong> {unit.campo_relatorio_principal}</p> : null}
                            {unit.subitem_relatorio ? <p><strong>Subitem:</strong> {unit.subitem_relatorio}</p> : null}
                            {unit.perfil_principal ? <p><strong>Perfil principal:</strong> {unit.perfil_principal}</p> : null}
                            {unit.perfil_relacionado ? <p><strong>Perfil relacionado:</strong> {unit.perfil_relacionado}</p> : null}
                            {unit.conteudo && canShowUnitContent ? (
                                <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
                                    <p className="text-[11px] font-black uppercase tracking-wider text-[#112363] mb-2">Conteúdo</p>
                                    <p className="text-sm leading-7 whitespace-pre-line text-slate-700">{unit.conteudo}</p>
                                </div>
                            ) : null}
                        </div>
                    </details>
                ))}
            </div>
        </div>
    );
}

function ReportComplianceSection({
    section,
    vm,
    effectiveVisibility
}: {
    section: ReportSectionV41;
    vm: ReportVariantViewModelV41;
    effectiveVisibility: EffectiveReportVisibility;
}) {
    const canShowMemory = effectiveVisibility.compliance.calculationMemory;
    const canShowAudit = effectiveVisibility.compliance.auditTrail;
    const canShowUnitContent = effectiveVisibility.compliance.auditUnitContent;

    return (
        <section className="space-y-5">
            {vm.variantKey === 'detalhado' ? (
                <>
                    {canShowMemory ? <ReportCalculationMemory memoriaCalculo={vm.memoriaCalculo} /> : null}
                    {canShowAudit ? <ReportAuditTrail units={vm.auditoria.unidades_utilizadas || []} canShowUnitContent={canShowUnitContent} /> : null}
                    {!canShowMemory && !canShowAudit ? <ReportEditorialSection section={section} /> : null}
                </>
            ) : (
                <ReportEditorialSection section={section} />
            )}
        </section>
    );
}

function ReportSectionRenderer({
    section,
    vm,
    effectiveVisibility
}: {
    section: ReportSectionV41;
    vm: ReportVariantViewModelV41;
    effectiveVisibility: EffectiveReportVisibility;
}) {
    if (section.status === 'insufficient_evidence') {
        if (isDev) {
            return <p className="text-xs text-amber-700">Conteúdo editorial não disponível.</p>;
        }
        console.warn('[ReportV41] Seção sem evidência:', section.codigo);
        return null;
    }

    switch (section.codigo) {
        case 'conheca_quatro_socioestilos':
            return (
                <section className="space-y-3">
                    <div className="w-full overflow-hidden rounded-2xl border border-slate-150 bg-white shadow-3xs print:break-inside-avoid">
                        <picture>
                            <source media="(max-width: 767px)" srcSet="/report/papeis-socioestilo-mobile.png" />
                            <img src="/report/papeis-socioestilo-desktop.png" alt="Os quatro papéis psicológicos do Sócio Estilo" className="w-full h-auto object-contain" />
                        </picture>
                    </div>
                    <ReportEditorialSection section={section} />
                </section>
            );

        case 'distribuicao_metrica_energia':
            return <ReportMetricsSection section={section} vm={vm} />;

        case 'perfil_dominante':
        case 'perfil_secundario':
        case 'lado_luz':
        case 'lado_sombra':
        case 'estilo_a_desenvolver':
        case 'recomendacoes':
            return <ReportEditorialSection section={section} />;

        case 'relacoes_entre_socioestilos':
            return <ReportRelationsSection section={section} />;

        case 'conformidade_rastreabilidade_auditoria':
            return <ReportComplianceSection section={section} vm={vm} effectiveVisibility={effectiveVisibility} />;

        default:
            return <ReportEditorialSection section={section} />;
    }
}

function SectionHeader({ section }: { section: ReportSectionV41 }) {
    const profileSuffix = section.perfil ? ` — ${section.perfil}` : '';
    return (
        <h3 className="text-sm font-black text-[#112363] uppercase tracking-wider">
            {section.ordem}. {section.titulo}{profileSuffix}
        </h3>
    );
}

function getFilteredSections(
    vm: ReportVariantViewModelV41,
    visibility: EffectiveReportVisibility,
): ReportSectionV41[] {
    const filtered = applyVisibilityToGeneralView(
        {
            versao: vm.output.visao_geral.versao,
            secoes: vm.sections as unknown as any[],
        },
        visibility,
    );

    return filtered.secoes as unknown as ReportSectionV41[];
}

export default function ReportV41({
    resultado,
    viewerRole,
    companyId
}: {
    resultado: unknown;
    viewerRole?: string;
    companyId?: string | null;
}) {
    const synthetic = useMemo(() => buildSyntheticReportViewModel(resultado), [resultado]);
    const analytical = useMemo(() => buildAnalyticalReportViewModel(resultado), [resultado]);
    const [variant, setVariant] = useState<'sintetico' | 'detalhado'>('sintetico');
    const [loadingVisibility, setLoadingVisibility] = useState(true);

    const [syntheticVisibility, setSyntheticVisibility] = useState<EffectiveReportVisibility>(() =>
        resolveReportVisibility({
            viewType: 'synthetic',
            globalConfig: {},
        }),
    );

    const [analyticalVisibility, setAnalyticalVisibility] = useState<EffectiveReportVisibility>(() =>
        resolveReportVisibility({
            viewType: 'analytical',
            viewerRole: normalizeViewerRole(viewerRole || 'participant'),
            globalConfig: {},
            companyOverride: null,
        }),
    );

    useEffect(() => {
        let cancelled = false;

        async function loadVisibility() {
            setLoadingVisibility(true);
            try {
                const syntheticGlobal = await getSyntheticReportConfig();
                const syntheticEffective = resolveReportVisibility({
                    viewType: 'synthetic',
                    globalConfig: syntheticGlobal,
                });

                const role = normalizeViewerRole(viewerRole || 'participant');
                const analyticalConfigs = await getAnalyticalReportConfig(role, companyId || null);
                const analyticalEffective = resolveReportVisibility({
                    viewType: 'analytical',
                    viewerRole: role,
                    globalConfig: analyticalConfigs.globalConfig,
                    companyOverride: analyticalConfigs.companyOverride,
                });

                if (!cancelled) {
                    setSyntheticVisibility(syntheticEffective);
                    setAnalyticalVisibility(analyticalEffective);
                }
            } catch (error) {
                console.warn('[Report] Falha ao carregar configurações de visibilidade. Usando defaults:', error);
                if (!cancelled) {
                    const role = normalizeViewerRole(viewerRole || 'participant');
                    setSyntheticVisibility(
                        resolveReportVisibility({
                            viewType: 'synthetic',
                            globalConfig: {},
                        }),
                    );
                    setAnalyticalVisibility(
                        resolveReportVisibility({
                            viewType: 'analytical',
                            viewerRole: role,
                            globalConfig: {},
                            companyOverride: null,
                        }),
                    );
                }
            } finally {
                if (!cancelled) {
                    setLoadingVisibility(false);
                }
            }
        }

        loadVisibility();

        return () => {
            cancelled = true;
        };
    }, [viewerRole, companyId]);

    const vm = variant === 'sintetico' ? synthetic : analytical;
    const effectiveVisibility = variant === 'sintetico' ? syntheticVisibility : analyticalVisibility;

    if (!synthetic || !analytical || !vm) {
        return (
            <div className="lg:col-span-3 rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-900" role="alert">
                Não foi possível carregar o contrato canônico deste relatório.
            </div>
        );
    }

    const sections = getFilteredSections(vm, effectiveVisibility);

    const fullName = asText(vm.identificacao.nome || vm.identificacao.userName || 'Participante');
    const companyName = asText(vm.identificacao.empresa || vm.identificacao.companyName || 'Empresa');
    const generatedAt = asText(vm.identificacao.generated_at || vm.identificacao.generatedAt || vm.identificacao.data_conclusao);
    const contractLabel = asText(vm.output.contractVersion || vm.output.contract_version || 'V43');

    return (
        <div className="lg:col-span-3 min-w-0 max-w-full space-y-6 md:space-y-8" id="participant-report-v41">
            <div className="bg-white rounded-3xl border border-gray-150 shadow-xs p-5 md:p-8 space-y-4">
                <div className="flex justify-between items-start gap-4 border-b border-gray-100 pb-3">
                    <div>
                        <h2 className="text-lg font-black text-[#112363] uppercase tracking-wider">Relatório Sócio Estilo</h2>
                        <p className="text-xs text-slate-500 mt-1">Fonte oficial: resultados.report_output</p>
                    </div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase">Contrato {contractLabel}</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <span className="uppercase text-[9px] text-slate-500 font-black tracking-wider">Colaborador</span>
                        <p className="font-black text-[#112363] mt-1">{fullName}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <span className="uppercase text-[9px] text-slate-500 font-black tracking-wider">Empresa</span>
                        <p className="font-black text-[#112363] mt-1">{companyName}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <span className="uppercase text-[9px] text-slate-500 font-black tracking-wider">Gerado em</span>
                        <p className="font-black text-[#112363] mt-1">{generatedAt ? new Date(generatedAt).toLocaleString('pt-BR') : '-'}</p>
                    </div>
                </div>

                <ReportVariantSwitcher selected={variant} onChange={setVariant} />

                {loadingVisibility ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-500">
                        Carregando composição de visibilidade...
                    </div>
                ) : null}

                {vm.validation.errors.length > 0 || vm.validation.warnings.length > 0 ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
                        {vm.validation.errors.map((item) => <p key={`err-${item}`}>{item}</p>)}
                        {vm.validation.warnings.map((item) => <p key={`warn-${item}`}>{item}</p>)}
                    </div>
                ) : null}
            </div>

            <div className="space-y-5">
                {sections.map((section) => (
                    <section key={`${vm.variantKey}-${section.codigo}-${section.ordem}`} className="bg-white rounded-3xl border border-gray-150 shadow-xs p-5 md:p-8 space-y-4 print:break-inside-avoid">
                        <SectionHeader section={section} />
                        <ReportSectionRenderer section={section} vm={vm} effectiveVisibility={effectiveVisibility} />
                    </section>
                ))}
            </div>

            <style>{`
        @media print {
          #participant-report-v41 .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
        </div>
    );
}
