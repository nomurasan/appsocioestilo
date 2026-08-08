export type SocioEstilo =
  | "Assertivo"
  | "Participativo"
  | "Integrador"
  | "Analitico"
  | "Analítico";

export interface ConteudoEditorial {
  id_unidade?: string;
  ordem_relatorio?: number;
  ordem_subitem?: number;
  campo_relatorio_principal?: string;
  subitem_relatorio?: string;
  perfil_principal?: SocioEstilo | string;
  perfil_relacionado?: SocioEstilo | string | null;
  conteudo_relatorio?: string;
}

export interface UnidadeAuditoria {
  id_unidade: string;
  descricao: string;
}

export interface AuditoriaV38 {
  unidades_utilizadas: UnidadeAuditoria[];
}

export interface ReportV38RankingItem {
  perfil: string;
  score: number;
  papel: "Dominante" | "Auxiliar" | "Terciário" | "Adjacente";
}

export interface ReportV38Section {
  id: string;
  titulo: string;
  texto: string;
  paragrafo?: string[];
  itens: string[];
  subitens: ConteudoEditorial[];
  ordem?: number;
  raw: unknown;
}

export interface ReportV38RelationBlock extends ReportV38Section {
  perfil_relacionado?: string;
}

export interface ReportV38ViewModel {
  valid: boolean;
  warnings: string[];
  errors: string[];
  identification: {
    name: string;
    company: string;
    generatedAt: string;
    completedAt: string;
    reportUuid: string;
  };
  ranking: ReportV38RankingItem[];
  scores: Record<string, number>;
  dominantProfile: string;
  secondaryProfile: string;
  tertiaryProfile: string;
  lowestProfile: string;
  synthesis: {
    overview: ReportV38Section;
    executiveOpinion: ReportV38Section;
  };
  energyDistribution: {
    ranking: ReportV38RankingItem[];
  };
  profileSections: {
    predominant: ReportV38Section;
    secondary: ReportV38Section;
    light: ReportV38Section;
    shadow: ReportV38Section;
    development: ReportV38Section;
  };
  relations: {
    dominantProfile: string;
    blocks: ReportV38RelationBlock[];
    fallback: ReportV38Section;
  };
  recommendations: {
    potentialization: ReportV38Section;
    pdi: ReportV38Section;
    firstSteps: ReportV38Section;
  };
  memory: {
    answers: unknown[];
    calculation: unknown;
  };
  audit: AuditoriaV38;
  reportOutput: Record<string, unknown>;
  reportData: Record<string, unknown>;
  source: Record<string, unknown>;
}

type ObjectRecord = Record<string, unknown>;

const PAPER_ORDER: ReportV38RankingItem["papel"][] = [
  "Dominante",
  "Auxiliar",
  "Terciário",
  "Adjacente",
];

const STYLE_TO_PAPER: Record<string, ReportV38RankingItem["papel"]> = {
  assertivo: "Dominante",
  direto: "Dominante",
  participativo: "Auxiliar",
  expressivo: "Auxiliar",
  integrador: "Terciário",
  conservador: "Terciário",
  amavel: "Terciário",
  amável: "Terciário",
  analitico: "Adjacente",
  analítico: "Adjacente",
};

function isRecord(value: unknown): value is ObjectRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function asRecord(value: unknown): ObjectRecord {
  return isRecord(value) ? value : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function toText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) {
    return value
      .map((item) => toText(item))
      .filter(Boolean)
      .join("\n");
  }
  if (!isRecord(value)) return "";
  const keys = [
    "conteudo_relatorio",
    "texto",
    "text",
    "resumo",
    "summary",
    "descricao",
    "descricao_curta",
    "titulo",
    "title",
  ];
  for (const key of keys) {
    const text = toText(value[key]);
    if (text) return text;
  }
  return "";
}

