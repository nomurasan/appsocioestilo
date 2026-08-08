import assert from "node:assert/strict";
import test from "node:test";
import { buildReportV38ViewModel, validateReportV38 } from "./report-v38";

const base = {
  report_output: {
    identificacao: {
      nome: "Pessoa",
      empresa: "Empresa",
      generated_at: "2026-08-08T10:00:00.000Z",
    },
    resultado_calculado: {
      scores: {
        assertivo: 45,
        participativo: 37,
        analitico: 29,
        integrador: 21,
      },
      ranking: [
        { perfil: "Assertivo", score: 45, papel: "Dominante" },
        { perfil: "Participativo", score: 37, papel: "Auxiliar" },
        { perfil: "Analítico", score: 29, papel: "Terciário" },
        { perfil: "Integrador", score: 21, papel: "Adjacente" },
      ],
    },
    campos_relatorio: {
      perfil_predominante: { conteudo: { texto: "Predominante" } },
      perfil_secundario: { conteudo: { texto: "Secundário" } },
      lado_luz: { conteudo: { texto: "Luz" } },
      lado_sombra: { conteudo: { texto: "Sombra" } },
      estilo_a_desenvolver: { conteudo: { texto: "Desenvolver" } },
      relacoes_entre_estilos: {
        conteudo: {
          texto: "Relações",
          relacoes: [
            {
              perfil_relacionado: "Participativo",
              titulo: "Assertivo × Participativo",
              sinergia: "Sinergia",
              tensoes: "Tensões",
            },
          ],
        },
      },
      recomendacoes: {
        conteudo: {
          potencializacao_talentos: { texto: "Potencialização" },
          plano_desenvolvimento_individual: { texto: "PDI" },
          primeiros_passos: ["Passo 1"],
        },
      },
    },
    auditoria: {
      unidades_utilizadas: [
        {
          id_unidade: "BER_PP_ASS_001",
          descricao: "Descrição Geral — Perfil Predominante Assertivo",
        },
      ],
    },
  },
  report_data: {
    resultado: {
      perfil_dominante: "Assertivo",
      perfil_secundario: "Participativo",
      perfil_terciario: "Analítico",
      perfil_menos_utilizado: "Integrador",
      scores: {
        Assertivo: 45,
        Participativo: 37,
        Analitico: 29,
        Integrador: 21,
      },
      ranking: [
        { perfil: "Assertivo", score: 45, papel: "Dominante" },
        { perfil: "Participativo", score: 37, papel: "Auxiliar" },
        { perfil: "Analítico", score: 29, papel: "Terciário" },
        { perfil: "Integrador", score: 21, papel: "Adjacente" },
      ],
    },
    narrativa: {
      parecer_executivo: "Parecer",
    },
    dinamica_dos_estilos: {
      lado_luz: "Luz",
      lado_sombra: "Sombra",
      estilo_a_desenvolver: "Desenvolver",
    },
    memoria_calculo: {
      total_pontos: 132,
    },
    memoria_respostas: [
      { question: "Q1", answer: "A1", socioStyle: "Assertivo", points: 2 },
    ],
  },
};

test("valida snapshot V38 e ordena ranking por papel", () => {
  const result = buildReportV38ViewModel(base);
  assert.equal(result.valid, true);
  assert.equal(result.identification.name, "Pessoa");
  assert.deepEqual(
    result.ranking.map((item) => item.papel),
    ["Dominante", "Auxiliar", "Terciário", "Adjacente"],
  );
  assert.equal(result.profileSections.predominant.texto, "Predominante");
  assert.equal(
    result.audit.unidades_utilizadas[0].id_unidade,
    "BER_PP_ASS_001",
  );
  assert.equal(result.memory.answers.length, 1);
});

test("expõe erros estruturais quando report_output falta", () => {
  const validation = validateReportV38({ report_data: {} });
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.length > 0);
});
