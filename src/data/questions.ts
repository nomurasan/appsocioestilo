import { Question, Scores } from '../types';

export const QUESTIONS: Question[] = [
  {
    id: 1,
    text: "Marque com um X as CINCO qualidades com nas quais você mais se reconhece:",
    mode: 'multi',
    maxChoices: 5,
    options: [
      { text: "Determinado" },
      { text: "Comunicativo" },
      { text: "Paciente" },
      { text: "Otimista" },
      { text: "Rápido" },
      { text: "Lógico" },
      { text: "Respeitoso" },
      { text: "Preciso" },
      { text: "Objetivo" },
      { text: "Bem-humorado" },
      { text: "Solidário" },
      { text: "Detalhista" }
    ]
  },
  {
    id: 2,
    text: "Um cliente ou colega fica irritado porque você não retornou rapidamente um contato. Qual sua reação imediata?",
    mode: 'single',
    options: [
      { text: "Pedir desculpas e ir direto ao assunto do interesse do cliente ou colega." },
      { text: "Explicar detalhadamente os motivos, para que o cliente ou colega possa entender o que aconteceu." },
      { text: "Entender a irritação do cliente ou colega, pedir desculpas e buscar demonstrar claramente o quanto você se importou." },
      { text: 'Tentar "desarmar" o cliente ou colega, com bom humor e habilidade, mostrando que está tudo bem apesar de não ter retornado.' }
    ]
  },
  {
    id: 3,
    text: "Qual dessas atividades daria a você maior prazer profissional?",
    mode: 'single',
    options: [
      { text: "Comunicação, relacionamento interpessoal, criação de novos produtos, uso da criatividade e da imaginação." },
      { text: "Análise de clientes ou mercado, inteligência estratégica, desafios em que você pode testar sua capacidade e inteligência." },
      { text: "Criação de eventos integrativos, unir as pessoas em torno de um objetivo." },
      { text: "Resolver problemas urgentes, execution de um grande projeto, cumprir as tarefas no prazo." }
    ]
  },
  {
    id: 4,
    text: "Coisas que normalmente você gosta de fazer no seu tempo de lazer:",
    mode: 'single',
    options: [
      { text: "Organizar coisas, trabalhos manuais, consertar coisas, resolver problemas." },
      { text: "Fazer as atividades sem planos rígidos, fazer algo diferente, ouvir música, sair para dançar." },
      { text: "Conversar com amigos, fazer trabalho voluntário, ligar para alguém distante." },
      { text: "Ler um bom livro, colocar as coisas nos lugares, estudar novidades na internet, comparar produtos e serviços." }
    ]
  },
  {
    id: 5,
    text: "Aponte mais CINCO virtudes que as pessoas dizem que você tem:",
    mode: 'multi',
    maxChoices: 5,
    options: [
      { text: "Gosta de ambientes com harmonia e em paz." },
      { text: "É muito focado: quando coloca uma coisa na cabeça, não desiste." },
      { text: "Pensa positivamente nas coisas. Vê o lado bom das pessoas e das coisas." },
      { text: "Tem grande noção de justiça e de imparcialidade." },
      { text: "Tem ótima capacidade de pensar e agir processualmente, passo a passo." },
      { text: "Tem excelente capacidade para gerar novas e criativas ideias." },
      { text: "É extremamente organizado, com as coisas em seus lugares." },
      { text: "Tem ótima noção de responsabilidade. É visto como a pessoa que sempre pensa em tudo." },
      { text: "Tem excelente em relacionamentos. Impossível não gostar de você." },
      { text: "Sempre pensa nos outros e tenta fazer com que eles participem das conversas e dos assuntos." },
      { text: "É um realizador. Tem grande foco nos resultados e consegue sempre o que quer." },
      { text: "Sempre que pensam em alguém humano, sensível e compreensivo, pensam em você." }
    ]
  },
  {
    id: 6,
    text: "Na aproximação com os outros, eu...",
    mode: 'single',
    options: [
      { text: "Procuro pessoas que sejam formais e não sejam por demais agitadas." },
      { text: "Procuro pessoas otimistas e entusiasmadas pelas minhas ideias." },
      { text: "Prefiro pessoas mais quietas e que analisam as situações antes de abordar diretamente os outros." },
      { text: "Procuro pessoas com quem possa dividir o trabalho e alcançar resultados." }
    ]
  },
  {
    id: 7,
    text: "Dos tipos de personalidade abaixo, qual você considera a melhor?",
    mode: 'single',
    options: [
      { text: "Grande capacidade de extroversão, capacidade de pensar diferente, inovar e inventar." },
      { text: "Pessoas com foco, excelência no que fazem, procuram melhorar sempre e tem um objetivo e o perseguem o tempo todo." },
      { text: "Pensamento estratégico, analítico, que tomam decisões cuidadosas e prudentes." },
      { text: "Gente que gosta de tradições. Pessoas que se preocupam com as outras pessoas. Pessoas fiéis." }
    ]
  },
  {
    id: 8,
    text: "Quais defeitos você vê em você com mais frequência entre as alternativas abaixo:",
    mode: 'single',
    options: [
      { text: "Sou tão focado em resultados que me esqueço das pessoas e de mim mesmo. Pessoa competitiva demais." },
      { text: "Tenho grandes ideias, mas não consigo dar vasão a todas e acabo ficando sem foco." },
      { text: "Gosto tanto das pessoas que me envolvo com os problemas delas. Às vezes defende pessoas que não merecem." },
      { text: "Detalhista demais, perfeccionista. Pessoa que não gosta de mudança." }
    ]
  },
  {
    id: 9,
    text: "Escolha a alternativa que melhor descreve você:",
    mode: 'single',
    options: [
      { text: "Gosto de organizar e fazer." },
      { text: "Gosto de compartilhar." },
      { text: "Gosto de analisar." },
      { text: "Gosto de criar." }
    ]
  },
  {
    id: 10,
    text: "No trabalho em equipe, eu...",
    mode: 'single',
    options: [
      { text: "Mostro-me cooperativo, agradável e sempre que possível evito entrar em conflito." },
      { text: "Concentro-me nos problemas mais urgentes, de modo objetivo e organizado." },
      { text: "Destaco-me pela criatividade e valorizo o entusiasmo, engajamento e o senso de humor." },
      { text: "Mostro-me cuidadoso e organizado e apoio sugestões precisas, detalhadas e bem fundamentadas." }
    ]
  },
  {
    id: 11,
    text: "Nas situações de cotidiano, eu...",
    mode: 'single',
    options: [
      { text: "Gosto de manter as pessoas integradas. Enfrento conflitos e desagrado pessoas só quando a situação é ameaçadora." },
      { text: "Concentro-me primeiro no trabalho e na produção de resultados. Só depois disso é que me preocupo com relacionamentos." },
      { text: "Gosto de novas ideias e à propostas criativas. Só depois busco argumentos para convencer as pessoas." },
      { text: "Interesso-me mais por situações que permitam trabalhar ideias de forma organizada e estruturada." }
    ]
  },
  {
    id: 12,
    text: "Quando você está cansado, sob stress você:",
    mode: 'single',
    options: [
      { text: "fala mais alto, demonstra a irritação (diferente do seu costume)" },
      { text: "começa a dar muitos detalhes sobre o motivo da ação (diferente do seu usual)" },
      { text: "brinca para aliviar o desconforto (diferente do seu usual)" },
      { text: "não marca limite e pede desculpa (diferente do seu usual)" }
    ]
  },
  {
    id: 13,
    text: "Diante de uma situação difícil, em que você fica nervoso:",
    mode: 'single',
    options: [
      { text: "tem uma ideia e nao a modifica mesmo se os outros sugerem diferente" },
      { text: "culpa outras pessoas pelo erro" },
      { text: "busca varias pessoas para pensar junto, gerando um excesso de ideias" },
      { text: "leva muito tempo analisando o fato e as vezes perde o tempo da solução" }
    ]
  }
];