function splitParagraphs(value: string): string[] {
  return value
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function toNumber(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeStyleName(value: unknown): string {
  const text = toText(value);
  if (!text) return "";
  const normalized = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

  if (normalized.includes("assert") || normalized.includes("diret"))
    return "Assertivo";
  if (normalized.includes("particip") || normalized.includes("express"))
    return "Participativo";
  if (
    normalized.includes("conserv") ||
    normalized.includes("amav") ||
    normalized.includes("integ")
  )
    return "Integrador";
  if (normalized.includes("analit")) return "Analítico";
  return text;
}

function normalizeProfileLabel(value: unknown): string {
  const text = normalizeStyleName(value);
  return text || "";
}

function getReportOutput(root: ObjectRecord): ObjectRecord {
  const reportData = asRecord(root.report_data);
  const reportOutput = asRecord(root.report_output);
  const nestedReportOutput = asRecord(reportData.report_output);
  if (Object.keys(reportOutput).length > 0) return reportOutput;
  if (Object.keys(nestedReportOutput).length > 0) return nestedReportOutput;
  return asRecord(root.relatorio_pronto_para_app);
}

function getReportData(
  root: ObjectRecord,
  reportOutput: ObjectRecord,
): ObjectRecord {
  const reportData = asRecord(root.report_data);
  if (Object.keys(reportData).length > 0) return reportData;
  if (Object.keys(asRecord(reportOutput.report_data)).length > 0) {
    return asRecord(reportOutput.report_data);
  }
  if (Object.keys(asRecord(root.relatorio)).length > 0)
    return asRecord(root.relatorio);
  return {};
}

function getRecordValue(source: ObjectRecord, keys: string[]): unknown {
  for (const key of keys) {
    if (key in source) return source[key];
  }
  return undefined;
}

function unwrapCollection(value: unknown): ObjectRecord[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord);
}

function normalizeEditorialItems(value: unknown): ConteudoEditorial[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((item, index) => {
        const record = asRecord(item);
        return {
          id_unidade:
            toText(record.id_unidade || record.id || record.codigo) ||
            undefined,
          ordem_relatorio:
            toNumber(record.ordem_relatorio || record.ordem || index + 1) ||
            index + 1,
          ordem_subitem:
            toNumber(record.ordem_subitem || record.subordem || index + 1) ||
            index + 1,
          campo_relatorio_principal:
            toText(
              record.campo_relatorio_principal || record.campo || record.titulo,
            ) || undefined,
          subitem_relatorio:
            toText(
              record.subitem_relatorio || record.subitem || record.titulo,
            ) || undefined,
          perfil_principal: record.perfil_principal
            ? String(record.perfil_principal)
            : undefined,
          perfil_relacionado:
            record.perfil_relacionado !== undefined
              ? record.perfil_relacionado === null
                ? null
                : String(record.perfil_relacionado)
              : undefined,
          conteudo_relatorio:
            toText(
              record.conteudo_relatorio ||
                record.conteudo ||
                record.texto ||
                record.text,
            ) || undefined,
        };
      })
      .filter((item) =>
        Boolean(
          item.id_unidade || item.conteudo_relatorio || item.subitem_relatorio,
        ),
      );
  }

  if (!isRecord(value)) return [];
  const nested = getRecordValue(value, [
    "subitens",
    "itens",
    "items",
    "lista",
    "conteudos",
    "blocos",
  ]);
  const nestedItems = normalizeEditorialItems(nested);
  if (nestedItems.length > 0) return nestedItems;

  const keys = [
    "sinergia",
    "como_o_perfil_predominante_se_relaciona",
    "como_o_outro_perfil_se_relaciona_com_o_perfil_predominante",
    "tensoes",
    "comunicacao_eficaz",
    "valorizar",
    "evitar",
    "exemplos",
    "situacoes_praticas",
    "contextos_ideais",
    "estrategias_potencializacao",
    "ponto_equilibrio",
    "objetivos_prioritarios",
    "plano_acao",
    "indicadores_evolucao",
    "primeiros_passos",
  ];

  return keys
    .map((key, index) => {
      const text = toText(value[key]);
      if (!text) return null;
      return {
        ordem_relatorio: index + 1,
        ordem_subitem: index + 1,
        subitem_relatorio: key.replaceAll("_", " "),
        conteudo_relatorio: text,
      } as ConteudoEditorial;
    })
    .filter((item): item is ConteudoEditorial => Boolean(item));
}

