export interface Scores {
  Assertivo: number;
  Participativo: number;
  Integrador: number;
  Analitico: number;
}

export const STYLE_NAMES: Record<keyof Scores, string> = {
  Assertivo: "Assertivo",
  Participativo: "Participativo",
  Integrador: "Integrador",
  Analitico: "Analítico"
};

export interface Empresa {
  id: string;
  nome: string;
  data_criacao: string;
}

export interface Usuario {
  uid: string;
  email: string;
  nome: string;
  empresa_id: string;
  empresa_nome: string;
  role?: string;
  perfil_dominante?: string;
}

export interface Resultado {
  id?: string;
  id_resultado?: string;
  id_usuario: string;
  nome_usuario: string;
  empresa_id: string;
  empresa_nome: string;
  scores: Scores;
  perfil_dominante?: string;
  data_conclusao: string;
  ai_insights?: {
    resumo: string;
    oportunidades: string[];
    desafios: string[];
    insights: string;
    conhecimento_aplicado?: string;
    analise_comportamental?: {
      estilo_identificado: string;
      descricao: string;
      pontos_fortes_talentos: string[];
      pontos_desenvolvimento: string[];
    };
  };
  answers?: Record<string, string | string[]>;
  user_name?: string;
  company_name?: string;
  generated_at?: string;
  ranking?: Array<{ style: string; score: number }> | null;
  perfil_secundario?: string;
  perfil_terciario?: string;
  perfil_menos_utilizado?: string;
  pontuacoes_comportamentais?: Record<string, number> | null;
  respostas_questionario?: Record<string, string | string[]> | null;
  respostas_detalhadas?: Array<{ question_id: number; question_text: string; user_answer: any }> | null;
  relatorio?: any;
  fontes_consultadas?: any;
  relatorio_pronto_para_app?: any;
  raw_payload?: any;
  metadata?: any;
  dinamica_dos_estilos?: {
    lado_luz: string;
    lado_sombra: string;
    estilo_apoio: string;
    estilo_a_desenvolver: string;
  };
  evidencias_observadas?: string[];
  potencial_desenvolvimento?: string[];
  recomendacoes_praticas?: string[];
  q1_opcao_1?: string;
  q1_opcao_2?: string;
  q1_opcao_3?: string;
  q1_opcao_4?: string;
  q1_opcao_5?: string;
  q2_resposta?: string;
  q3_resposta?: string;
  q4_resposta?: string;
  q5_opcao_1?: string;
  q5_opcao_2?: string;
  q5_opcao_3?: string;
  q5_opcao_4?: string;
  q5_opcao_5?: string;
  q6_resposta?: string;
  q7_resposta?: string;
  q8_resposta?: string;
  q9_resposta?: string;
  q10_resposta?: string;
  q11_resposta?: string;
  q12_resposta?: string;
  q13_resposta?: string;
}

export type ReportUserType = 'admin' | 'consultor' | 'participante' | 'usuario';

export interface ReportParameter {
  tipo_usuario: ReportUserType;
  secao: string;
  campo: string;
  titulo: string;
  descricao: string;
  ativo: boolean;
  ordem?: number;
}

export interface QuestionarioRascunho {
  id?: string;
  empresa_id: string;
  participante_id?: string | null;
  session_token?: string | null;
  respostas: Record<string, string | string[]>;
  etapa_atual: number;
  ultima_pergunta_respondida?: number | null;
  percentual_concluido: number;
  status: 'EM_ANDAMENTO' | 'CONCLUIDO' | 'ABANDONADO' | 'EXPIRADO';
  data_inicio?: string;
  data_ultimo_acesso?: string;
  data_finalizacao?: string | null;
}

export interface AnswerDetail {
  questionId: number;
  question: string;
  answer: string;
}

export interface Option {
  text: string;
  style?: string;
  points?: number;
}

export interface Question {
  id: number;
  text: string;
  mode: 'single' | 'multi';
  maxChoices?: number;
  options: Option[];
}
