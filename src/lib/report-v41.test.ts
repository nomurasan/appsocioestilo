import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAnalyticalReportViewModel,
  buildSyntheticReportViewModel,
  detectCanonicalContractVersion,
  isReportOutputV41,
  isReportOutputV42,
  isReportOutputV43,
  parseReportOutputV41,
  validateReportOutputV41,
} from "./report-v41";

const commonResultadoCalculado = {
  perfil_dominante: "Participativo",
  perfil_secundario: "Integrador",
  perfil_terciario: "Assertivo",
  perfil_adjacente: "Analítico",
  lado_luz: "Participativo",
  lado_sombra: "Integrador",
  estilo_a_desenvolver: "Analítico",
  total_pontos: 38,
  scores: {
    Assertivo: 9,
    Participativo: 12,
    Integrador: 10,
    Analítico: 7,
  },
  ranking: [
    {
      ordem: 1,
      perfil: "Participativo",
      papel: "Dominante",
      score: 12,
      percentual: 32,
    },
    {
      ordem: 2,
      perfil: "Integrador",
      papel: "Secundário",
      score: 10,
      percentual: 26,
    },
    {
      ordem: 3,
      perfil: "Assertivo",
      papel: "Terciário",
      score: 9,
      percentual: 24,
    },
    {
      ordem: 4,
      perfil: "Analítico",
      papel: "Adjacente",
      score: 7,
      percentual: 18,
    },
  ],
};

const commonGeneralView = {
  versao: "1.0",
  tipo: "visao_geral",
  estrategia: "conteudo_editorial_integral",
  secoes: [
    {
      codigo: "conheca_quatro_socioestilos",
      titulo: "Conheça os Quatro Sócio Estilos",
      ordem: 1,
      subitens: [
        {
          ordem: 2,
          titulo: "Subitem B",
          conteudo: "Texto B",
          subitem_relatorio: "Subitem B",
        },
        {
          ordem: 1,
          titulo: "Subitem A",
          conteudo: "Texto A",
          subitem_relatorio: "Subitem A",
        },
      ],
    },
    {
      codigo: "distribuicao_metrica_energia",
      titulo: "Distribuição Métrica de Energia",
      ordem: 2,
      dados: {
        exibir_grafico_radial: true,
        exibir_grafico_barras: true,
      },
    },
    {
      codigo: "perfil_dominante",
      titulo: "Perfil Dominante",
      ordem: 3,
      perfil: "Participativo",
      status: "generated",
      subitens: [
        {
          ordem: 2,
          titulo: "Características em Ação",
          conteudo: "Conteúdo 3.2",
          subitem_relatorio: "Características em Ação",
        },
        {
          ordem: 1,
          titulo: "Descrição Geral",
          conteudo: "Conteúdo 3.1",
          subitem_relatorio: "Descrição Geral",
        },
      ],
    },
    {
      codigo: "relacoes_entre_socioestilos",
      titulo: "Relações entre Socioestilos",
      ordem: 8,
      relacoes: [
        {
          ordem: 1,
          titulo: "Participativo × Assertivo",
          perfil_principal: "Participativo",
          perfil_relacionado: "Assertivo",
          status: "generated",
          subitens: [
            {
              ordem: 2,
              titulo: "Como se Relaciona",
              conteudo: "Conteúdo 8.1.2",
              subitem_relatorio: "Como se Relaciona",
            },
            {
              ordem: 1,
              titulo: "Sinergia entre os Estilos",
              conteudo: "Conteúdo 8.1.1",
              subitem_relatorio: "Sinergia entre os Estilos",
            },
          ],
        },
      ],
    },
    {
      codigo: "conformidade_rastreabilidade_auditoria",
      titulo: "Conformidade, Rastreabilidade e Auditoria",
      ordem: 10,
      subitens: [
        {
          ordem: 1,
          titulo: "Resumo Sintético de Conformidade",
          conteudo: "Conteúdo sintético 10.1",
          subitem_relatorio: "Resumo Sintético de Conformidade",
        },
      ],
    },
  ],
};

const fixtureV43 = {
  contractVersion: "V43",
  contract_version: "socioestilo-report/v43",
  report_output: {
    contractVersion: "V43",
    contract_version: "socioestilo-report/v43",
    workflow_version: "n8n-v43-visao-geral-canonica-resultado-enxuto",
    report_version: "v43-visao-geral-canonica",
    identificacao: {
      nome: "Pessoa Teste",
      empresa: "Empresa Teste",
      generated_at: "2026-08-08T10:00:00.000Z",
    },
    resultado_calculado: commonResultadoCalculado,
    visao_geral: commonGeneralView,
    memoria_calculo: {
      total_pontos: 38,
      regra_calculo: "soma_linear",
      respostas: [
        {
          question: "Questão 1",
          answer: "A",
          socioStyle: "Participativo",
          points: 2,
        },
      ],
    },
    auditoria: {
      unidades_utilizadas: [
        {
          id_unidade: "BE0006",
          descricao: "Descrição Geral — Participativo",
          conteudo: "Conteúdo integral da unidade",
          campo_relatorio_principal: "perfil_dominante",
          ordem_subitem: 1,
          subitem_relatorio: "Descrição Geral",
          perfil_principal: "Participativo",
          perfil_relacionado: null,
        },
      ],
    },
  },
};