function normalizeSection(
  id: string,
  titulo: string,
  value: unknown,
  fallbackTitle?: string,
): ReportV38Section {
  const source = asRecord(value);
  const rawText = toText(
    getRecordValue(source, [
      "conteudo_relatorio",
      "conteudo",
      "texto",
      "text",
      "resumo",
      "descricao",
    ]) ?? value,
  );
  const items = asArray(
    getRecordValue(source, ["lista", "items", "itens", "subitens"]),
  );
  const editorialItems = normalizeEditorialItems(
    items.length > 0 ? items : source,
  );
  const textFromItems = editorialItems
    .map((item) => item.conteudo_relatorio || item.subitem_relatorio || "")
    .filter(Boolean)
    .join("\n");
  const text = rawText || textFromItems || toText(source);
  return {
    id,
    titulo:
      toText(getRecordValue(source, ["titulo", "title"])) ||
      fallbackTitle ||
      titulo,
    texto: text,
    paragrafo: text ? splitParagraphs(text) : [],
    itens: editorialItems
      .map(
        (item) =>
          item.conteudo_relatorio ||
          item.subitem_relatorio ||
          item.campo_relatorio_principal ||
          "",
      )
      .filter(Boolean),
    subitens: editorialItems,
    ordem:
      toNumber(getRecordValue(source, ["ordem", "ordem_relatorio", "order"])) ||
      undefined,
    raw: value,
  };
}

function normalizeAudit(
  root: ObjectRecord,
  reportData: ObjectRecord,
  reportOutput: ObjectRecord,
): AuditoriaV38 {
  const fromOutput = asRecord(reportOutput.auditoria);
  const fromData = asRecord(reportData.auditoria);
  const source = Object.keys(fromOutput).length > 0 ? fromOutput : fromData;
  const unitsRaw = asArray(source.unidades_utilizadas);
  if (unitsRaw.length > 0) {
    return {
      unidades_utilizadas: unitsRaw
        .map((item, index) => {
          const record = asRecord(item);
          const id =
            toText(
              record.id_unidade || record.id || record.codigo || record.ku_code,
            ) || `unidade-${index + 1}`;
          const descricao = toText(
            record.descricao ||
              record.texto ||
              record.conteudo ||
              record.nome ||
              record.titulo,
          );
          return {
            id_unidade: id,
            descricao: descricao || id,
          };
        })
        .filter((item) => Boolean(item.id_unidade)),
    };
  }

  const legacyUnits = asArray(source.fontes_consultadas).map((item, index) => ({
    id_unidade: `legacy-audit-${index + 1}`,
    descricao: toText(item) || `Fonte consultada ${index + 1}`,
  }));

  return {
    unidades_utilizadas: legacyUnits,
  };
}

function normalizeScores(value: unknown): Record<string, number> {
  const source = asRecord(value);
  return {
    Assertivo: toNumber(
      source.Assertivo ?? source.assertivo ?? source.Direto ?? source.direto,
    ),
    Participativo: toNumber(
      source.Participativo ??
        source.participativo ??
        source.Expressivo ??
        source.expressivo,
    ),
    Integrador: toNumber(
      source.Integrador ??
        source.integrador ??
        source.Amavel ??
        source.amavel ??
        source["Conservador agregador"] ??
        source.conservador_agregador,
    ),
    Analitico: toNumber(
      source.Analitico ??
        source.analitico ??
        source.Analítico ??
        source["Analítico"],
    ),
  };
}

