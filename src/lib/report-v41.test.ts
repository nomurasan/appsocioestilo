import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAnalyticalReportViewModel,
  buildSyntheticReportViewModel,
  isReportOutputV41,
  parseReportOutputV41,
  validateReportOutputV41,
} from "./report-v41";

const baseV41 = {
  contract_version: "socioestilo-report/v41",
  report_output: {
    contractVersion: "V41",
    contract_version: "socioestilo-report/v41",
    workflow_version: "n8n-v41-sintetico-detalhado-nova-resultados",
    report_version: "v41-sintetico-detalhado",
    identificacao: {
      nome: "Pessoa Teste",
      empresa: "Empresa Teste",
      generated_at: "2026-08-08T10:00:00.000Z",
    },
    resultado_calculado: {
      perfil_dominante: "Participativo",
      perfil_secundario: "Integrador",
      perfil_terciario: "Assertivo",
      perfil_adjacente: "Analítico",
      lado_luz: "Lado luz",
      lado_sombra: "Lado sombra",
      estilo_a_desenvolver: "Analítico",
      total_pontos: 132,
      scores: {
        Assertivo: 29,
        Participativo: 45,
        Integrador: 37,
        Analítico: 21,
      },
      ranking: [
        {
          ordem: 1,
          perfil: "Participativo",
          papel: "Dominante",
          score: 45,
          percentual: 34,
        },
        {
          ordem: 2,
          perfil: "Integrador",
          papel: "Auxiliar",
          score: 37,
          percentual: 28,
        },
        {
          ordem: 3,
          perfil: "Assertivo",
          papel: "Terciário",
          score: 29,
          percentual: 22,
        },
        {
          ordem: 4,
          perfil: "Analítico",
          papel: "Adjacente",
          score: 21,
          percentual: 16,
        },
      ],
    },
    relatorio_sintetico: {
      versao: "1.0",
      tipo: "sintetico",
      estrategia: "selecao_editorial_deterministica",
      secoes: [
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
          codigo: "conheca_quatro_socioestilos",
          titulo: "Conheça os Quatro Sócio Estilos",
          ordem: 1,
          tipo: "visual_metodologico",
          subitens: [
            { ordem: 2, titulo: "Subitem B", conteudo: "Texto B" },
            { ordem: 1, titulo: "Subitem A", conteudo: "Texto A" },
          ],
        },
      ],
    },
    relatorio_detalhado: {
      versao: "1.0",
      tipo: "detalhado",
      estrategia: "conteudo_editorial_integral",
      secoes: [
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
            },
            { ordem: 1, titulo: "Descrição Geral", conteudo: "Conteúdo 3.1" },
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
                },
                {
                  ordem: 1,
                  titulo: "Sinergia entre os Estilos",
                  conteudo: "Conteúdo 8.1.1",
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
            },
          ],
        },
      ],
    },
    memoria_calculo: {
      total_pontos: 132,
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
      total_unidades_utilizadas: 1,
    },
  },
};

test("detecta contrato V41 e valida estrutura principal", () => {
  assert.equal(isReportOutputV41(baseV41.report_output, baseV41), true);
  const validation = validateReportOutputV41(baseV41);
  assert.equal(validation.valid, true);
});

test("parseReportOutputV41 normaliza ranking e converte Auxiliar para Secundário", () => {
  const parsed = parseReportOutputV41(baseV41);
  assert.ok(parsed);
  assert.equal(parsed?.resultado_calculado.ranking.length, 4);
  assert.equal(parsed?.resultado_calculado.ranking[1].papel, "Secundário");
});

test("seleciona variante sintética com seções ordenadas por ordem", () => {
  const vm = buildSyntheticReportViewModel(baseV41);
  assert.ok(vm);
  assert.equal(vm?.variantKey, "sintetico");
  assert.equal(vm?.variantLabel, "Relatório Sintético");
  assert.equal(vm?.sections[0].codigo, "conheca_quatro_socioestilos");
  assert.equal(vm?.sections[1].codigo, "distribuicao_metrica_energia");
  assert.equal(vm?.sections[0].subitens?.[0].titulo, "Subitem A");
});

test("seleciona variante analítica e ordena subitens/relacoes dinamicamente", () => {
  const vm = buildAnalyticalReportViewModel(baseV41);
  assert.ok(vm);
  assert.equal(vm?.variantKey, "detalhado");
  assert.equal(vm?.variantLabel, "Relatório Analítico");

  const perfilDominante = vm?.sections.find(
    (section) => section.codigo === "perfil_dominante",
  );
  assert.equal(perfilDominante?.subitens?.[0].titulo, "Descrição Geral");

  const relacoes = vm?.sections.find(
    (section) => section.codigo === "relacoes_entre_socioestilos",
  );
  assert.equal(
    relacoes?.relacoes?.[0].subitens[0].titulo,
    "Sinergia entre os Estilos",
  );
});

test("não depende de perfil_predominante e perfil_menos_utilizado para V41", () => {
  const parsed = parseReportOutputV41(baseV41);
  assert.equal(parsed?.resultado_calculado.perfil_dominante, "Participativo");
  assert.equal(parsed?.resultado_calculado.perfil_adjacente, "Analítico");
});

test("preserva memória de cálculo e auditoria com conteúdo integral", () => {
  const detailed = buildAnalyticalReportViewModel(baseV41);
  assert.ok(detailed);
  assert.equal(
    (detailed?.memoriaCalculo.respostas as Array<unknown>).length,
    1,
  );
  assert.equal(detailed?.auditoria.unidades_utilizadas[0].id_unidade, "BE0006");
  assert.equal(
    detailed?.auditoria.unidades_utilizadas[0].conteudo,
    "Conteúdo integral da unidade",
  );
});

test("resultado legado não é tratado como V41", () => {
  const legacy = {
    contract_version: "socioestilo-report/v30",
    report_output: {
      contractVersion: "V30",
      campos_relatorio: {},
    },
  };

  assert.equal(isReportOutputV41(legacy.report_output, legacy), false);
  assert.equal(parseReportOutputV41(legacy), null);
  assert.equal(buildSyntheticReportViewModel(legacy), null);
});
