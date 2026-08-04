import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isCompleteV30Report,
  normalizeV30Report,
  resolveV30Report,
  resolveV30ReportStatus,
  v30ToResultado
} from './report-v30';

const uuid = '123e4567-e89b-12d3-a456-426614174000';
const ids = ['perfil_predominante', 'perfil_secundario', 'lado_luz', 'lado_sombra', 'estilo_a_desenvolver', 'relacoes_entre_estilos', 'recomendacoes'] as const;

function payload(overrides: Record<string, unknown> = {}) {
  const campos_relatorio = Object.fromEntries(ids.map((id, index) => [id, {
    id,
    titulo: id.replaceAll('_', ' '),
    status: 'generated',
    enabled: true,
    ordem: index + 1,
    conteudo: { texto: `Conteúdo de ${id}` },
    evidencias: [{ id: 'ev-1', trecho: 'resposta utilizada', similaridade: 0.9 }],
    ucs_utilizadas: [{ id: 'uc-1', codigo: 'UC-01', versao: 2 }],
    fallback: { used: false }
  }]));
  return {
    contractVersion: 'V30',
    resultado_id: 'resultado-1',
    relatorio_uuid: uuid,
    report_output: {
      identificacao: { nome: 'Pessoa' },
      resultado_calculado: { scores: { assertivo: 2, participativo: 3, integrador: 4, analitico: 5 } },
      campos_relatorio,
      ...overrides
    },
    audit: { prompt: 'privado' }
  };
}

test('aceita V30 completo com os sete elementos e separa DTO público da auditoria', () => {
  const result = normalizeV30Report(payload());
  assert.equal(result.valid, true);
  assert.equal(result.report && isCompleteV30Report(result.report), true);
  assert.equal(result.report?.publicReport.elements[0].title, 'perfil predominante');
  assert.equal('evidence' in (result.report?.publicReport.elements[0] ?? {}), false);
  assert.equal(result.report?.privateAudit.rawAudit?.prompt, 'privado');
  assert.equal(result.report?.privateAudit.elements[0].evidence[0].id, 'ev-1');
});

test('aceita insufficient_evidence e error sem conteúdo, mantendo status parcial/falha', () => {
  const base = payload();
  const fields = base.report_output.campos_relatorio as Record<string, Record<string, unknown>>;
  fields.lado_luz = { ...fields.lado_luz, status: 'insufficient_evidence', conteudo: null };
  fields.lado_sombra = { ...fields.lado_sombra, status: 'error' };
  const result = normalizeV30Report(base);
  assert.equal(result.valid, true);
  assert.equal(result.report?.reportStatus, 'partial');
  assert.equal(resolveV30ReportStatus(result), 'partial');
});

test('recusa ausências, ids divergentes, títulos/status/habilitação/ordem inválidos e generated vazio', () => {
  const base = payload();
  const fields = base.report_output.campos_relatorio as Record<string, Record<string, unknown>>;
  delete fields.lado_luz;
  fields.lado_sombra = { ...fields.lado_sombra, id: 'outro' };
  fields.recomendacoes = { ...fields.recomendacoes, titulo: '', status: 'unknown', enabled: 'sim', ordem: 1.5, conteudo: null };
  const result = normalizeV30Report(base);
  assert.equal(result.valid, false);
  assert.ok(result.errors.length >= 6);
});

test('recusa resultado/UUID inválidos, score inválido e não converte score para zero', () => {
  const base = payload();
  base.resultado_id = '';
  base.relatorio_uuid = 'not-a-uuid';
  (base.report_output.resultado_calculado as Record<string, unknown>).scores = { assertivo: 'bad', participativo: 3, integrador: 4, analitico: 5 };
  const result = normalizeV30Report(base);
  assert.equal(result.valid, false);
  assert.equal(result.report, undefined);
  assert.equal(v30ToResultado({} as never, { uid: 'u', nome: 'n', empresa_id: 'e', empresa_nome: 'en' }), null);
});

test('detecta elemento duplicado quando o contrato usa coleção de elementos', () => {
  const base = payload();
  const fields = base.report_output.campos_relatorio as Record<string, unknown>;
  base.report_output.campos_relatorio = [...Object.values(fields), fields.perfil_predominante] as unknown as typeof base.report_output.campos_relatorio;
  const result = normalizeV30Report(base);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(error => error.code === 'duplicate_element'));
});

test('seleciona V30 inválido sem cair no legado e mantém histórico sem sinal V30 fora do adaptador', () => {
  const invalidV30 = resolveV30Report({ report_output: {} });
  assert.equal(invalidV30.declared, true);
  assert.equal(invalidV30.validation.valid, false);
  const legacy = resolveV30Report({ relatorio: { narrativa: { resumo: 'histórico' } } });
  assert.equal(legacy.declared, false);
});

test('aceita scores superiores a 9 sem recalcular', () => {
  const base = payload();
  (base.report_output.resultado_calculado as Record<string, unknown>).scores = {
    assertivo: 12, participativo: 10, integrador: 11, analitico: 13
  };
  const result = normalizeV30Report(base);
  assert.equal(result.valid, true);
  assert.deepEqual(result.report?.reportOutput.resultado_calculado, {
    scores: { assertivo: 12, participativo: 10, integrador: 11, analitico: 13 }
  });
});

test('recupera V30 de relatorio_pronto_para_app e aceita id_resultado', () => {
  const base = payload();
  const { report_output, resultado_id, ...rest } = base;
  const result = normalizeV30Report({
    ...rest,
    id_resultado: 'resultado-alias',
    relatorio_pronto_para_app: JSON.stringify(report_output)
  });
  assert.equal(result.valid, true);
  assert.equal(result.report?.resultadoId, 'resultado-alias');
});