function buildRankingFromScores(
  scores: Record<string, number>,
): ReportV38RankingItem[] {
  const ordered = [
    { perfil: "Assertivo", score: scores.Assertivo || 0 },
    { perfil: "Participativo", score: scores.Participativo || 0 },
    { perfil: "Integrador", score: scores.Integrador || 0 },
    { perfil: "Analítico", score: scores.Analitico || 0 },
  ].sort((a, b) => b.score - a.score);

  return ordered.map((item, index) => ({
    perfil: item.perfil,
    score: item.score,
    papel: PAPER_ORDER[index] || "Adjacente",
  }));
}

function normalizeRanking(
  root: ObjectRecord,
  scores: Record<string, number>,
  reportOutput: ObjectRecord,
  reportData: ObjectRecord,
): ReportV38RankingItem[] {
  const rootAny = root as Record<string, any>;
  const outputAny = reportOutput as Record<string, any>;
  const dataAny = reportData as Record<string, any>;
  const candidates = [
    rootAny.ranking,
    outputAny.ranking,
    outputAny.resultado_ranking,
    asRecord(outputAny.resultado_calculado).ranking,
    dataAny.ranking,
    asRecord(dataAny.resultado).ranking,
    asRecord(rootAny.assessment).ranking,
  ];

  for (const candidate of candidates) {
    if (!Array.isArray(candidate) || candidate.length === 0) continue;
    const items = candidate
      .map((item, index) => {
        const record = asRecord(item);
        const perfil = normalizeProfileLabel(
          record.perfil ??
            record.style ??
            record.estilo ??
            record.nome ??
            record.title,
        );
        const score = toNumber(
          record.score ?? record.points ?? record.pontuacao ?? record.valor,
        );
        const papel = PAPER_ORDER[index] || "Adjacente";
        return {
          perfil,
          score,
          papel,
        } satisfies ReportV38RankingItem;
      })
      .filter((item) => Boolean(item.perfil));

    if (items.length > 0) {
      const hasPapels = items.some((item) => Boolean(item.papel));
      if (hasPapels) {
        return items.sort(
          (a, b) => PAPER_ORDER.indexOf(a.papel) - PAPER_ORDER.indexOf(b.papel),
        );
      }
    }
  }

  return buildRankingFromScores(scores);
}

function normalizeProfileSections(
  reportOutput: ObjectRecord,
  reportData: ObjectRecord,
): ReportV38ViewModel["profileSections"] {
  const outputAny = reportOutput as Record<string, any>;
  const dataAny = reportData as Record<string, any>;
  const source = asRecord(outputAny.campos_relatorio);
  const dataRoot = asRecord(dataAny.resultado);
  const dinamica = asRecord(dataAny.dinamica_dos_estilos);
  const lookup = (fieldId: string): unknown => {
    if (isRecord(source[fieldId])) return source[fieldId];
    if (fieldId in source) return source[fieldId];
    if (isRecord(outputAny[fieldId])) return outputAny[fieldId];
    if (isRecord(dataAny[fieldId])) return dataAny[fieldId];
    if (
      fieldId === "perfil_predominante" &&
      isRecord(dataRoot.perfil_dominante)
    )
      return dataRoot.perfil_dominante;
    if (fieldId === "perfil_secundario" && isRecord(dataRoot.perfil_secundario))
      return dataRoot.perfil_secundario;
    if (fieldId === "lado_luz" && isRecord(dinamica.lado_luz))
      return dinamica.lado_luz;
    if (fieldId === "lado_sombra" && isRecord(dinamica.lado_sombra))
      return dinamica.lado_sombra;
    if (
      fieldId === "estilo_a_desenvolver" &&
      isRecord(dinamica.estilo_a_desenvolver)
    )
      return dinamica.estilo_a_desenvolver;
    return undefined;
  };

  return {
    predominant: normalizeSection(
      "perfil_predominante",
      "03. Perfil Predominante",
      lookup("perfil_predominante"),
    ),
    secondary: normalizeSection(
      "perfil_secundario",
      "04. Perfil Secundário",
      lookup("perfil_secundario"),
    ),
    light: normalizeSection(
      "lado_luz",
      "05. Quando você atua no seu melhor",
      lookup("lado_luz"),
      "Lado Luz",
    ),
    shadow: normalizeSection(
      "lado_sombra",
      "06. Quando o excesso pode limitar seus resultados",
      lookup("lado_sombra"),
      "Lado Sombra",
    ),
    development: normalizeSection(
      "estilo_a_desenvolver",
      "07. Estilo a Desenvolver",
      lookup("estilo_a_desenvolver"),
    ),
  };
}

