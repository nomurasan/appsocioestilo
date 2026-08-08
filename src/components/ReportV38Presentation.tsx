import React from 'react';
import { Bot, BookOpen, CheckCircle2, FileText, Moon, Sun, TrendingUp, Star, Zap } from 'lucide-react';
import type { ReportV38Section, ReportV38ViewModel } from '../lib/report-v38';

const isDev = Boolean((import.meta as { env?: { DEV?: boolean } }).env?.DEV);

function asString(value: unknown): string {
    if (typeof value === 'string') return value;
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    return '';
}

function renderParagraphs(text: string) {
    const paragraphs = text
        .split(/\n{2,}/)
        .map((item) => item.trim())
        .filter(Boolean);

    if (paragraphs.length === 0) {
        return null;
    }

    return paragraphs.map((paragraph, index) => (
        <p key={`${index}-${paragraph.slice(0, 24)}`} className="text-sm leading-7 text-slate-700 whitespace-pre-line">
            {paragraph}
        </p>
    ));
}

function renderSectionBody(section: ReportV38Section) {
    if (!section.texto && section.itens.length === 0 && section.subitens.length === 0) {
        return isDev ? (
            <p className="text-sm text-slate-500">Conteúdo editorial não disponível.</p>
        ) : null;
    }

    return (
        <div className="space-y-4">
            {section.texto ? <div className="space-y-3">{renderParagraphs(section.texto)}</div> : null}
            {section.itens.length > 0 ? (
                <ul className="list-disc pl-5 space-y-2 text-sm leading-7 text-slate-700">
                    {section.itens.map((item, index) => <li key={`${section.id}-item-${index}`}>{item}</li>)}
                </ul>
            ) : null}
            {section.subitens.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    {section.subitens.map((item, index) => (
                        <div key={`${section.id}-sub-${index}`} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                            <div className="text-[10px] font-black uppercase tracking-wider text-[#112363]">
                                {asString(item.subitem_relatorio || item.campo_relatorio_principal || item.id_unidade || `Subitem ${index + 1}`)}
                            </div>
                            {item.conteudo_relatorio ? <p className="mt-2 whitespace-pre-line leading-7 text-slate-700">{item.conteudo_relatorio}</p> : null}
                        </div>
                    ))}
                </div>
            ) : null}
        </div>
    );
}

function PageShell({ id, title, subtitle, children, className = '' }: {
    id: string;
    title: string;
    subtitle?: string;
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <div id={id} className={`bg-white rounded-3xl border border-gray-150 shadow-xs p-5 md:p-8 space-y-5 min-h-[580px] flex flex-col justify-between print:break-after-page ${className}`}>
            <div className="space-y-4 w-full font-sans">
                <div className="flex justify-between items-center border-b border-gray-100 pb-3 w-full gap-4">
                    <div className="min-w-0">
                        <h3 className="text-sm font-black text-[#112363] uppercase tracking-wider">{title}</h3>
                        {subtitle ? <p className="text-[10px] uppercase tracking-widest text-slate-400 mt-1">{subtitle}</p> : null}
                    </div>
                    <span className="text-[10px] font-bold text-gray-400 italic">Relatório V38</span>
                </div>
                {children}
            </div>
        </div>
    );
}

