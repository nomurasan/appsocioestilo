import { Scores } from '../types';

export interface ProfileDetail {
  title: string;
  description: string;
  strengths: string[];
  growthAreas: string[];
}

export const PROFILE_DETAILS: Record<keyof Scores, ProfileDetail> = {
  Assertivo: {
    title: "Assertivo",
    description: "Pessoas com perfil Assertivo tendem a ser focadas em resultados, rapidas, eficientes e objetivas. Preferem ir direto ao ponto, gostam de desafios e tomam decisoes com agilidade.",
    strengths: ["Foco em metas", "Tomada de decisao rapida", "Lideranca sob pressao", "Busca por eficiencia"],
    growthAreas: ["Desenvolver paciencia ativa", "Considerar melhor os sentimentos alheios", "Delegar com mais profundidade"]
  },
  Participativo: {
    title: "Participativo",
    description: "Pessoas com perfil Participativo tendem a ser comunicativas, persuasivas, otimistas e entusiasmadas. Motivam-se por relacionamento, integracao, criatividade e novas ideias.",
    strengths: ["Comunicacao interpessoal", "Engajamento de equipes", "Visao criativa", "Adaptabilidade"],
    growthAreas: ["Melhorar foco em rotinas e detalhes", "Acompanhar tarefas ate a conclusao", "Ouvir tanto quanto fala"]
  },
  Integrador: {
    title: "Integrador",
    description: "Pessoas com perfil Integrador tendem a ser empaticas, cooperativas, orientadas a estabilidade e focadas em manter relacionamentos saudaveis na equipe.",
    strengths: ["Construcao de relacionamentos", "Escuta ativa", "Mediacao de conflitos", "Apoio a equipe"],
    growthAreas: ["Aprender a dizer nao quando necessario", "Lidar com conflitos de forma direta", "Posicionar-se com mais assertividade"]
  },
  Analitico: {
    title: "Analitico",
    description: "Pessoas com perfil Analitico tendem a ser logicas, precisas, organizadas e orientadas por dados. Tomam decisoes prudentes e estruturadas com base em evidencias.",
    strengths: ["Precisao e atencao aos detalhes", "Pensamento estruturado", "Qualidade tecnica", "Analise logica de problemas"],
    growthAreas: ["Evitar paralisia por analise", "Aceitar riscos calculados", "Aumentar velocidade de decisao"]
  }
};