function normalizeRelations(
  reportOutput: ObjectRecord,
  reportData: ObjectRecord,
  dominantProfile: string,
): ReportV38ViewModel["relations"] {
  const outputAny = reportOutput as Record<string, any>;
  const dataAny = reportData as Record<string, any>;
  const relationSource = asRecord(
    outputAny.campos_relatorio?.relacoes_entre_estilos ??
      outputAny.relacoes_entre_estilos ??
      dataAny.relacoes_entre_estilos ??
      dataAny.dinamica_dos_estilos ??
      {},
  );

  const relationItems = [
    ...unwrapCollection(relationSource.relacoes),
    ...unwrapCollection(relationSource.pares),
    ...unwrapCollection(relationSource.combinacoes_analisadas),
    ...unwrapCollection(relationSource.items),
  ];

  const blocks = relationItems.map((item, index) => {
    const perfilRelacionado = normalizeProfileLabel(
      item.perfil_relacionado ??
        item.outro_perfil ??
        item.perfil ??
        item.par ??
        item.estilo_relacionado,
    );
    const titulo =
      toText(
        item.titulo ||
          item.subitem_relatorio ||
          item.campo_relatorio_principal ||
          `Relação ${index + 1}`,
      ) || `Relação ${index + 1}`;
    const subitens = normalizeEditorialItems(
      item.subitens || item.items || item.itens || item.conteudo || item,
    );
    const texto = toText(
      item.conteudo_relatorio ||
        item.texto ||
        item.resumo ||
        item.descricao ||
        item,
    );
    return {
      id: `relacao-${index + 1}`,
      titulo,
      texto,
      paragrafo: texto ? splitParagraphs(texto) : [],
      itens: subitens
        .map(
          (subitem) =>
            subitem.conteudo_relatorio || subitem.subitem_relatorio || "",
        )
        .filter(Boolean),
      subitens,
      ordem:
        toNumber(item.ordem_relatorio || item.ordem || index + 1) || index + 1,
      raw: item,
      perfil_relacionado: perfilRelacionado || undefined,
    };
  });

  const fallback = normalizeSection(
    "relacoes_entre_estilos",
    "08. Relações entre Socioestilos",
    relationSource,
  );

  return {
    dominantProfile,
    blocks,
    fallback,
  };
}

function normalizeRecommendations(
  reportOutput: ObjectRecord,
  reportData: ObjectRecord,
): ReportV38ViewModel["recommendations"] {
  const outputAny = reportOutput as Record<string, any>;
  const dataAny = reportData as Record<string, any>;
  const source = asRecord(
    outputAny.campos_relatorio?.recomendacoes ??
      outputAny.recomendacoes ??
      dataAny.recomendacoes ??
      {},
  );

  const potentializationSource = asRecord(
    source.potencializacao_talentos ??
      source.potencializar_talentos ??
      dataAny.potencializacao_talentos ??
      dataAny.potencializar_talentos ??
      {},
  );
  const pdiSource = asRecord(
    source.plano_desenvolvimento_individual ?? source.pdi ?? dataAny.pdi ?? {},
  );
  const firstStepsSource = asRecord(
    source.primeiros_passos ?? pdiSource.primeiros_passos ?? {},
  );

  return {
    potentialization: normalizeSection(
      "potencializacao_talentos",
      "09.1 Potencialização dos Talentos",
      potentializationSource,
    ),
    pdi: normalizeSection(
      "pdi",
      "09.2 Plano de Desenvolvimento Individual",
      pdiSource,
    ),
    firstSteps: normalizeSection(
      "primeiros_passos",
      "Primeiros Passos",
      firstStepsSource,
    ),
  };
}