function RankingBars({ ranking }: { ranking: ReportV38ViewModel['ranking'] }) {
    return (
        <div className="space-y-3">
            {ranking.map((item) => {
                const width = Math.max(8, Math.min(100, item.score));
                const badgeClass = item.papel === 'Dominante'
                    ? 'bg-amber-100 text-amber-800 border-amber-300'
                    : item.papel === 'Auxiliar'
                        ? 'bg-red-100 text-red-800 border-red-300'
                        : item.papel === 'Terciário'
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            : 'bg-slate-100 text-slate-700 border-slate-200';
                const barClass = item.papel === 'Dominante'
                    ? 'bg-gradient-to-r from-amber-400 to-amber-600'
                    : item.papel === 'Auxiliar'
                        ? 'bg-gradient-to-r from-red-500 to-red-700'
                        : item.papel === 'Terciário'
                            ? 'bg-gradient-to-r from-emerald-400 to-emerald-600'
                            : 'bg-gradient-to-r from-slate-600 to-slate-800';

                return (
                    <div key={`${item.papel}-${item.perfil}`} className="space-y-1.5">
                        <div className="flex justify-between items-center gap-3 text-xs font-bold text-slate-700">
                            <span className="flex items-center gap-2 font-extrabold uppercase tracking-wide text-[9px]">
                                <span className={`w-2.5 h-2.5 rounded-full border ${badgeClass}`} />
                                {item.perfil}
                                <span className="text-slate-400 normal-case">{item.papel}</span>
                            </span>
                            <span className="font-black text-[#112363]">{item.score} pts</span>
                        </div>
                        <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                            <div className={`${barClass} h-full rounded-full`} style={{ width: `${width}%` }} />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function AuditTable({ units }: { units: ReportV38ViewModel['audit']['unidades_utilizadas'] }) {
    if (units.length === 0) {
        return isDev ? <p className="text-sm text-slate-500">Conteúdo editorial não disponível.</p> : null;
    }

    return (
        <div className="max-w-full overflow-hidden rounded-2xl border border-slate-150 bg-white shadow-3xs print:break-inside-avoid">
            <div className="overflow-x-auto">
                <table className="w-full text-left text-[11px]">
                    <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider text-[9px] font-black">
                        <tr>
                            <th className="px-3 py-2">Unidade</th>
                            <th className="px-3 py-2">Descrição</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {units.map((item) => (
                            <tr key={item.id_unidade}>
                                <td className="px-3 py-2 font-semibold text-slate-800">{item.id_unidade}</td>
                                <td className="px-3 py-2 text-slate-700 font-medium">{item.descricao}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function MemoryTable({ answers }: { answers: ReportV38ViewModel['memory']['answers'] }) {
    if (!Array.isArray(answers) || answers.length === 0) {
        return isDev ? <p className="text-sm text-slate-500">Conteúdo editorial não disponível.</p> : null;
    }

    const firstRow = answers[0] as Record<string, unknown> | undefined;
    const hasStructuredColumns = firstRow && typeof firstRow === 'object' && !Array.isArray(firstRow) && ('question' in firstRow || 'questionId' in firstRow || 'answer' in firstRow);

    if (!hasStructuredColumns) {
        return <pre className="text-[10px] leading-6 whitespace-pre-wrap text-slate-700 bg-slate-50 rounded-2xl border border-slate-200 p-4">{JSON.stringify(answers, null, 2)}</pre>;
    }

    return (
        <div className="max-w-full overflow-hidden border border-slate-150 rounded-2xl bg-white shadow-3xs max-h-[280px] overflow-y-auto w-full">
            <table className="w-full table-fixed divide-y divide-slate-150 text-[9px] md:text-[10px]">
                <thead className="bg-slate-100 font-extrabold text-[#112363] uppercase tracking-wider sticky top-0 z-10 text-[8px] md:text-[10px]">
                    <tr>
                        <th className="px-2 md:px-4 py-2 md:py-2.5 text-left">Questão</th>
                        <th className="px-2 md:px-4 py-2 md:py-2.5 text-left">Resposta</th>
                        <th className="px-2 md:px-4 py-2 md:py-2.5 text-left">Estilo</th>
                        <th className="px-2 md:px-4 py-2 md:py-2.5 text-right">Pontos</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 text-slate-700 font-semibold bg-white">
                    {answers.map((item, index) => {
                        const record = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
                        return (
                            <tr key={`mem-${index}`} className="hover:bg-slate-50/50">
                                <td className="px-2 md:px-3 py-1.5 md:py-2 truncate text-[9px] md:text-[10px]">{asString(record.question || record.questao || record.question_text || `Q${record.questionId || record.question_id || index + 1}`)}</td>
                                <td className="px-2 md:px-3 py-1.5 md:py-2 italic font-medium text-[9px] md:text-[10px] break-words">{asString(record.answer || record.resposta || record.user_answer)}</td>
                                <td className="px-2 md:px-3 py-1.5 md:py-3 font-extrabold text-[#D80E2A] text-[9px] md:text-[10px] break-words">{asString(record.socioStyle || record.socio_estilo || record.socioEstilo)}</td>
                                <td className="px-2 md:px-4 py-1.5 md:py-2 text-right font-black text-slate-550 text-[9px] md:text-[10px]">{asString(record.points || record.pontos || 0)}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

export default function ReportV38Presentation({ report }: { report: ReportV38ViewModel }) {
    const hasWarnings = report.warnings.length > 0 || report.errors.length > 0;

    return (
        <div className="lg:col-span-3 min-w-0 max-w-full space-y-6 md:space-y-8" id="participant-report-v38">
            {hasWarnings ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 print:hidden">
                    <div className="font-black uppercase tracking-wider text-[10px] mb-2">Validação do snapshot</div>
                    <div className="space-y-1 text-xs leading-6">
                        {report.errors.map((item) => <p key={item}>{item}</p>)}
                        {report.warnings.map((item) => <p key={item}>{item}</p>)}
                    </div>
                </div>
            ) : null}

            <PageShell
                id="p-page-1"
                title="POTENCIAR"
                subtitle="Capa do Relatório"
                className="relative overflow-hidden"
            >
                <div className="absolute top-0 right-0 w-80 h-80 bg-red-50/10 rounded-full translate-x-24 -translate-y-24 shrink-0 pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-slate-50/15 rounded-full -translate-x-12 translate-y-12 shrink-0 pointer-events-none" />
                <div className="my-auto py-12 space-y-6 relative z-10">
                    <span className="text-xs font-black text-[#D80E2A] uppercase tracking-wider bg-red-50 py-1.5 px-4 rounded-full border border-red-100 w-fit inline-block">
                        Relatório Executivo V38
                    </span>
                    <h1 className="text-4xl md:text-5xl font-black text-[#112363] leading-tight tracking-tight">
                        Mapeamento de Socioestilo
                    </h1>
                    <p className="text-slate-500 text-sm max-w-xl leading-relaxed">
                        {report.profileSections.predominant.texto || 'Snapshot editorial determinístico do relatório do participante.'}
                    </p>
                    <div className="pt-4 flex items-center space-x-4">
                        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 flex items-center justify-between space-x-10">
                            <div className="space-y-1">
                                <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Código de Autenticação</span>
                                <p className="font-mono text-xs font-bold text-slate-700">{report.identification.reportUuid || 'UUID-N/A'}</p>
                            </div>
                            <div className="w-12 h-12 bg-white border border-gray-200 rounded-lg p-1 flex flex-col justify-between shrink-0">
                                <div className="flex justify-between w-full h-1/3">
                                    <div className="w-[30%] h-full bg-[#112363] rounded-xxs" />
                                    <div className="w-[30%] h-full bg-[#112363] rounded-xxs" />
                                </div>
                                <div className="flex justify-between w-full h-1/3">
                                    <div className="w-[30%] h-full bg-[#112363] rounded-xxs" />
                                    <div className="w-[30%] h-full bg-red-500 rounded-xxs" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="border-t border-gray-150 pt-8 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 relative z-10 text-xs w-full">
                    <div>
                        <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wide block">Colaborador</span>
                        <strong className="text-[#112363] font-black text-sm mt-1 block">{report.identification.name || 'Participante'}</strong>
                    </div>
                    <div>
                        <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wide block">Empresa</span>
                        <strong className="text-slate-700 font-extrabold text-sm mt-1 block">{report.identification.company || 'Empresa'}</strong>
                    </div>
                    <div>
                        <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wide block">Realizado em</span>
                        <strong className="text-slate-700 font-extrabold text-sm mt-1 block">{report.identification.generatedAt ? new Date(report.identification.generatedAt).toLocaleDateString('pt-BR') : ''}</strong>
                    </div>
                    <div>
                        <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wide block">Estilo Predominante</span>
                        <strong className="text-[#D80E2A] font-black text-sm mt-1 block">{report.dominantProfile || 'Não identificado'}</strong>
                    </div>
                </div>
            </PageShell>

            <PageShell id="p-page-2" title="01. Síntese do Perfil & Parecer Executivo de Liderança" subtitle="1.1 Visão Geral do Perfil / 1.2 Parecer Executivo da Banca">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {[
                        { label: 'Dominante', value: report.dominantProfile, tone: 'amber' },
                        { label: 'Auxiliar', value: report.secondaryProfile, tone: 'red' },
                        { label: 'Terciário', value: report.tertiaryProfile, tone: 'emerald' },
                        { label: 'Adjacente', value: report.lowestProfile, tone: 'slate' }
                    ].map((item) => (
                        <div key={item.label} className={`p-4 rounded-xl border ${item.tone === 'amber' ? 'bg-amber-50 border-amber-200' : item.tone === 'red' ? 'bg-red-50 border-red-200' : item.tone === 'emerald' ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
                            <span className="text-[8px] font-black uppercase tracking-widest block text-slate-500">{item.label}</span>
                            <strong className="mt-1 block text-[#112363] font-black text-xs md:text-sm truncate">{item.value || 'Não identificado'}</strong>
                        </div>
                    ))}
                </div>
                <div className="space-y-4">
                    <h4 className="text-xs font-black text-[#112363] uppercase tracking-wider">1.2 Parecer Executivo da Banca</h4>
                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100/90 relative overflow-hidden space-y-3">
                        {renderSectionBody(report.synthesis.executiveOpinion)}
                    </div>
                </div>
            </PageShell>

            <PageShell id="p-page-3" title="02. Distribuição Métrica de Energia" subtitle="Gráfico de barras ordenado por papel">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
                    <div className="flex flex-col items-center justify-between p-5 bg-slate-50 rounded-2xl border border-slate-100 shadow-3xs w-full min-h-[220px]">
                        <div className="text-center">
                            <h4 className="text-[10px] font-black text-[#112363] uppercase tracking-wider mb-2">Distribuição Métrica de Energia</h4>
                        </div>
                        <div className="w-full space-y-3">
                            <RankingBars ranking={report.energyDistribution.ranking} />
                        </div>
                    </div>

                    <div className="space-y-4 w-full">
                        <div className="flex items-center gap-1.5 text-[11px] font-black text-[#112363] uppercase tracking-wider">
                            <Star className="w-4 h-4 text-amber-500 fill-amber-500" /> 2.5 Conheça os Quatro Sócio Estilos
                        </div>
                        <div className="w-full overflow-hidden rounded-2xl border border-slate-150 bg-white shadow-3xs print:break-inside-avoid">
                            <picture>
                                <source media="(max-width: 767px)" srcSet="/report/papeis-socioestilo-mobile.png" />
                                <img src="/report/papeis-socioestilo-desktop.png" alt="Os quatro papéis psicológicos do Sócio Estilo" className="w-full h-auto object-contain" />
                            </picture>
                        </div>
                    </div>
                </div>
            </PageShell>

            <PageShell id="p-page-4" title="03. Perfil Predominante / 04. Perfil Secundário" subtitle="Conteúdo editorial integral" className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <section className="rounded-2xl border p-4 bg-amber-50/30 border-amber-200">
                        <div className="flex items-center justify-between gap-3 mb-2">
                            <h4 className="text-[11px] font-black uppercase tracking-wider text-[#112363]">03. Perfil Predominante</h4>
                            <span className="text-[10px] font-bold text-slate-500 uppercase">{report.dominantProfile || 'Não identificado'}</span>
                        </div>
                        {renderSectionBody(report.profileSections.predominant)}
                    </section>
                    <section className="rounded-2xl border p-4 bg-red-50/20 border-red-200">
                        <div className="flex items-center justify-between gap-3 mb-2">
                            <h4 className="text-[11px] font-black uppercase tracking-wider text-[#112363]">04. Perfil Secundário</h4>
                            <span className="text-[10px] font-bold text-slate-500 uppercase">{report.secondaryProfile || 'Não identificado'}</span>
                        </div>
                        {renderSectionBody(report.profileSections.secondary)}
                    </section>
                </div>
            </PageShell>

            <PageShell id="p-page-5" title="05. Quando você atua no seu melhor / 06. Quando o excesso pode limitar seus resultados / 07. Estilo a Desenvolver" subtitle="Lado Luz / Lado Sombra / Desenvolvimento">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <section className="rounded-2xl border p-4 bg-emerald-50/20 border-emerald-200">
                        <h4 className="text-[11px] font-black uppercase tracking-wider text-[#112363]">05. Lado Luz</h4>
                        <p className="text-[10px] uppercase tracking-widest text-slate-400 mt-1">Quando você atua no seu melhor</p>
                        <div className="mt-3">{renderSectionBody(report.profileSections.light)}</div>
                    </section>
                    <section className="rounded-2xl border p-4 bg-slate-50 border-slate-200">
                        <h4 className="text-[11px] font-black uppercase tracking-wider text-[#112363]">06. Lado Sombra</h4>
                        <p className="text-[10px] uppercase tracking-widest text-slate-400 mt-1">Quando o excesso pode limitar seus resultados</p>
                        <div className="mt-3">{renderSectionBody(report.profileSections.shadow)}</div>
                    </section>
                    <section className="rounded-2xl border p-4 bg-amber-50/20 border-amber-200">
                        <h4 className="text-[11px] font-black uppercase tracking-wider text-[#112363]">07. Estilo a Desenvolver</h4>
                        <p className="text-[10px] uppercase tracking-widest text-slate-400 mt-1">Competência complementar para ampliar repertório</p>
                        <div className="mt-3">{renderSectionBody(report.profileSections.development)}</div>
                    </section>
                </div>
            </PageShell>

            <PageShell id="p-page-6" title="08. Relações entre Socioestilos" subtitle="Predominante contra os demais estilos">
                <div className="space-y-4">
                    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
                        <div className="flex items-center justify-between gap-3 mb-2">
                            <h4 className="text-[11px] font-black uppercase tracking-wider text-[#112363]">Perfil predominante</h4>
                            <span className="text-[10px] font-bold text-slate-500 uppercase">{report.relations.dominantProfile || report.dominantProfile || 'Não identificado'}</span>
                        </div>
                        <p className="text-xs leading-7 text-slate-700 whitespace-pre-line">{report.relations.fallback.texto || 'As relações editoriais serão exibidas abaixo conforme o snapshot emitido pelo n8n.'}</p>
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                        {report.relations.blocks.length > 0 ? report.relations.blocks.map((block) => {
                            const title = `${report.dominantProfile || 'Perfil predominante'} × ${block.perfil_relacionado || block.titulo.replace(/^Relação\s+/i, '')}`;
                            return (
                                <section key={block.id} className="rounded-2xl border p-4 bg-white shadow-3xs">
                                    <div className="flex items-center justify-between gap-3 mb-3">
                                        <h5 className="text-[11px] font-black uppercase tracking-wider text-[#112363]">{title}</h5>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">{block.perfil_relacionado || 'Relação'}</span>
                                    </div>
                                    {block.texto ? <p className="text-xs leading-7 text-slate-700 whitespace-pre-line">{block.texto}</p> : null}
                                    {block.subitens.length > 0 ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4 text-xs">
                                            {block.subitens.map((item, index) => (
                                                <div key={`${block.id}-sub-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                                    <div className="text-[10px] font-black uppercase tracking-wider text-[#112363]">
                                                        {asString(item.subitem_relatorio || item.campo_relatorio_principal || `08.${String(index + 1).padStart(2, '0')}`)}
                                                    </div>
                                                    {item.conteudo_relatorio ? <p className="mt-2 whitespace-pre-line leading-7 text-slate-700">{item.conteudo_relatorio}</p> : null}
                                                </div>
                                            ))}
                                        </div>
                                    ) : null}
                                </section>
                            );
                        }) : (
                            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
                                {isDev ? 'Conteúdo editorial não disponível.' : null}
                            </div>
                        )}
                    </div>
                </div>
            </PageShell>

            <PageShell id="p-page-7" title="09. Recomendações" subtitle="Potencialização dos Talentos e Plano de Desenvolvimento Individual">
                <div className="space-y-5">
                    <section className="space-y-3">
                        <h4 className="text-xs font-black text-[#112363] uppercase tracking-wider flex items-center gap-1.5 pb-1 border-b border-slate-200">
                            <CheckCircle2 className="w-4.5 h-4.5 text-[#112363] shrink-0" /> 9.1 Potencialização dos Talentos
                        </h4>
                        {renderSectionBody(report.recommendations.potentialization)}
                    </section>
                    <section className="space-y-3">
                        <h4 className="text-xs font-black text-emerald-600 uppercase tracking-wider flex items-center gap-1.5 pb-1 border-b border-emerald-100">
                            <BookOpen className="w-4.5 h-4.5 text-emerald-500 shrink-0" /> 9.2 Plano de Desenvolvimento Individual
                        </h4>
                        {renderSectionBody(report.recommendations.pdi)}
                    </section>
                    <section className="space-y-3">
                        <h4 className="text-xs font-black text-[#112363] uppercase tracking-wider flex items-center gap-1.5 pb-1 border-b border-slate-200">Primeiros Passos</h4>
                        {renderSectionBody(report.recommendations.firstSteps)}
                    </section>
                    <section className="space-y-3">
                        <h4 className="text-xs font-black text-[#112363] uppercase tracking-wider flex items-center gap-1.5 pb-1 border-b border-slate-200">MEMÓRIA DE CÁLCULO E RESPOSTAS DO QUESTIONÁRIO</h4>
                        <div className="space-y-4">
                            <MemoryTable answers={report.memory.answers} />
                            <div className="p-4 bg-slate-50 rounded-xl border border-slate-155 text-[11px] text-slate-600 font-semibold leading-relaxed">
                                <strong className="text-slate-800 uppercase block mb-1">Memória estrita de cálculo</strong>
                                {report.memory.calculation ? <pre className="whitespace-pre-wrap text-[10px] leading-6 text-slate-700">{JSON.stringify(report.memory.calculation, null, 2)}</pre> : 'Conteúdo editorial não disponível.'}
                            </div>
                        </div>
                    </section>
                </div>
            </PageShell>

            <PageShell id="p-page-8" title="TRILHA DE AUDITORIA" subtitle="Unidades utilizadas pelo snapshot">
                <div className="space-y-4">
                    <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-[#112363]">
                        <Bot className="w-4 h-4 text-[#112363]" /> Fonte: resultado.auditoria.unidades_utilizadas
                    </div>
                    <AuditTable units={report.audit.unidades_utilizadas} />
                </div>
            </PageShell>
        </div>
    );
}
