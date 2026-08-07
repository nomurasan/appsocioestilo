import assert from "node:assert/strict";
import test from "node:test";
import { buildReportV36ViewModel } from "./report-v36-view-model";

test("monta o view model V36 com ranking ordenado e normaliza Conservador para Integrador", () => {
  const response = {
    contractVersion: "V30",
    resultado_id: "resultado-1",
    relatorio_uuid: "123e4567-e89b-12d3-a456-426614174000",
    report_output: {
      identificacao: {
        nome: "Pessoa",
        empresa: "Empresa",
        generated_at: "2026-08-06T10:00:00.000Z",
      },
      resultado_calculado: {
        scores: { assertivo: 4, participativo: 5, integrador: 6, analitico: 7 },
      },
      campos_relatorio: {
        perfil_predominante: {
          id: "perfil_predominante",
          titulo: "Perfil Predominante",
          status: "generated",
          enabled: true,
          ordem: 1,
          conteudo: { texto: "Dominante" },
          evidencias: [],
          ucs_utilizadas: [],
          fallback: { used: false },
        },
        perfil_secundario: {
          id: "perfil_secundario",
          titulo: "Perfil Secundário",
          status: "generated",
          enabled: true,
          ordem: 2,
          conteudo: { texto: "Secundário" },
          evidencias: [],
          ucs_utilizadas: [],
          fallback: { used: false },
        },
        lado_luz: {
          id: "lado_luz",
          titulo: "Lado Luz",
          status: "generated",
          enabled: true,
          ordem: 3,
          conteudo: { texto: "Luz" },
          evidencias: [],
          ucs_utilizadas: [],
          fallback: { used: false },
        },
        lado_sombra: {
          id: "lado_sombra",
          titulo: "Lado Sombra",
          status: "generated",
          enabled: true,
          ordem: 4,
          conteudo: { texto: "Sombra" },
          evidencias: [],
          ucs_utilizadas: [],
          fallback: { used: false },
        },
        estilo_a_desenvolver: {
          id: "estilo_a_desenvolver",
          titulo: "Estilo a Desenvolver",
          status: "generated",
          enabled: true,
          ordem: 5,
          conteudo: { texto: "Desenvolver" },
          evidencias: [],
          ucs_utilizadas: [],
          fallback: { used: false },
        },
        relacoes_entre_estilos: {
          id: "relacoes_entre_estilos",
          titulo: "Relações entre Estilos",
          status: "generated",
          enabled: true,
          ordem: 6,
          conteudo: {
            texto: "Relacionamento",
            combinacoes_analisadas: ["Assertivo + Analítico"],
            situacoes_praticas: ["Cenário A"],
            cuidados: ["Cuidado A"],
            oportunidades: ["Oportunidade A"],
          },
          evidencias: [],
          ucs_utilizadas: [],
          fallback: { used: false },
        },
        recomendacoes: {
          id: "recomendacoes",
          titulo: "Recomendações",
          status: "generated",
          enabled: true,
          ordem: 7,
          conteudo: {
            texto: "Recomendações",
            lista: ["Passo 1"],
            primeiros_passos: ["Primeiro passo"],
          },
          evidencias: [],
          ucs_utilizadas: [],
          fallback: { used: false },
        },
      },
    },
    assessment: {
      ranking: [
        { style: "Conservador", score: 9 },
        { style: "Assertivo", score: 7 },
        { style: "Participativo", score: 5 },
        { style: "Analítico", score: 3 },
      ],
    },
    report_data: {
      resultado: {},
      narrativa: {},
      dinamica_dos_estilos: {},
      memoria_calculo: { total_pontos: 19 },
      auditoria: { trilha_rag: "RAG-1" },
    },
  };

  const viewModel = buildReportV36ViewModel(response);

  assert.equal(viewModel.identification.name, "Pessoa");
  assert.equal(viewModel.ranking[0].role, "Dominante");
  assert.equal(viewModel.ranking[0].style, "Integrador");
  assert.equal(viewModel.fields.predominant.text, "Dominante");
  assert.equal(
    viewModel.fields.relations.combinations[0],
    "Assertivo + Analítico",
  );
  assert.equal(
    viewModel.fields.recommendations.firstSteps[0],
    "Primeiro passo",
  );
  assert.equal(viewModel.ragAudit, "RAG-1");
});