function normalizeMemory(
  reportData: ObjectRecord,
  reportOutput: ObjectRecord,
): ReportV38ViewModel["memory"] {
  const dataAny = reportData as Record<string, any>;
  const outputAny = reportOutput as Record<string, any>;
  const memory = asRecord(
    dataAny.memoria_calculo || outputAny.memoria_calculo || {},
  );
  const answers = asArray(
    dataAny.memoria_respostas || outputAny.memoria_respostas || [],
  );
  return {
    answers,
    calculation: memory,
  };
}

function normalizeIdentification(
  root: ObjectRecord,
  reportData: ObjectRecord,
  reportOutput: ObjectRecord,
): ReportV38ViewModel["identification"] {
  const rootAny = root as Record<string, any>;
  const dataAny = reportData as Record<string, any>;
  const outputAny = reportOutput as Record<string, any>;
  const ident = asRecord(
    outputAny.identificacao || dataAny.identificacao || rootAny.metadata || {},
  );
  const completedAt = toText(
    ident.data_conclusao ||
      ident.completed_at ||
      rootAny.completedAt ||
      rootAny.data_conclusao ||
      rootAny.generated_at ||
      rootAny.created_at,
  );
  const generatedAt = toText(
    ident.generated_at ||
      ident.generatedAt ||
      rootAny.generated_at ||
      rootAny.created_at ||
      completedAt,
  );
  const reportUuid = toText(
    ident.relatorio_uuid ||
      ident.relatorioUuid ||
      rootAny.relatorio_uuid ||
      rootAny.relatorioUuid ||
      rootAny.id,
  );
  return {
    name: toText(
      ident.nome ||
        ident.userName ||
        ident.name ||
        rootAny.nome_usuario ||
        rootAny.user_name,
    ),
    company: toText(
      ident.empresa ||
        ident.companyName ||
        ident.company ||
        rootAny.empresa_nome ||
        rootAny.company_name,
    ),
    generatedAt,
    completedAt,
    reportUuid,
  };
}

function validateStructure(
  root: ObjectRecord,
  reportOutput: ObjectRecord,
  reportData: ObjectRecord,
): { valid: boolean; warnings: string[]; errors: string[] } {
  const warnings: string[] = [];
  const errors: string[] = [];
  const rootAny = root as Record<string, any>;
  const outputAny = reportOutput as Record<string, any>;
  const dataAny = reportData as Record<string, any>;

  if (Object.keys(reportOutput).length === 0) {
    errors.push("report_output ausente.");
  }

  const resultado = asRecord(
    dataAny.resultado ||
      outputAny.resultado_calculado ||
      rootAny.assessment ||
      {},
  );
  const scores = normalizeScores(
    resultado.scores ||
      asRecord(outputAny.resultado_calculado).scores ||
      rootAny.scores ||
      {},
  );
  const ranking = normalizeRanking(root, scores, reportOutput, reportData);

  if (Object.values(scores).every((value) => value === 0)) {
    warnings.push("scores não informados ou zerados.");
  }
  if (ranking.length === 0) {
    errors.push("ranking não pôde ser normalizado.");
  }
  if (
    !resultado.perfil_dominante &&
    !asRecord(outputAny.identificacao).perfil_dominante
  ) {
    warnings.push("perfil_predominante ausente.");
  }
  if (!resultado.perfil_secundario) {
    warnings.push("perfil_secundario ausente.");
  }
  if (!asRecord(dataAny.dinamica_dos_estilos).lado_luz) {
    warnings.push("lado_luz ausente.");
  }
  if (!asRecord(dataAny.dinamica_dos_estilos).lado_sombra) {
    warnings.push("lado_sombra ausente.");
  }
  if (!asRecord(dataAny.dinamica_dos_estilos).estilo_a_desenvolver) {
    warnings.push("estilo_a_desenvolver ausente.");
  }

  return {
    valid: errors.length === 0,
    warnings,
    errors,
  };
}

