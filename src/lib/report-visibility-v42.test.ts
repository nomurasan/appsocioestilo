import assert from "node:assert/strict";
import test from "node:test";
import {
  applyVisibilityToGeneralView,
  buildCompanyOverrideDiff,
  getSubitemConfigKey,
  resolveReportVisibility,
} from "./report-visibility-v42";

const sampleGeneralView = {
  versao: "1.0",
  secoes: [
    {
      codigo: "perfil_dominante",
      titulo: "Perfil Dominante",
      ordem: 2,
      subitens: [
        {
          ordem: 2,
          subitem_relatorio: "Características em Ação",
          titulo: "Características em Ação",
          conteudo: "B",
        },
        {
          ordem: 1,
          subitem_relatorio: "Descrição Geral",
          titulo: "Descrição Geral",
          conteudo: "A",
        },
      ],
    },
    {
      codigo: "recomendacoes",
      titulo: "Recomendações",
      ordem: 3,
      subitens: [
        {
          ordem: 1,
          subitem_relatorio: "Passos",
          titulo: "Passos",
          conteudo: "P",
        },
      ],
    },
    {
      codigo: "conheca_quatro_socioestilos",
      titulo: "Conheça os Quatro",
      ordem: 1,
      subitens: [],
    },
  ],
};

test("sintético não depende de viewerRole", () => {
  const byParticipant = resolveReportVisibility({
    viewType: "synthetic",
    viewerRole: "participant",
    globalConfig: {},
  });

  const byAdmin = resolveReportVisibility({
    viewType: "synthetic",
    viewerRole: "admin",
    globalConfig: {},
  });

  assert.deepEqual(byParticipant.sections, byAdmin.sections);
  assert.equal(byParticipant.compliance.calculationMemory, false);
  assert.equal(byAdmin.compliance.auditTrail, false);
});

test("analítico participante nunca acessa memória/auditoria", () => {
  const effective = resolveReportVisibility({
    viewType: "analytical",
    viewerRole: "participante",
    globalConfig: {
      compliance: {
        calculationMemory: true,
        auditTrail: true,
        auditUnitContent: true,
      },
    },
    companyOverride: {
      compliance: {
        calculationMemory: true,
        auditTrail: true,
        auditUnitContent: true,
      },
    },
  });

  assert.equal(effective.compliance.calculationMemory, false);
  assert.equal(effective.compliance.auditTrail, false);
  assert.equal(effective.compliance.auditUnitContent, false);
});

test("consultor recebe configuração própria", () => {
  const effective = resolveReportVisibility({
    viewType: "analytical",
    viewerRole: "consultor",
    globalConfig: {
      compliance: {
        calculationMemory: false,
        auditTrail: true,
        auditUnitContent: false,
      },
    },
  });

  assert.equal(effective.viewerRole, "consultant");
  assert.equal(effective.compliance.calculationMemory, false);
  assert.equal(effective.compliance.auditTrail, true);
});

test("admin recebe configuração própria", () => {
  const effective = resolveReportVisibility({
    viewType: "analytical",
    viewerRole: "administrator",
    globalConfig: {
      compliance: {
        calculationMemory: true,
        auditTrail: true,
        auditUnitContent: true,
      },
    },
  });

  assert.equal(effective.viewerRole, "admin");
  assert.equal(effective.compliance.calculationMemory, true);
  assert.equal(effective.compliance.auditTrail, true);
  assert.equal(effective.compliance.auditUnitContent, true);
});

test("override da empresa sobrescreve global", () => {
  const effective = resolveReportVisibility({
    viewType: "analytical",
    viewerRole: "consultant",
    globalConfig: {
      sections: {
        recomendacoes: { enabled: true },
      },
    },
    companyOverride: {
      sections: {
        recomendacoes: { enabled: false },
      },
    },
  });

  assert.equal(effective.sections.recomendacoes.enabled, false);
});

test("ausência de override de empresa volta ao global", () => {
  const effective = resolveReportVisibility({
    viewType: "analytical",
    viewerRole: "consultant",
    globalConfig: {
      sections: {
        recomendacoes: { enabled: true },
      },
    },
    companyOverride: null,
  });

  assert.equal(effective.sections.recomendacoes.enabled, true);
});

test("regra obrigatória vence override ilegal para participante", () => {
  const effective = resolveReportVisibility({
    viewType: "analytical",
    viewerRole: "participant",
    globalConfig: {
      compliance: {
        calculationMemory: false,
      },
    },
    companyOverride: {
      compliance: {
        calculationMemory: true,
      },
    },
  });

  assert.equal(effective.compliance.calculationMemory, false);
});

test("seção desativada não renderiza", () => {
  const effective = resolveReportVisibility({
    viewType: "synthetic",
    globalConfig: {
      sections: {
        recomendacoes: { enabled: false },
      },
    },
  });

  const filtered = applyVisibilityToGeneralView(sampleGeneralView, effective);
  assert.equal(
    filtered.secoes.some((section) => section.codigo === "recomendacoes"),
    false,
  );
});

test("subitem desativado não renderiza", () => {
  const firstSubitemKey = getSubitemConfigKey({
    ordem: 1,
    subitem_relatorio: "Descrição Geral",
  });

  const effective = resolveReportVisibility({
    viewType: "synthetic",
    globalConfig: {
      sections: {
        perfil_dominante: {
          enabled: true,
          subitems: {
            [firstSubitemKey]: false,
          },
        },
      },
    },
  });

  const filtered = applyVisibilityToGeneralView(sampleGeneralView, effective);
  const perfil = filtered.secoes.find(
    (section) => section.codigo === "perfil_dominante",
  );
  assert.ok(perfil);
  assert.equal(
    perfil?.subitens?.some((subitem) => subitem.titulo === "Descrição Geral"),
    false,
  );
});

test("applyVisibilityToGeneralView não muta report_output original", () => {
  const original = JSON.parse(JSON.stringify(sampleGeneralView));
  const snapshot = JSON.stringify(sampleGeneralView);

  const effective = resolveReportVisibility({
    viewType: "synthetic",
    globalConfig: {
      sections: {
        perfil_dominante: { enabled: false },
      },
    },
  });

  const filtered = applyVisibilityToGeneralView(sampleGeneralView, effective);

  assert.notEqual(filtered.secoes.length, sampleGeneralView.secoes.length);
  assert.equal(JSON.stringify(sampleGeneralView), snapshot);
  assert.deepEqual(sampleGeneralView, original);
});

test("buildCompanyOverrideDiff salva apenas diferenças", () => {
  const globalConfig = {
    enabled: true,
    sections: {
      perfil_dominante: {
        enabled: true,
        subitems: {
          descricao_geral: true,
          caracteristicas_em_acao: true,
        },
      },
    },
    compliance: {
      calculationMemory: true,
      auditTrail: true,
      auditUnitContent: true,
    },
  };

  const editedConfig = {
    enabled: true,
    sections: {
      perfil_dominante: {
        enabled: true,
        subitems: {
          descricao_geral: false,
          caracteristicas_em_acao: true,
        },
      },
    },
    compliance: {
      calculationMemory: true,
      auditTrail: false,
      auditUnitContent: true,
    },
  };

  const diff = buildCompanyOverrideDiff(globalConfig, editedConfig);

  assert.equal(
    diff.sections?.perfil_dominante?.subitems?.descricao_geral,
    false,
  );
  assert.equal(
    diff.sections?.perfil_dominante?.subitems?.caracteristicas_em_acao,
    undefined,
  );
  assert.equal(diff.compliance?.auditTrail, false);
  assert.equal(diff.compliance?.calculationMemory, undefined);
});
