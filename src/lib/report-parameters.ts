import { ReportParameter, ReportUserType } from '../types';

type CatalogItem = Omit<ReportParameter, 'tipo_usuario' | 'ativo'> & { ativo?: boolean; participanteAtivo?: boolean; consultorAtivo?: boolean; adminAtivo?: boolean };

export const REPORT_PARAMETER_CATALOG: CatalogItem[] = [
  { secao: 'capa', campo: 'identificacao', titulo: 'Identificacao do relatorio', descricao: 'Nome, empresa, data de geracao, codigo e estilo predominante na capa.', ordem: 10 },
  { secao: 'sintese', campo: 'visao_geral', titulo: 'Visao Geral do Perfil', descricao: 'Cards de Dominante, Auxiliar, Terciario e Adjacente.', ordem: 20 },
  { secao: 'sintese', campo: 'parecer_executivo', titulo: 'Parecer Executivo da Banca', descricao: 'Texto narrativo principal do relatorio individual.', ordem: 30 },
  { secao: 'metricas', campo: 'distribuicao_energia', titulo: 'Distribuicao Metrica de Energia', descricao: 'Radar, barras ordenadas por ranking e infografico dos quatro papeis.', ordem: 40 },
  { secao: 'perfil', campo: 'quatro_socioestilos', titulo: 'Conheca os Quatro Socio Estilos', descricao: 'Infografico responsivo dos quatro papeis do socioestilo.', ordem: 50 },
  { secao: 'analise', campo: 'perfil_predominante', titulo: 'Perfil Predominante', descricao: 'Campo canonico V30/V36 para o estilo predominante.', ordem: 60 },
  { secao: 'analise', campo: 'perfil_secundario', titulo: 'Perfil Secundario', descricao: 'Campo canonico V30/V36 para o estilo secundario.', ordem: 70 },
  { secao: 'analise', campo: 'lado_luz', titulo: 'Lado Luz', descricao: 'Leitura positiva de desempenho e expressao do melhor potencial.', ordem: 80 },
  { secao: 'analise', campo: 'lado_sombra', titulo: 'Lado Sombra', descricao: 'Leitura do excesso de forca sob pressao.', ordem: 90 },
  { secao: 'analise', campo: 'estilo_a_desenvolver', titulo: 'Estilo a Desenvolver', descricao: 'Competencia complementar para ampliar repertorio.', ordem: 100 },
  { secao: 'analise', campo: 'relacoes_entre_estilos', titulo: 'Relacoes entre Estilos', descricao: 'Narrativa, combinacoes, situacoes praticas, cuidados e oportunidades.', ordem: 110 },
  { secao: 'recomendacoes', campo: 'potencializacao_talentos', titulo: 'Potencializacao dos Talentos', descricao: 'Talento identificado, valor gerado, contextos, estrategias e ponto de equilibrio.', ordem: 120 },
  { secao: 'recomendacoes', campo: 'pdi', titulo: 'Plano de Desenvolvimento Individual', descricao: 'Objetivos prioritarios, plano de acao, indicadores e compromisso.', ordem: 130 },
  { secao: 'recomendacoes', campo: 'primeiros_passos', titulo: 'Primeiros Passos', descricao: 'Lista de orientacoes iniciais quando disponivel.', ordem: 140 },
  { secao: 'memoria', campo: 'respostas_questionario', titulo: 'Memoria do questionario', descricao: 'Rastreabilidade das respostas e memoria de calculo.', ordem: 150, participanteAtivo: false },
  { secao: 'auditoria', campo: 'trilha_rag', titulo: 'Trilha de Auditoria RAG', descricao: 'Documentos, chunks e metadados tecnicos autorizados.', ordem: 160, participanteAtivo: false, consultorAtivo: false },

  { secao: 'perfil', campo: 'explicacao_socioestilo', titulo: 'O que é Sócio Estilo', descricao: 'Compatibilidade com relatorios antigos.', ordem: 240, ativo: false },
  { secao: 'perfil', campo: 'resultado_grafico', titulo: 'Seu resultado', descricao: 'Compatibilidade com relatorios antigos.', ordem: 241, ativo: false },
  { secao: 'perfil', campo: 'revelacao_perfil', titulo: 'O que seu perfil revela', descricao: 'Compatibilidade com relatorios antigos.', ordem: 242, ativo: false },
  { secao: 'perfil', campo: 'perfil_complementar', titulo: 'Seu perfil complementar', descricao: 'Compatibilidade com relatorios antigos.', ordem: 243, ativo: false },
  { secao: 'dinamica', campo: 'dinamica_estilos', titulo: 'Dinamica dos estilos', descricao: 'Compatibilidade com relatorios antigos.', ordem: 244, ativo: false },
  { secao: 'diagnostico', campo: 'pontos_fortes', titulo: 'Pontos fortes e talentos', descricao: 'Compatibilidade com relatorios antigos.', ordem: 245, ativo: false },
  { secao: 'diagnostico', campo: 'evidencias_observadas', titulo: 'Evidencias observadas', descricao: 'Compatibilidade com relatorios antigos.', ordem: 246, participanteAtivo: false, ativo: false },
  { secao: 'diagnostico', campo: 'pontos_desenvolvimento', titulo: 'Situacoes de pressao', descricao: 'Compatibilidade com relatorios antigos.', ordem: 247, ativo: false },
  { secao: 'diagnostico', campo: 'descricao_estilo', titulo: 'Descricao do estilo dominante', descricao: 'Compatibilidade com relatorios antigos.', ordem: 248, ativo: false },
  { secao: 'recomendacoes', campo: 'recomendacoes_praticas', titulo: 'Recomendacoes praticas', descricao: 'Compatibilidade com relatorios antigos.', ordem: 249, ativo: false },
  { secao: 'pdi', campo: 'objetivos_prioritarios', titulo: 'Objetivos prioritarios', descricao: 'Compatibilidade com relatorios antigos.', ordem: 250, ativo: false },
  { secao: 'pdi', campo: 'plano_acao', titulo: 'Plano de acao', descricao: 'Compatibilidade com relatorios antigos.', ordem: 251, ativo: false },
  { secao: 'pdi', campo: 'indicadores_evolucao', titulo: 'Indicadores de evolucao', descricao: 'Compatibilidade com relatorios antigos.', ordem: 252, ativo: false },
  { secao: 'pdi', campo: 'compromisso_desenvolvimento', titulo: 'Compromisso de desenvolvimento', descricao: 'Compatibilidade com relatorios antigos.', ordem: 253, ativo: false },
  { secao: 'pdi', campo: 'potencial_desenvolvimento', titulo: 'Potencial de desenvolvimento legado', descricao: 'Compatibilidade com relatorios antigos.', ordem: 254, ativo: false },
  { secao: 'pdi', campo: 'conselho_alta_performance', titulo: 'Conselho de alta performance', descricao: 'Compatibilidade com relatorios antigos.', ordem: 255, ativo: false },
  { secao: 'metodologia', campo: 'metodologia_potenciar', titulo: 'Sobre a Metodologia', descricao: 'Compatibilidade com relatorios antigos.', ordem: 256, ativo: false },
  { secao: 'metodologia', campo: 'tabela_socioestilos', titulo: 'Tabela comparativa tecnica', descricao: 'Compatibilidade com relatorios antigos.', ordem: 257, participanteAtivo: false, ativo: false },
  { secao: 'auditoria', campo: 'timeline_processamento', titulo: 'Linha do tempo de processamento', descricao: 'Compatibilidade com relatorios antigos.', ordem: 258, participanteAtivo: false, ativo: false },
  { secao: 'auditoria', campo: 'metadados_integracao', titulo: 'Metadados de integracao', descricao: 'Compatibilidade com relatorios antigos.', ordem: 259, participanteAtivo: false, ativo: false },
  { secao: 'auditoria', campo: 'base_conhecimento', titulo: 'Base de conhecimento consultada', descricao: 'Compatibilidade com relatorios antigos.', ordem: 260, participanteAtivo: false, consultorAtivo: false, adminAtivo: false, ativo: false },
  { secao: 'auditoria', campo: 'fundamentacao_teorica', titulo: 'Fundamentacao teorica tecnica', descricao: 'Compatibilidade com relatorios antigos.', ordem: 261, participanteAtivo: false, ativo: false },
  { secao: 'auditoria', campo: 'json_bruto', titulo: 'JSON bruto', descricao: 'Compatibilidade com relatorios antigos.', ordem: 262, participanteAtivo: false, consultorAtivo: false, ativo: false }
];

export const REPORT_SECTION_TITLES: Record<string, string> = {
  capa: 'Capa e identificacao',
  sintese: 'Resumo executivo',
  perfil: 'Seu perfil de Socioestilo',
  metricas: 'Metricas e graficos',
  analise: 'Leitura comportamental',
  recomendacoes: 'Recomendacoes praticas',
  pdi: 'Plano de desenvolvimento',
  metodologia: 'Sobre a Metodologia',
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