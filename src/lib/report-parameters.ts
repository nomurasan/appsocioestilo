import { ReportParameter, ReportUserType } from '../types';

type CatalogItem = Omit<ReportParameter, 'tipo_usuario' | 'ativo'> & { ativo?: boolean; participanteAtivo?: boolean; consultorAtivo?: boolean; adminAtivo?: boolean };

export const REPORT_PARAMETER_CATALOG: CatalogItem[] = [
  { secao: 'capa', campo: 'identificacao', titulo: 'Identificacao do relatorio', descricao: 'Nome, empresa, data de geracao, codigo e estilo predominante na capa.', ordem: 10 },
  { secao: 'sintese', campo: 'visao_geral', titulo: 'Resumo executivo visual', descricao: 'Cards de estilo principal, auxiliar, terciario e menos utilizado.', ordem: 20 },
  { secao: 'sintese', campo: 'parecer_executivo', titulo: 'Resumo executivo', descricao: 'Texto narrativo principal do relatorio individual.', ordem: 30 },
  { secao: 'perfil', campo: 'explicacao_socioestilo', titulo: 'O que e Socioestilo', descricao: 'Explicacao introdutoria da metodologia para o participante.', ordem: 40 },
  { secao: 'perfil', campo: 'quatro_socioestilos', titulo: 'Conheca os quatro Socioestilos', descricao: 'Tabela comparativa dos quatro socioestilos.', ordem: 50 },
  { secao: 'metricas', campo: 'radar_estilos', titulo: 'Radar de estilos', descricao: 'Grafico radar com distribuicao dos quatro socioestilos.', ordem: 60 },
  { secao: 'metricas', campo: 'ranking_estilos', titulo: 'Ranking dos estilos', descricao: 'Lista ordenada dos estilos com pontos e percentuais.', ordem: 70 },
  { secao: 'perfil', campo: 'resultado_grafico', titulo: 'Seu resultado', descricao: 'Resultado visual e ranking do perfil.', ordem: 80 },
  { secao: 'perfil', campo: 'revelacao_perfil', titulo: 'O que seu perfil revela', descricao: 'Descricao interpretativa do estilo dominante.', ordem: 90 },
  { secao: 'perfil', campo: 'potencializacao_talentos', titulo: 'Como potencializar seus talentos', descricao: 'Talento identificado, valor gerado, contextos, estrategias e ponto de equilibrio.', ordem: 100 },
  { secao: 'perfil', campo: 'perfil_complementar', titulo: 'Seu perfil complementar', descricao: 'Perfis secundario, terciario e menos utilizado.', ordem: 110 },
  { secao: 'dinamica', campo: 'dinamica_estilos', titulo: 'Dinamica dos estilos', descricao: 'Lado saudavel, situacoes de pressao e equilibrio.', ordem: 120 },
  { secao: 'diagnostico', campo: 'pontos_fortes', titulo: 'Pontos fortes e talentos', descricao: 'Lista de talentos naturais e forcas comportamentais.', ordem: 130 },
  { secao: 'diagnostico', campo: 'evidencias_observadas', titulo: 'Evidencias observadas', descricao: 'Evidencias derivadas das respostas do questionario.', ordem: 140, participanteAtivo: false },
  { secao: 'diagnostico', campo: 'pontos_desenvolvimento', titulo: 'Situacoes de pressao', descricao: 'Riscos, sombras e pontos criticos sob pressao.', ordem: 150 },
  { secao: 'diagnostico', campo: 'descricao_estilo', titulo: 'Descricao do estilo dominante', descricao: 'Expressao textual do estilo comportamental identificado.', ordem: 160 },
  { secao: 'recomendacoes', campo: 'recomendacoes_praticas', titulo: 'Recomendacoes praticas', descricao: 'Diretrizes taticas de alta performance.', ordem: 170 },
  { secao: 'pdi', campo: 'objetivos_prioritarios', titulo: 'Objetivos prioritarios', descricao: 'Objetivos e beneficios esperados do PDI.', ordem: 180 },
  { secao: 'pdi', campo: 'plano_acao', titulo: 'Plano de acao', descricao: 'Acoes, frequencia, indicador e prazo sugerido.', ordem: 190 },
  { secao: 'pdi', campo: 'indicadores_evolucao', titulo: 'Indicadores de evolucao', descricao: 'Indicadores ou perguntas de reflexao para acompanhar a evolucao.', ordem: 200 },
  { secao: 'pdi', campo: 'compromisso_desenvolvimento', titulo: 'Compromisso de desenvolvimento', descricao: 'Texto final do participante ou texto gerado pela IA.', ordem: 210 },
  { secao: 'pdi', campo: 'potencial_desenvolvimento', titulo: 'Potencial de desenvolvimento legado', descricao: 'Compatibilidade com relatorios antigos.', ordem: 220 },
  { secao: 'pdi', campo: 'conselho_alta_performance', titulo: 'Conselho de alta performance', descricao: 'Sintese final de orientacao estrategica individual.', ordem: 230 },
  { secao: 'metodologia', campo: 'metodologia_potenciar', titulo: 'Fundamentacao metodologica', descricao: 'Texto de referencia metodologica usado no relatorio.', ordem: 240 },
  { secao: 'metodologia', campo: 'tabela_socioestilos', titulo: 'Sobre o Socioestilo', descricao: 'Tabela com foco de atuacao e fundamentos comunicativos.', ordem: 250 },
  { secao: 'memoria', campo: 'respostas_questionario', titulo: 'Memoria do questionario', descricao: 'Rastreabilidade das respostas e memoria de calculo.', ordem: 260, participanteAtivo: false },
  { secao: 'auditoria', campo: 'timeline_processamento', titulo: 'Linha do tempo de processamento', descricao: 'Registro tecnico das etapas de coleta, scoring, IA e emissao.', ordem: 270, participanteAtivo: false },
  { secao: 'auditoria', campo: 'metadados_integracao', titulo: 'Metadados de integracao', descricao: 'Workflow, prompt, modelo, divergencias e dados tecnicos.', ordem: 280, participanteAtivo: false },
  { secao: 'auditoria', campo: 'base_conhecimento', titulo: 'Base de conhecimento consultada', descricao: 'Documentos e chunks recuperados na validacao.', ordem: 290, participanteAtivo: false, consultorAtivo: false, adminAtivo: false },
  { secao: 'auditoria', campo: 'fundamentacao_teorica', titulo: 'Fundamentacao teorica tecnica', descricao: 'Referenciais teoricos e contribuicoes metodologicas.', ordem: 300, participanteAtivo: false },
  { secao: 'auditoria', campo: 'trilha_rag', titulo: 'Trilha de Auditoria RAG', descricao: 'Conteudo tecnico recuperado dos chunks usados na validacao.', ordem: 310, participanteAtivo: false, consultorAtivo: false },
  { secao: 'auditoria', campo: 'json_bruto', titulo: 'JSON bruto', descricao: 'Payload tecnico completo para auditoria administrativa.', ordem: 320, participanteAtivo: false, consultorAtivo: false }
];

export const REPORT_SECTION_TITLES: Record<string, string> = {
  capa: 'Capa e identificacao',
  sintese: 'Resumo executivo',
  perfil: 'Seu perfil de Socioestilo',
  metricas: 'Metricas e graficos',
  dinamica: 'Dinamica dos estilos',
  diagnostico: 'Leitura comportamental',
  recomendacoes: 'Recomendacoes praticas',
  pdi: 'Plano de desenvolvimento',
  metodologia: 'Fundamentacao e Socioestilo',
  memoria: 'Memoria do questionario',
  auditoria: 'Auditoria e conformidade'
};

export function getDefaultReportParameters(tipoUsuario: ReportUserType): ReportParameter[] {
  const normalizedType = tipoUsuario === 'usuario' ? 'participante' : tipoUsuario;

  return REPORT_PARAMETER_CATALOG.map(item => {
    const profileDefault = normalizedType === 'admin'
      ? item.adminAtivo
      : normalizedType === 'consultor'
        ? item.consultorAtivo
        : item.participanteAtivo;

    return {
      ...item,
      tipo_usuario: tipoUsuario,
      ativo: profileDefault ?? item.ativo ?? true
    };
  });
}