const fixtureV42 = {
  contractVersion: "V42",
  contract_version: "socioestilo-report/v42",
  report_output: {
    contractVersion: "V42",
    contract_version: "socioestilo-report/v42",
    workflow_version: "n8n-v42-visao-geral-canonica",
    report_version: "v42-visao-geral",
    identificacao: {
      nome: "Pessoa Teste",
      empresa: "Empresa Teste",
    },
    resultado_calculado: commonResultadoCalculado,
    visao_geral: commonGeneralView,
    memoria_calculo: {},
    auditoria: {
      unidades_utilizadas: [],
    },
  },
};

const fixtureV41Legacy = {
  contractVersion: "V41",
  contract_version: "socioestilo-report/v41",
  report_output: {
    contractVersion: "V41",
    contract_version: "socioestilo-report/v41",
    workflow_version: "n8n-v41-legado",
    report_version: "v41",
    identificacao: {
      nome: "Pessoa V41",
      empresa: "Empresa V41",
    },
    resultado_calculado: commonResultadoCalculado,
    relatorio_sintetico: {
      versao: "1.0",
      tipo: "sintetico",
      estrategia: "selecao_editorial_deterministica",
      secoes: commonGeneralView.secoes,
    },
    relatorio_detalhado: {
      versao: "1.0",
      tipo: "detalhado",
      estrategia: "conteudo_editorial_integral",
      secoes: commonGeneralView.secoes,
    },
    memoria_calculo: {},
    auditoria: {
      unidades_utilizadas: [],
    },
  },
};

test("TESTE 1: isReportOutputV43(V43) === true", () => {
  assert.equal(isReportOutputV43(fixtureV43.report_output, fixtureV43), true);
});

test("TESTE 2: prioridade de versão usa V43 acima de V42", () => {
  assert.equal(
    detectCanonicalContractVersion(fixtureV43.report_output, fixtureV43),
    "V43",
  );
});

test("TESTE 3: parseReportOutputV41(V43).contractVersion === 'V43'", () => {
  const parsed = parseReportOutputV41(fixtureV43);
  assert.ok(parsed);
  assert.equal(parsed?.contractVersion, "V43");
});

test("TESTE 4: V43 usa visao_geral.secoes", () => {
  const parsed = parseReportOutputV41(fixtureV43);
  assert.ok(parsed);
  assert.equal(
    parsed?.visao_geral.secoes.length,
    commonGeneralView.secoes.length,
  );
});

test("TESTE 5: buildSyntheticReportViewModel(V43) usa visao_geral", () => {
  const vm = buildSyntheticReportViewModel(fixtureV43);
  assert.ok(vm);
  assert.equal(vm?.sections.length, commonGeneralView.secoes.length);
  assert.equal(vm?.sections[0].codigo, "conheca_quatro_socioestilos");
});

test("TESTE 6: buildAnalyticalReportViewModel(V43) usa a mesma visao_geral", () => {
  const synthetic = buildSyntheticReportViewModel(fixtureV43);
  const analytical = buildAnalyticalReportViewModel(fixtureV43);
  assert.ok(synthetic);
  assert.ok(analytical);
  assert.equal(analytical?.sections.length, synthetic?.sections.length);
  assert.deepEqual(analytical?.sections, synthetic?.sections);
});

test("TESTE 7: V43 não requer relatorio_sintetico/relatorio_detalhado", () => {
  const parsed = parseReportOutputV41(fixtureV43);
  assert.ok(parsed);
  assert.equal(
    Object.prototype.hasOwnProperty.call(parsed || {}, "relatorio_sintetico"),
    false,
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(parsed || {}, "relatorio_detalhado"),
    false,
  );
});

test("TESTE 8: ranking mantém Dominante/Secundário/Terciário/Adjacente", () => {
  const parsed = parseReportOutputV41(fixtureV43);
  assert.ok(parsed);
  assert.deepEqual(
    parsed?.resultado_calculado.ranking.map((item) => item.papel),
    ["Dominante", "Secundário", "Terciário", "Adjacente"],
  );
});

test("TESTE 9: perfis calculados são lidos corretamente", () => {
  const parsed = parseReportOutputV41(fixtureV43);
  assert.ok(parsed);
  assert.equal(parsed?.resultado_calculado.perfil_dominante, "Participativo");
  assert.equal(parsed?.resultado_calculado.perfil_secundario, "Integrador");
  assert.equal(parsed?.resultado_calculado.perfil_terciario, "Assertivo");
  assert.equal(parsed?.resultado_calculado.perfil_adjacente, "Analítico");
});

test("TESTE 10: V42 continua funcionando", () => {
  assert.equal(isReportOutputV42(fixtureV42.report_output, fixtureV42), true);
  const parsed = parseReportOutputV41(fixtureV42);
  assert.ok(parsed);
  assert.equal(parsed?.contractVersion, "V42");
});

test("TESTE 11: V41 continua funcionando", () => {
  const validation = validateReportOutputV41(fixtureV41Legacy);
  assert.equal(validation.valid, true);
  const parsed = parseReportOutputV41(fixtureV41Legacy);
  assert.ok(parsed);
  assert.equal(parsed?.contractVersion, "V41");
  assert.equal(
    parsed?.visao_geral.secoes.length,
    commonGeneralView.secoes.length,
  );
});

test("TESTE 12: V30 não é detectado como V43", () => {
  const legacyV30 = {
    contract_version: "socioestilo-report/v30",
    report_output: {
      contractVersion: "V30",
      campos_relatorio: {},
    },
  };

  assert.equal(isReportOutputV43(legacyV30.report_output, legacyV30), false);
  assert.equal(isReportOutputV41(legacyV30.report_output, legacyV30), false);
  assert.equal(parseReportOutputV41(legacyV30), null);
});