export interface ProfileDetail {
  title: string;
  description: string;
  strengths: string[];
  growthAreas: string[];
}

export const PROFILE_DETAILS: Record<keyof Scores, ProfileDetail> = {
  Assertivo: {
    title: "Assertivo",
    description: "Indivíduos com perfil Assertivo são focados em resultados, rápidos, eficientes e objetivos. Eles preferem ir direto ao ponto, adoram desafios e tomam decisões ágeis.",
    strengths: ["Foco inabalável em metas", "Tomada de decisões rápida", "Liderança nata sob pressão", "Busca constante por eficiência"],
    growthAreas: ["Desenvolver paciência ativa com outros ritmos", "Dar mais importância aos sentimentos alheios", "Aprender a delegar com profundidade"]
  },
  Participativo: {
    title: "Participativo",
    description: "Indivíduos com perfil Participativo são comunicativos, persuasivos, otimistas e cheios de entusiasmo. Eles se motivam pelo relacionamento humano, trabalho integrado, criatividade e novas ideias.",
    strengths: ["Excelente comunicação interpessoal", "Habilidade de engajar e motivar equipes", "Visão de futuro e criatividade inovadora", "Adaptabilidade a novos cenários"],
    growthAreas: ["Melhorar o foco em rotinas e detalhes", "Acompanhar tarefas até a conclusão", "Ouvir tanto quanto fala"]
  },
  Integrador: {
    title: "Integrador",
    description: "Perfis Integradores são extremamente empáticos, solidários, cooperativos, orientados à estabilidade e focados em manter relacionamentos saudáveis e de cooperação mútua na equipe.",
    strengths: ["Excelente construtor de relacionamentos", "Empatia profunda e escuta ativa", "Mediação eficaz de conflitos", "Lealdade e apoio incondicional à equipe"],
    growthAreas: ["Aprender a dizer 'não' quando necessário", "Lidar com conflitos de forma direta", "Posicionar-se com mais assertividade comercial"]
  },
  Analitico: {
    title: "Analítico",
    description: "Profissionais Analíticos são lógicos, precisos, organizados e orientados por dados. Eles tomam decisões prudentes e estruturadas com base em evidências.",
    strengths: ["Precisão cirúrgica e atenção aos detalhes", "Pensamento estratégico estruturado", "Alta qualidade técnica nas entregas", "Análise lógica profunda de problemas"],
    growthAreas: ["Evitar a 'paralisia por análise'", "Aceitar riscos calculados e ser mais flexível", "Aumentar a velocidade de decisão em condições incertas"]
  }
};
