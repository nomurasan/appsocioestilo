import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getAnalysisPersistenceState,
  getReportOutputFromAnalysis,
  getV30ScoresFromAnalysis,
  unwrapAnalysisResponse
} from './report-integration';

const ids = ['perfil_predominante', 'perfil_secundario', 'lado_luz', 'lado_sombra', 'estilo_a_desenvolver', 'relacoes_entre_estilos', 'recomendacoes'] as const;
const reportOutput = {
  identificacao: { nome: 'Pessoa' },
  resultado_calculado: { scores: { assertivo: 1, participativo: 2, integrador: 3, analitico: 4 } },
  campos_relatorio: Object.fromEntries(ids.map((id, ordem) => [id, {
    id,
    titulo: id,
    status: 'generated',
    enabled: true,
    ordem: ordem + 1,
    conteudo: { texto: `conteúdo ${id}` },
    evidencias: [],
    ucs_utilizadas: [],
    fallback: { used: false }
  }]))
};

const validResponse = {
  contract_version: 'V30',
  resultado_id: 'resultado-remoto-1',
  relatorio_uuid: '123e4567-e89b-12d3-a456-426614174000',
  persisted: true,
  report_output: reportOutput
};

test('preserva report_output e IDs através de envelope data', () => {
  const response = { data: validResponse };
  assert.equal(unwrapAnalysisResponse(response), validResponse);
  assert.equal(getReportOutputFromAnalysis(response), reportOutput);
  assert.equal(getAnalysisPersistenceState(response).resultadoId, 'resultado-remoto-1');
  assert.equal(getAnalysisPersistenceState(response).relatorioUuid, '123e4567-e89b-12d3-a456-426614174000');
});

test('reconhece persistência remota válida e nunca inventa IDs', () => {
  const state = getAnalysisPersistenceState(validResponse);
  assert.equal(state.persisted, true);
  assert.equal(state.invalidPersistedResponse, false);
  assert.equal(getAnalysisPersistenceState({ persisted: true }).persisted, false);
  assert.equal(getAnalysisPersistenceState({ persisted: true }).invalidPersistedResponse, true);
});

test('reaproveita scores V30 válidos sem recalcular e rejeita V30 inválido', () => {
  assert.deepEqual(getV30ScoresFromAnalysis(validResponse), {
    Assertivo: 1,
    Participativo: 2,
    Integrador: 3,
    Analitico: 4
  });
  assert.equal(getV30ScoresFromAnalysis({ report_output: {} }), null);
});

test('bloqueia fallback legado quando V30 estÃ¡ declarado e invÃ¡lido', () => {
  const state = getAnalysisPersistenceState({ contract_version: 'socioestilo-report/v30', persisted: false });
  assert.equal(state.invalidV30Response, true);
});

test('aceita id_resultado como alias para impedir gravaÃ§Ã£o duplicada', () => {
  const state = getAnalysisPersistenceState({ persisted: true, id_resultado: 'resultado-alias' });
  assert.equal(state.persisted, true);
  assert.equal(state.resultadoId, 'resultado-alias');
});
