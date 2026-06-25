import { Question, Scores } from '../types';

export const QUESTIONS: Question[] = [
  {
    id: 1,
    text: "Marque com um X as cinco principais qualidades com nas quais você se reconhece como profissionalmente:",
    mode: 'multi',
    maxChoices: 5,
    options: [
      { text: "Determinado" },
      { text: "Influente" },
      { text: "Paciente" },
      { text: "Otimista" },
      { text: "Rápido" },
      { text: "Lógico" },
      { text: "Respeitoso" },
      { text: "Preciso" },
      { text: "Objetivo" },
      { text: "Entusiasmado" },
      { text: "Colaborativo" },
      { text: "Detalhista" }
    ]
  },
  {
    id: 2,
    text: "Um cliente ou colega reclama porque você não retornou rapidamente um contato. Qual sua reação imediata?",
    mode: 'single',
    options: [
      { text: "Pedir desculpas e ir direto ao assunto do interesse do cliente ou colega." },
      { text: "Explicar os motivos da demora para que o cliente ou colega possa entender o que aconteceu." },
      { text: "Mostrar empatia pela irritação do cliente ou colega e que realmente se importa." },
      { text: "Tentar reverter a situação imediatamente, com criatividade e bom-humor." }
    ]
  },
  {
    id: 3,
    text: "Qual dessas atividades daria a você maior prazer profissional?",
    mode: 'single',
    options: [
      { text: "Comunicação, relacionamento interpessoal, trabalho em equipe, uso da criatividade e da imaginação." },
      { text: "Análise de mercado, inteligência estratégica, desafios em que você pode testar sua lógica e raciocinalidade." },
      { text: "Realização de eventos integrativos e colaborativos, unir as pessoas em torno de um objetivo." },
      { text: "Resolver problemas urgentes, execução de um grande projeto, cumprir as tarefas no prazo." }
    ]
  },
  {
    id: 4,
    text: "Coisas que normalmente você gosta de fazer no seu tempo de lazer.",
    mode: 'single',
    options: [
      { text: "Colocar coisas em seus lugares, trabalhos manuais, consertar coisas, resolver problemas." },
      { text: "Fazer atividades sem planos rígidos, fazer algo diferente, ouvir música, sair para se divertir." },
      { text: "Conversar com amigos, fazer trabalho voluntário, preparar eventos que reunam amigos ou família." },
      { text: "Ler um bom livro, estudar novidades na internet, comparar produtos e serviços." }
    ]
  },
  {
    id: 5,
    text: "Aponte mais cinco virtudes que as pessoas dizem que você tem como profissional.",
    mode: 'multi',
    maxChoices: 5,
    options: [
      { text: "Tem a habilidade de gerar ambientes harmônicos, é um conciliador." },
      { text: "É muito determinado: quando estabelece um plano, não desiste." },
      { text: "Pensa positivamente nas coisas. Vê o lado bom das pessoas e das coisas." },
      { text: "Tem grande noção de justiça e de imparcialidade." },
      { text: "Tem ótima capacidade de pensar e agir de forma estruturada, passo a passo." },
      { text: "Tem excelente capacidade para gerar novas e criativas ideias." },
      { text: "É extremamente organizado, com as coisas em seus lugares." },
      { text: "Tem ótima noção de responsabilidade, uma pessoa que sempre pensa nos impactos das ações." },
      { text: "Tem grande facilidade em relacionamentos. É influente, convincente e com muitos amigos." },
      { text: "Sempre pensa nos outros e faz com que eles participem das conversas, dos assuntos e das ações." },
      { text: "Sempre pensa nos resultados e é muito persistente." },
      { text: "É considerado pelos outros como alguém humano, compreensivo e preocupado com o bem estar de todos." }
    ]
  },
  {
    id: 6,
    text: "Na aproximação profissional com os outros, eu...",
    mode: 'single',
    options: [
      { text: "Procuro pessoas que sejam formais e tranquilas no modo de agir." },
      { text: "Procuro pessoas otimistas e entusiasmadas pelas ideias a serem colocadas em prática." },
      { text: "Prefiro pessoas que analisam as situações antes de partir para a ação." },
      { text: "Procuro pessoas que sejam rápidas, energéticas na ação." }
    ]
  },
  {
    id: 7,
    text: "Dos tipos de personalidade abaixo, qual você considera a melhor?",
    mode: 'single',
    options: [
      { text: "Pessoas extrovertidas, capacidade de pensar diferente, inovar e inventar." },
      { text: "Pessoas com foco, que tem um objetivo e o perseguem o tempo todo." },
      { text: "Pessoas estratégicas, analíticas, que tomam decisões cuidadosas e prudentes." },
      { text: "Pessoas que se preocupam com as outras pessoas e com os impactos das ações." }
    ]
  },
  {
    id: 8,
    text: "Quais defeitos você vê em você com mais frequência entre as alternativas abaixo.",
    mode: 'single',
    options: [
      { text: "Sou tão focado em resultados que me esqueço das pessoas e de mim mesmo. Sou às vezes agressivo." },
      { text: "Tenho grandes ideias, mas não consigo dar vasão a todas e acabo às vezes ficando sem foco." },
      { text: "Gosto tanto das pessoas que me envolvo com os problemas delas. Às vezes defendo pessoas que não merecem." },
      { text: "Sou detalhista demais, perfeccionista. Sou uma pessoa que não gosta de mudanças, às vezes muito rígido." }
    ]
  },
  {
    id: 9,
    text: "Escolha a alternativa que melhor descreve você.",
    mode: 'single',
    options: [
      { text: "Gosto de organizar e fazer." },
      { text: "Gosto de reunir e compartilhar." },
      { text: "Gosto de analisar e comparar." },
      { text: "Gosto de criar e me relacionar." }
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
      { text: "Mostro-me cuidadoso e organizado e busco soluções precisas, detalhadas e bem fundamentadas." }
    ]
  },
  {
    id: 11,
    text: "Nas situações de cotidiano, eu...",
    mode: 'single',
    options: [
      { text: "Gosto de manter as pessoas integradas. Enfrento conflitos e desagrado pessoas só quando a situação é ameaçadora." },
      { text: "Concentro-me primeiro no trabalho e na produção de resultados. Só depois disso é que me preocupo com relacionamentos." },
      { text: "Gosto de novas ideias e a propostas criativas. Busco argumentar e convencer pelo entusiasmo e relacionamento." },
      { text: "Interesso-me mais por situações que permitam agir de forma organizada e estruturada." }
    ]
  },
  {
    id: 12,
    text: "Quando você está cansado, sob stress você:",
    mode: 'single',
    options: [
      { text: "não marca limite e pede desculpa (diferente do seu usual)" },
      { text: "fala mais alto, demonstra a irritação (diferente do seu costume)" },
      { text: "brinca para aliviar o desconforto (diferente do seu usual)" },
      { text: "começa a dar muitos detalhes sobre o motivo da ação (diferente do seu usual)" }
    ]
  },
  {
    id: 13,
    text: "Diante de uma situação difícil, em que você fica nervoso:",
    mode: 'single',
    options: [
      { text: "se torna teimoso e não quer mudança" },
      { text: "se torna agressivo e quer que as pessoas façam o que você acredita" },
      { text: "tem atuação pouco direta, impulsividade, querendo resolver pela emoção" },
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
