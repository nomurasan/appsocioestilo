import { ReportParameter, ReportUserType } from '../types';

type CatalogItem = Omit<ReportParameter, 'tipo_usuario' | 'ativo'>;

export const REPORT_PARAMETER_CATALOG: CatalogItem[] = [
  {
    secao: 'capa',
    campo: 'identificacao',
    titulo: 'Identificação do relatório',
    descricao: 'Nome, empresa, data de geração, código e estilo predominante na capa.',
    ordem: 10
  },
  {
    secao: 'sintese',
    campo: 'visao_geral',
    titulo: 'Visão geral do perfil',
    descricao: 'Cards de estilo principal, auxiliar, terciário e menos utilizado.',
    ordem: 20
  },
  {
    secao: 'sintese',
    campo: 'parecer_executivo',
    titulo: 'Parecer executivo',
    descricao: 'Texto narrativo principal do relatório individual.',
    ordem: 30
  },
  {
    secao: 'metricas',
    campo: 'radar_estilos',
    titulo: 'Radar de estilos',
    descricao: 'Gráfico radar com distribuição dos quatro socioestilos.',
    ordem: 40
  },
  {
    secao: 'metricas',
    campo: 'ranking_estilos',
    titulo: 'Ranking dos estilos',
    descricao: 'Lista ordenada dos estilos com pontos e percentuais.',
    ordem: 50
  },
  {
    secao: 'dinamica',
    campo: 'dinamica_estilos',
    titulo: 'Dinâmica dos estilos',
    descricao: 'Lado luz, lado sombra, estilo de apoio e estilo a desenvolver.',
    ordem: 60
  },
  {
    secao: 'diagnostico',
    campo: 'pontos_fortes',
    titulo: 'Pontos fortes e talentos',
    descricao: 'Lista de talentos naturais e forças comportamentais.',
    ordem: 70
  },
  {
    secao: 'diagnostico',
    campo: 'evidencias_observadas',
    titulo: 'Evidências observadas',
    descricao: 'Evidências derivadas das respostas do questionário.',
    ordem: 80
  },
  {
    secao: 'diagnostico',
    campo: 'pontos_desenvolvimento',
    titulo: 'Pontos de desenvolvimento',
    descricao: 'Riscos, sombras e pontos críticos sob pressão.',
    ordem: 90
  },
  {
    secao: 'diagnostico',
    campo: 'descricao_estilo',
    titulo: 'Descrição do estilo dominante',
    descricao: 'Expressão textual do estilo comportamental identificado.',
    ordem: 100
  },
  {
    secao: 'pdi',
    campo: 'potencial_desenvolvimento',
    titulo: 'Potencial de desenvolvimento',
    descricao: 'Competências e possibilidades de expansão comportamental.',
    ordem: 110
  },
  {
    secao: 'pdi',
    campo: 'recomendacoes_praticas',
    titulo: 'Recomendações práticas',
    descricao: 'Diretrizes táticas de alta performance.',
    ordem: 120
  },
  {
    secao: 'pdi',
    campo: 'conselho_alta_performance',
    titulo: 'Conselho de alta performance',
    descricao: 'Síntese final de orientação estratégica individual.',
    ordem: 130
  },
  {
    secao: 'metodologia',
    campo: 'metodologia_potenciar',
    titulo: 'Metodologia Potenciar',
    descricao: 'Texto de referência metodológica usado no relatório.',
    ordem: 140
  },
  {
    secao: 'metodologia',
    campo: 'tabela_socioestilos',
    titulo: 'Tabela comparativa de socioestilos',
    descricao: 'Tabela com foco de atuação e fundamentos comunicativos.',
    ordem: 150
  },
  {
    secao: 'memoria',
    campo: 'respostas_questionario',
    titulo: 'Memoria do questionario',
    descricao: 'Rastreabilidade das respostas e memoria de calculo.',
    ordem: 155
  },
  {
    secao: 'auditoria',
    campo: 'timeline_processamento',
    titulo: 'Linha do tempo de processamento',
    descricao: 'Registro técnico das etapas de coleta, scoring, IA e emissão.',
    ordem: 160
  },
  {
    secao: 'auditoria',
    campo: 'metadados_integracao',
    titulo: 'Metadados de integração',
    descricao: 'Workflow, prompt, modelo, divergências e dados técnicos.',
    ordem: 170
  },
  {
    secao: 'auditoria',
    campo: 'fundamentacao_teorica',
    titulo: 'Fundamentação teórica',
    descricao: 'Referenciais teóricos e contribuições metodológicas.',
    ordem: 190
  },
  {
    secao: 'auditoria',
    campo: 'trilha_rag',
    titulo: 'Trilha de Auditoria RAG',
    descricao: 'Conteúdo técnico recuperado dos chunks usados na validação.',
    ordem: 200
  }
];

export const REPORT_SECTION_TITLES: Record<string, string> = {
  capa: 'Capa e identificação',
  sintese: 'Síntese executiva',
  metricas: 'Métricas e estilos',
  dinamica: 'Dinâmica comportamental',
  diagnostico: 'Diagnóstico comportamental',
  pdi: 'Plano de desenvolvimento',
  metodologia: 'Metodologia',
  memoria: 'Memoria do questionario',
  auditoria: 'Auditoria e conformidade'
};

export function getDefaultReportParameters(tipoUsuario: ReportUserType): ReportParameter[] {
  return REPORT_PARAMETER_CATALOG.map(item => ({
    ...item,
    tipo_usuario: tipoUsuario,
    ativo: true
  }));
}