export function validateReportV38(resultado: unknown): {
  valid: boolean;
  warnings: string[];
  errors: string[];
} {
  const root = asRecord(resultado);
  const reportOutput = getReportOutput(root);
  const reportData = getReportData(root, reportOutput);
  return validateStructure(root, reportOutput, reportData);
}

export function buildReportV38ViewModel(
  resultado: unknown,
): ReportV38ViewModel {
  const root = asRecord(resultado);
  const reportOutput = getReportOutput(root);
  const reportData = getReportData(root, reportOutput);
  const validation = validateStructure(root, reportOutput, reportData);
  const rootAny = root as Record<string, any>;
  const outputAny = reportOutput as Record<string, any>;
  const dataAny = reportData as Record<string, any>;
  const result = asRecord(
    dataAny.resultado ||
      outputAny.resultado_calculado ||
      rootAny.assessment ||
      rootAny.resultado ||
      {},
  );
  const scores = normalizeScores(
    result.scores ||
      asRecord(outputAny.resultado_calculado).scores ||
      rootAny.scores ||
      {},
  );
  const ranking = normalizeRanking(root, scores, reportOutput, reportData);
  const identification = normalizeIdentification(
    root,
    reportData,
    reportOutput,
  );
  const dominantProfile = normalizeProfileLabel(
    result.perfil_dominante ||
      ranking[0]?.perfil ||
      asRecord(outputAny.identificacao).perfil_dominante,
  );
  const secondaryProfile = normalizeProfileLabel(
    result.perfil_secundario || ranking[1]?.perfil,
  );
  const tertiaryProfile = normalizeProfileLabel(
    result.perfil_terciario || ranking[2]?.perfil,
  );
  const lowestProfile = normalizeProfileLabel(
    result.perfil_menos_utilizado || ranking[3]?.perfil,
  );

  return {
    valid: validation.valid,
    warnings: validation.warnings,
    errors: validation.errors,
    identification,
    ranking,
    scores,
    dominantProfile,
    secondaryProfile,
    tertiaryProfile,
    lowestProfile,
    synthesis: {
      overview: normalizeSection(
        "sintese_visao_geral",
        "1.1 Visão Geral do Perfil",
        asRecord(outputAny.campos_relatorio).visao_geral ??
          asRecord(outputAny.campos_relatorio).perfil_predominante ??
          asRecord(dataAny.narrativa).visao_geral ??
          asRecord(dataAny.resultado).visao_geral ??
          "",
      ),
      executiveOpinion: normalizeSection(
        "sintese_parecer_executivo",
        "1.2 Parecer Executivo da Banca",
        asRecord(outputAny.campos_relatorio).parecer_executivo ??
          asRecord(asRecord(outputAny.campos_relatorio).sintese)
            .parecer_executivo ??
          asRecord(dataAny.narrativa).parecer_executivo ??
          dataAny.parecer_executivo ??
          "",
      ),
    },
    energyDistribution: {
      ranking,
    },
    profileSections: normalizeProfileSections(reportOutput, reportData),
    relations: normalizeRelations(reportOutput, reportData, dominantProfile),
    recommendations: normalizeRecommendations(reportOutput, reportData),
    memory: normalizeMemory(reportData, reportOutput),
    audit: normalizeAudit(root, reportData, reportOutput),
    reportOutput,
    reportData,
    source: root,
  };
}

export function validateReportV38Content(resultado: unknown): {
  valid: boolean;
  warnings: string[];
  errors: string[];
} {
  return validateReportV38(resultado);
}
