import React, { useState, useEffect, useRef } from 'react';
import { User, ChevronRight, Check, Bot, Home, X, CheckCircle2 } from 'lucide-react';
import { QUESTIONS as STATIC_QUESTIONS } from '../data/questions';
import { Usuario, Scores, Resultado, Question } from '../types';
import {
  abandonarRascunhoQuestionario,
  buscarRascunhoQuestionario,
  concluirRascunhoQuestionario,
  criarResultado,
  listarQuestionMapping,
  salvarRascunhoQuestionario,
  atualizarUsuario
} from '../lib/supabase';

interface QuestionnaireScreenProps {
  usuario: Usuario;
  onFinish: (result: Resultado) => void;
  onGoBack?: () => void;
}

interface ChatMessage {
  id: string;
  sender: 'bot' | 'user';
  text: string;
  isQuestion?: boolean;
  questionIndex?: number;
}

export default function QuestionnaireScreen({ usuario, onFinish, onGoBack }: QuestionnaireScreenProps) {
  // Initialize States directly from localStorage to ensure robust persistence and avoid double question mounts
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(`potenciar_progress_${usuario.uid}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed.currentQuestionIndex === 'number') {
          return parsed.currentQuestionIndex;
        }
      }
    } catch (e) {}
    return 0;
  });

  const [scores, setScores] = useState<Scores>(() => {
    try {
      const saved = localStorage.getItem(`potenciar_progress_${usuario.uid}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.scores) {
          return parsed.scores;
        }
      }
    } catch (e) {}
    return {
      Assertivo: 0,
      Participativo: 0,
      Integrador: 0,
      Analitico: 0
    };
  });

  const [started, setStarted] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(`potenciar_progress_${usuario.uid}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed.started === 'boolean') {
          return parsed.started;
        }
      }
    } catch (e) {}
    return false;
  });

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem(`potenciar_progress_${usuario.uid}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed.messages)) {
          return parsed.messages;
        }
      }
    } catch (e) {}
    
    // Stable initial welcoming messages to prevent any raced duplication
    return [
      {
        id: 'welcome',
        sender: 'bot',
        text: `Olá, ${usuario.nome}! Bem-vindo à Potenciar Consultores Associados. Estou muito animado para te conduzir pelo teste de Socioestilo.`
      },
      {
        id: 'prompt-proceed',
        sender: 'bot',
        text: 'Podemos prosseguir com o preenchimento do questionário?'
      }
    ];
  });

  const [selectedMultiOptions, setSelectedMultiOptions] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>(() => {
    try {
      const saved = localStorage.getItem(`potenciar_progress_${usuario.uid}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.answers) {
          return parsed.answers;
        }
      }
    } catch (e) {}
    return {};
  });

  const [isTyping, setIsTyping] = useState(false);
  const [testCompleted, setTestCompleted] = useState(false);
  const [savedResultPayload, setSavedResultPayload] = useState<Resultado | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [reportSummary, setReportSummary] = useState("");
  const [normalizedResponse, setNormalizedResponse] = useState<any>(null);
  const [draftLoading, setDraftLoading] = useState(true);
  const [remoteDraft, setRemoteDraft] = useState<any>(null);
  const [showDraftRecovery, setShowDraftRecovery] = useState(false);
  const [autosaveStatus, setAutosaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [questions, setQuestions] = useState<Question[]>(STATIC_QUESTIONS);
  const [questionMappingLoading, setQuestionMappingLoading] = useState(true);

  const messageFeedRef = useRef<HTMLDivElement>(null);

  const getNextPendingQuestionIndex = (currentAnswers: Record<string, string | string[]>) => {
    const pendingIndex = questions.findIndex(question => {
      const value = currentAnswers[question.id.toString()];
      return Array.isArray(value) ? value.length === 0 : !value;
    });
    return pendingIndex === -1 ? questions.length : pendingIndex;
  };

  const buildMessagesFromAnswers = (currentAnswers: Record<string, string | string[]>, nextIndex: number): ChatMessage[] => {
    const rebuiltMessages: ChatMessage[] = [
      {
        id: 'welcome-recovered',
        sender: 'bot',
        text: `Olá, ${usuario.nome}! Recuperei seu questionário em andamento.`
      }
    ];

    questions.slice(0, Math.min(nextIndex, questions.length)).forEach(question => {
      const value = currentAnswers[question.id.toString()];
      if (!value) return;

      rebuiltMessages.push({
        id: `question-${question.id}-recovered`,
        sender: 'bot',
        text: `Questão ${question.id}. ${question.text}`,
        isQuestion: false,
        questionIndex: question.id - 1
      });

      rebuiltMessages.push({
        id: `answer-${question.id}-recovered`,
        sender: 'user',
        text: Array.isArray(value) ? value.join(', ') : String(value)
      });
    });

    if (nextIndex < questions.length) {
      const nextQuestion = questions[nextIndex];
      rebuiltMessages.push({
        id: `question-${nextQuestion.id}`,
        sender: 'bot',
        text: `Questão ${nextQuestion.id}. ${nextQuestion.text}`,
        isQuestion: true,
        questionIndex: nextIndex
      });
    }

    return rebuiltMessages;
  };

  const persistDraft = async (
    index: number,
    currentAnswers: Record<string, string | string[]>,
    status: 'EM_ANDAMENTO' | 'CONCLUIDO' = 'EM_ANDAMENTO'
  ) => {
    setAutosaveStatus('saving');
    const saved = status === 'CONCLUIDO'
      ? await concluirRascunhoQuestionario(usuario, currentAnswers, questions.length)
      : await salvarRascunhoQuestionario(usuario, {
          respostas: currentAnswers,
          etapa_atual: index,
          ultima_pergunta_respondida: Math.max(0, index),
          percentual_concluido: Math.round((Object.keys(currentAnswers).length / Math.max(questions.length, 1)) * 100),
          status
        });

    setAutosaveStatus(saved ? 'saved' : 'error');
  };

  useEffect(() => {
    let cancelled = false;

    const loadQuestionMapping = async () => {
      setQuestionMappingLoading(true);
      const mappedQuestions = await listarQuestionMapping();
      if (cancelled) return;

      if (mappedQuestions.length > 0) {
        setQuestions(mappedQuestions);
      } else {
        console.warn('[question_mapping] Usando perguntas locais como fallback.');
        setQuestions(STATIC_QUESTIONS);
      }

      setQuestionMappingLoading(false);
    };

    loadQuestionMapping();
    return () => {
      cancelled = true;
    };
  }, []);

  // Helper helper to write progress state
  const saveProgress = (
    index: number,
    currentScores: Scores,
    currentMessages: ChatMessage[],
    isStarted: boolean,
    currentAnswers: Record<string, string | string[]>
  ) => {
    try {
      const state = {
        currentQuestionIndex: index,
        scores: currentScores,
        messages: currentMessages,
        started: isStarted,
        answers: currentAnswers
      };
      localStorage.setItem(`potenciar_progress_${usuario.uid}`, JSON.stringify(state));
      void persistDraft(index, currentAnswers);
    } catch (e) {
      console.error('Erro ao gravar progresso temporário:', e);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const loadRemoteDraft = async () => {
      setDraftLoading(true);
      const draft = await buscarRascunhoQuestionario(usuario);
      if (cancelled) return;

      const draftAnswers = draft?.respostas || {};
      const hasDraftAnswers = Object.keys(draftAnswers).length > 0;
      const hasLocalProgress = Boolean(localStorage.getItem(`potenciar_progress_${usuario.uid}`));

      if (draft && hasDraftAnswers && !hasLocalProgress) {
        setRemoteDraft(draft);
        setShowDraftRecovery(true);
      }

      setDraftLoading(false);
    };

    loadRemoteDraft();
    return () => {
      cancelled = true;
    };
  }, [usuario.uid]);

  // Focus and scroll active question inside the message feed container ONLY to avoid parent layout jumping
  useEffect(() => {
    if (messageFeedRef.current) {
      const el = messageFeedRef.current;
      const timeoutId = setTimeout(() => {
        const activeQuestionEl = el.querySelector('#active-question-container') as HTMLElement;
        
        // Determine if the current state expects an active question to be shown
        const hasActiveQuestion = messages.some(
          m => m.sender === 'bot' && m.isQuestion && m.questionIndex === currentQuestionIndex
        );

        if (activeQuestionEl && !isTyping) {
          const containerRect = el.getBoundingClientRect();
          const targetRect = activeQuestionEl.getBoundingClientRect();
          const relativeTop = targetRect.top - containerRect.top + el.scrollTop;
          
          el.scrollTo({
            top: Math.max(0, relativeTop - 16),
            behavior: 'smooth'
          });
        } else if (!hasActiveQuestion) {
          // Only scroll bottom as a fallback if no active question is expected (e.g. initial greeting, typing animation, or end-of-test diagnostics)
          const lastChild = el.lastElementChild;
          if (lastChild) {
            lastChild.scrollIntoView({
              behavior: 'smooth',
              block: 'nearest',
              inline: 'nearest'
            });
          }
        }
      }, 150);
      return () => clearTimeout(timeoutId);
    }
  }, [messages, isTyping, currentQuestionIndex]);

  const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

  const handleContinueDraft = () => {
    const draftAnswers = remoteDraft?.respostas || {};
    const nextIndex = getNextPendingQuestionIndex(draftAnswers);
    const rebuiltMessages = buildMessagesFromAnswers(draftAnswers, nextIndex);

    setAnswers(draftAnswers);
    setCurrentQuestionIndex(Math.min(nextIndex, Math.max(questions.length - 1, 0)));
    setMessages(rebuiltMessages);
    setStarted(true);
    setShowDraftRecovery(false);
    saveProgress(Math.min(nextIndex, Math.max(questions.length - 1, 0)), scores, rebuiltMessages, true, draftAnswers);
  };

  const handleStartOverDraft = async () => {
    await abandonarRascunhoQuestionario(usuario);
    localStorage.removeItem(`potenciar_progress_${usuario.uid}`);
    setRemoteDraft(null);
    setShowDraftRecovery(false);
    setAnswers({});
    setCurrentQuestionIndex(0);
    setStarted(false);
    setMessages([
      {
        id: 'welcome-new',
        sender: 'bot',
        text: `Olá, ${usuario.nome}! Bem-vindo à Potenciar Consultores Associados. Estou muito animado para te conduzir pelo teste de Socioestilo.`
      },
      {
        id: 'prompt-proceed-new',
        sender: 'bot',
        text: 'Podemos prosseguir com o preenchimento do questionário?'
      }
    ]);
  };

  // Accept to proceed with first question
  const handleAcceptProceed = async () => {
    const userMsg: ChatMessage = {
      id: 'user-accept',
      sender: 'user',
      text: 'Sim, vamos começar!'
    };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setStarted(true);

    // Save temporary progress
    saveProgress(0, scores, updatedMessages, true, answers);

    setIsTyping(true);
    await delay(1200);

    const firstQ = questions[0];
    if (!firstQ) return;
    const newMessages: ChatMessage[] = [
      ...updatedMessages,
      {
        id: `question-${firstQ.id}`,
        sender: 'bot',
        text: `Questão ${firstQ.id}. ${firstQ.text}`,
        isQuestion: true,
        questionIndex: 0
      }
    ];

    setMessages(newMessages);
    setIsTyping(false);

    // Save actual Question 1 state
    saveProgress(0, scores, newMessages, true, answers);
  };

  // Multi-option toggle for Q1
  const handleToggleMultiOption = (text: string) => {
    const maxChoices = questions[currentQuestionIndex]?.maxChoices || 5;
    setSelectedMultiOptions(prev => {
      if (prev.includes(text)) {
        return prev.filter(item => item !== text);
      }
      if (prev.length >= maxChoices) {
        return prev;
      }
      return [...prev, text];
    });
  };

  const handleConfirmMultiOptions = async () => {
    const maxChoices = questions[currentQuestionIndex]?.maxChoices || 5;
    if (selectedMultiOptions.length !== maxChoices) return;

    // 1. Show user responses in Chat Bubbles
    const userMessageText = `Minhas qualidades: ${selectedMultiOptions.join(', ')}`;
    const userMsg: ChatMessage = {
      id: `user-response-${currentQuestionIndex}-${Date.now()}`,
      sender: 'user',
      text: userMessageText
    };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);

    // Keep the individual answers in memory
    const newAnswers = {
      ...answers,
      [questions[currentQuestionIndex].id.toString()]: [...selectedMultiOptions]
    };
    setAnswers(newAnswers);

    // Save user response temporarily
    saveProgress(currentQuestionIndex, scores, updatedMessages, true, newAnswers);

    // 3. Navigate forward
    setSelectedMultiOptions([]);
    await proceedToNext(scores, currentQuestionIndex + 1, updatedMessages, newAnswers);
  };

  const handleSelectSingleOption = async (optionText: string) => {
    // 1. Show user choices
    const userMsg: ChatMessage = {
      id: `user-response-${currentQuestionIndex}-${Date.now()}`,
      sender: 'user',
      text: optionText
    };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);

    const newAnswers = {
      ...answers,
      [questions[currentQuestionIndex].id.toString()]: optionText
    };
    setAnswers(newAnswers);

    // Save user choice temporarily
    saveProgress(currentQuestionIndex, scores, updatedMessages, true, newAnswers);

    // 3. Move turn forward
    await proceedToNext(scores, currentQuestionIndex + 1, updatedMessages, newAnswers);
  };

  const proceedToNext = async (currentScores: Scores, nextIndex: number, currentMessagesAccumulator: ChatMessage[], currentAnswers: Record<string, string | string[]>) => {
    setIsTyping(true);
    await delay(1400);

    if (nextIndex < questions.length) {
      setCurrentQuestionIndex(nextIndex);
      const nextQ = questions[nextIndex];

      const newQuestionMsg: ChatMessage = {
        id: `question-${nextQ.id}`,
        sender: 'bot',
        text: `Questão ${nextQ.id}. ${nextQ.text}`,
        isQuestion: true,
        questionIndex: nextIndex
      };

      const updatedMessages = [...currentMessagesAccumulator, newQuestionMsg];
      setMessages(updatedMessages);
      setIsTyping(false);

      // SAVE progress
      saveProgress(nextIndex, currentScores, updatedMessages, true, currentAnswers);
    } else {
      setTestCompleted(true);
      await delay(500);
      await saveResults(currentScores, currentMessagesAccumulator, currentAnswers);
    }
  };

  const STYLE_KEY_BY_OPTION_STYLE: Record<string, keyof Scores> = {
    Direto: 'Assertivo',
    Assertivo: 'Assertivo',
    Expressivo: 'Participativo',
    Participativo: 'Participativo',
    Amavel: 'Integrador',
    Amável: 'Integrador',
    Integrador: 'Integrador',
    Analitico: 'Analitico',
    Analítico: 'Analitico'
  };

  const STYLE_LABELS: Record<keyof Scores, string> = {
    Assertivo: 'Assertivo',
    Participativo: 'Participativo',
    Integrador: 'Integrador',
    Analitico: 'Analítico'
  };

  const STYLE_DESCRIPTIONS: Record<keyof Scores, { descricao: string; forcas: string[]; desenvolvimento: string[]; recomendacoes: string[] }> = {
    Assertivo: {
      descricao: 'Perfil orientado a decisão, velocidade, execução e foco objetivo em resultados.',
      forcas: ['Direcionamento claro para metas', 'Agilidade para resolver problemas', 'Energia de execução e tomada de decisão'],
      desenvolvimento: ['Equilibrar velocidade com escuta ativa', 'Dar mais espaço para contribuições do grupo', 'Comunicar decisões com contexto suficiente'],
      recomendacoes: ['Antes de decidir, valide impactos humanos e operacionais.', 'Use checkpoints curtos para alinhar pessoas sem perder ritmo.', 'Convide perspectivas diferentes para qualificar decisões rápidas.']
    },
    Participativo: {
      descricao: 'Perfil comunicativo, entusiasmado, criativo e mobilizador de conexões.',
      forcas: ['Facilidade para engajar pessoas', 'Criatividade para propor alternativas', 'Otimismo e comunicação envolvente'],
      desenvolvimento: ['Sustentar foco até a conclusão', 'Organizar prioridades em etapas claras', 'Transformar ideias em compromissos acompanháveis'],
      recomendacoes: ['Registre próximos passos logo após boas ideias.', 'Defina critérios objetivos para priorizar iniciativas.', 'Combine entusiasmo com cadência de execução.']
    },
    Integrador: {
      descricao: 'Perfil cooperativo, acolhedor, estável e atento à harmonia dos relacionamentos.',
      forcas: ['Construção de confiança', 'Escuta cuidadosa e empatia', 'Atenção ao clima e à colaboração'],
      desenvolvimento: ['Exercitar posicionamento assertivo', 'Lidar com conflitos de forma mais direta', 'Evitar assumir responsabilidades que pertencem a outros'],
      recomendacoes: ['Explicite limites e expectativas com antecedência.', 'Trate divergências cedo, com objetividade e respeito.', 'Use sua escuta para mediar decisões sem adiar conclusões.']
    },
    Analitico: {
      descricao: 'Perfil analítico, criterioso, organizado e orientado por qualidade, dados e consistência.',
      forcas: ['Rigor na análise de informações', 'Organização e atenção a detalhes', 'Busca por precisão e qualidade'],
      desenvolvimento: ['Evitar excesso de análise antes da ação', 'Aumentar flexibilidade diante de mudanças', 'Comunicar sínteses de forma mais simples'],
      recomendacoes: ['Defina o nível de informação suficiente para decidir.', 'Teste hipóteses em ciclos curtos.', 'Traduza análises em recomendações práticas e objetivas.']
    }
  };

  const getSortedStyleEntries = (scoreMap: Scores) =>
    (Object.keys(scoreMap) as Array<keyof Scores>)
      .map(style => ({ style, label: STYLE_LABELS[style], score: scoreMap[style] || 0 }))
      .sort((a, b) => b.score - a.score);

  const calculateScoresFromAnswers = (currentAnswers: Record<string, string | string[]>): Scores => {
    const calculated: Scores = { Assertivo: 0, Participativo: 0, Integrador: 0, Analitico: 0 };

    questions.forEach(question => {
      const rawAnswer = currentAnswers[question.id.toString()];
      const selectedAnswers = Array.isArray(rawAnswer) ? rawAnswer : (rawAnswer ? [rawAnswer] : []);

      selectedAnswers.forEach(answerText => {
        const option = question.options.find(opt => opt.text === answerText) as any;
        const styleKey = STYLE_KEY_BY_OPTION_STYLE[String(option?.style || '')];
        const points = Number(option?.points ?? 1) || 0;

        if (styleKey) {
          calculated[styleKey] += points;
        }
      });
    });

    return calculated;
  };

  const buildAnswerMemory = (currentAnswers: Record<string, string | string[]>) => {
    return questions.flatMap(question => {
      const rawAnswer = currentAnswers[question.id.toString()];
      const selectedAnswers = Array.isArray(rawAnswer) ? rawAnswer : (rawAnswer ? [rawAnswer] : []);

      return selectedAnswers.map(answerText => {
        const option = question.options.find(opt => opt.text === answerText) as any;
        const styleKey = STYLE_KEY_BY_OPTION_STYLE[String(option?.style || '')];
        const points = Number(option?.points ?? 1) || 0;

        return {
          questionId: question.id,
          question: question.text,
          answer: answerText,
          socioStyle: styleKey ? STYLE_LABELS[styleKey] : 'Não identificado',
          points
        };
      });
    });
  };

  const buildLocalReportPayload = (
    basePayload: any,
    currentAnswers: Record<string, string | string[]>,
    calculatedScores: Scores
  ) => {
    const sorted = getSortedStyleEntries(calculatedScores);
    const totalPoints = sorted.reduce((sum, item) => sum + item.score, 0);
    const dominant = sorted[0];
    const secondary = sorted[1];
    const third = sorted[2];
    const lowest = sorted[3];
    const dominantKey = dominant?.style || 'Assertivo';
    const dominantProfile = dominant?.label || 'Assertivo';
    const secondaryProfile = secondary?.label || '';
    const dominantInfo = STYLE_DESCRIPTIONS[dominantKey];
    const answerMemory = buildAnswerMemory(currentAnswers);
    const generatedAt = new Date().toISOString();

    const ranking = sorted.map(item => ({
      estilo: item.label,
      style: item.label,
      pontuacao: item.score,
      score: item.score,
      percentual: totalPoints > 0 ? Math.round((item.score / totalPoints) * 100) : 0
    }));

    const summary = `${usuario.nome} apresenta predominância do perfil ${dominantProfile}${secondaryProfile ? `, com apoio do perfil ${secondaryProfile}` : ''}. O resultado foi calculado a partir das respostas do questionário SocioEstilo, considerando a pontuação associada a cada alternativa selecionada. O perfil indica ${dominantInfo.descricao.toLowerCase()} O relatório deve ser lido como um mapa de tendências comportamentais para apoiar autoconhecimento, comunicação e desenvolvimento profissional.`;

    return {
      success: true,
      metadata: {
        ...basePayload.metadata,
        generatedAt,
        processingMode: 'rules'
      },
      assessment: {
        scores: calculatedScores,
        ranking,
        totalPoints,
        dominantProfile,
        secondaryProfile,
        thirdProfile: third?.label || '',
        lowestProfile: lowest?.label || ''
      },
      report_data: {
        identificacao: {
          nome: usuario.nome,
          empresa: usuario.empresa_nome,
          user_id: usuario.uid,
          empresa_id: usuario.empresa_id,
          data_conclusao: generatedAt,
          generated_at: generatedAt
        },
        resultado: {
          scores: calculatedScores,
          total_pontos: totalPoints,
          perfil_dominante: dominantProfile,
          perfil_secundario: secondaryProfile,
          perfil_terciario: third?.label || '',
          perfil_menos_utilizado: lowest?.label || '',
          ranking_estilos: ranking
        },
        narrativa: {
          parecer_executivo: summary,
          oportunidades: dominantInfo.recomendacoes,
          desafios: dominantInfo.desenvolvimento,
          conselho_alta_performance: dominantInfo.recomendacoes.join(' ')
        },
        parecer_executivo: summary,
        oportunidades_alavancas: dominantInfo.recomendacoes,
        pontos_criticos_desafios: dominantInfo.desenvolvimento,
        conselho_alta_performance: dominantInfo.recomendacoes.join(' '),
        analise_comportamental: {
          estilo_identificado: dominantProfile,
          descricao: dominantInfo.descricao,
          pontos_fortes_talentos: dominantInfo.forcas,
          pontos_desenvolvimento: dominantInfo.desenvolvimento
        },
        metodologia_potenciar_ativada: 'A metodologia SocioEstilo Potenciar foi aplicada por regra de pontuação linear, somando os pontos associados às alternativas selecionadas no questionário.',
        sobre_metodologia: {
          assertivo: STYLE_DESCRIPTIONS.Assertivo.descricao,
          participativo: STYLE_DESCRIPTIONS.Participativo.descricao,
          integrador: STYLE_DESCRIPTIONS.Integrador.descricao,
          analitico: STYLE_DESCRIPTIONS.Analitico.descricao,
          texto_final: 'Os quatro estilos representam tendências comportamentais complementares e devem ser interpretados de forma integrada.'
        },
        evidencias_observadas: answerMemory.slice(0, 8).map(item => `${item.question} Resposta: ${item.answer}`),
        potencial_desenvolvimento: dominantInfo.desenvolvimento,
        recomendacoes_praticas: dominantInfo.recomendacoes,
        memoria_respostas: answerMemory,
        memoria_calculo: {
          regra: 'Soma linear dos pontos associados às alternativas escolhidas.',
          total_pontos: totalPoints,
          ranking
        },
        auditoria: {
          workflow_version: 'local-rules-v1',
          prompt_version: 'nao_aplicavel',
          modelo_llm: 'nao_aplicavel',
          fontes_consultadas: ['Questionário SocioEstilo', 'Gabarito de pontuação local'],
          divergencias_scores: false,
          erro_parse_ia: 'nao_aplicavel'
        }
      },
      respostasQuestionario: currentAnswers,
      questionnaire: basePayload.questionnaire
    };
  };

  const saveResults = async (_finalScores: Scores, finalMessagesList: ChatMessage[], currentAnswers: Record<string, string | string[]>) => {
    setIsTyping(true);

    const analysisMsg: ChatMessage = {
      id: 'finishing-loader-1',
      sender: 'bot',
      text: 'Excelente! Concluímos as perguntas. Calculando seu perfil SocioEstilo pelas regras da metodologia...'
    };

    let updatedMessages = [...finalMessagesList, analysisMsg];
    setMessages(updatedMessages);

    await delay(1200);

    const calculatedScores = calculateScoresFromAnswers(currentAnswers);
    setScores(calculatedScores);

    const formattedAnswers = questions
      .map(q => {
        const rawAns = currentAnswers[q.id.toString()];
        const selectedList: string[] = Array.isArray(rawAns)
          ? rawAns
          : (rawAns ? [rawAns] : []);

        const selectedAnswers = selectedList.map(ansText => {
          const optionIndex = q.options.findIndex(opt => opt.text === ansText);
          const answerOrder = optionIndex !== -1 ? (optionIndex + 1) : 1;
          return {
            answerOrder,
            answer: ansText
          };
        });

        return {
          questionId: q.id,
          question: q.text,
          selectedAnswers
        };
      });

    const payload = {
      metadata: {
        userId: usuario.uid,
        userName: usuario.nome,
        companyId: isNaN(Number(usuario.empresa_id)) ? usuario.empresa_id : Number(usuario.empresa_id),
        companyName: usuario.empresa_nome,
        completedAt: new Date().toISOString(),
        version: 'local-rules-v1'
      },
      questionnaire: {
        answers: formattedAnswers
      }
    };

    const reportPayload = buildLocalReportPayload(payload, currentAnswers, calculatedScores);
    const dominantStyle = reportPayload.report_data.resultado.perfil_dominante || '';
    const localNormalized = {
      summary: reportPayload.report_data.narrativa.parecer_executivo,
      assessment: reportPayload.assessment
    };

    setNormalizedResponse(localNormalized);
    setReportSummary(localNormalized.summary);

    try {
      await criarResultado(
        usuario.uid,
        usuario.empresa_id,
        reportPayload,
        currentAnswers,
        usuario.nome,
        usuario.empresa_nome
      );
    } catch (dbErr) {
      console.log('[OFFLINE RESILIENCE] Cloud write pending:', dbErr);
    }

    try {
      if (dominantStyle) {
        await atualizarUsuario(
          usuario.uid,
          usuario.email,
          usuario.nome,
          usuario.empresa_id,
          usuario.role || 'user',
          dominantStyle
        );
      }
    } catch (dbErr) {
      console.log('[OFFLINE RESILIENCE] Perfil do usuário atualizado localmente para:', dominantStyle, dbErr);
    }

    try {
      await persistDraft(questions.length, currentAnswers, 'CONCLUIDO');
      localStorage.removeItem(`potenciar_progress_${usuario.uid}`);

      const resultPayload = {
        id_usuario: usuario.uid,
        nome_usuario: usuario.nome,
        empresa_id: usuario.empresa_id,
        empresa_nome: usuario.empresa_nome,
        scores: calculatedScores,
        perfil_dominante: dominantStyle,
        data_conclusao: new Date().toISOString(),
        ai_insights: reportPayload,
        raw_payload: reportPayload,
        answers: currentAnswers
      };

      localStorage.setItem(`potenciar_result_${usuario.uid}`, JSON.stringify(resultPayload));

      setIsTyping(false);
      setSavedResultPayload(resultPayload);
      setShowSuccessModal(true);

      const finishMsg: ChatMessage = {
        id: 'finish-announcement',
        sender: 'bot',
        text: 'Relatório estruturado com sucesso! Seu resultado está pronto para visualização.'
      };
      setMessages(prev => [...prev, finishMsg]);
    } catch (err) {
      console.error('Erro limpando e redirecionando', err);
    }
  };
  const progressPercent = questions.length > 0 ? Math.round((currentQuestionIndex / questions.length) * 100) : 0;
  const activeQ = questions[currentQuestionIndex];
  const activeMaxChoices = activeQ?.maxChoices || 5;

  if (draftLoading || questionMappingLoading) {
    return (
      <div className="flex flex-col h-[420px] max-w-4xl w-full mx-auto bg-white rounded-2xl shadow-lg border border-gray-100 items-center justify-center space-y-3">
        <Bot className="w-8 h-8 text-[#112363] animate-pulse" />
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Verificando questionário em andamento...</p>
      </div>
    );
  }

  if (showDraftRecovery && remoteDraft) {
    const draftAnswers = remoteDraft.respostas || {};
    const answeredQuestions = questions.filter(question => draftAnswers[question.id.toString()]);

    return (
      <div className="max-w-4xl w-full mx-auto bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 bg-slate-50">
          <h3 className="text-lg font-black text-[#112363]">Questionário iniciado encontrado</h3>
          <p className="text-xs text-gray-500 mt-1">
            Encontramos respostas salvas automaticamente. Você pode continuar de onde parou ou começar novamente.
          </p>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[360px] overflow-y-auto pr-1">
            {answeredQuestions.map(question => {
              const value = draftAnswers[question.id.toString()];
              return (
                <div key={question.id} className="p-3 rounded-xl border border-gray-150 bg-gray-50/50 text-xs space-y-1">
                  <strong className="text-[#112363] block">Questão {question.id}</strong>
                  <p className="text-gray-500 line-clamp-2">{question.text}</p>
                  <p className="text-gray-800 font-semibold">
                    {Array.isArray(value) ? value.join(', ') : String(value)}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={handleContinueDraft}
              className="flex-1 bg-[#112363] text-white text-xs font-black py-3.5 px-5 rounded-xl hover:bg-[#112363]/90 transition-all"
            >
              Continuar de onde parei
            </button>
            <button
              onClick={handleStartOverDraft}
              className="flex-1 bg-white border border-gray-200 text-[#D80E2A] text-xs font-black py-3.5 px-5 rounded-xl hover:bg-red-50 transition-all"
            >
              Começar novamente
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[740px] max-h-[85vh] min-h-[580px] max-w-4xl w-full mx-auto bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden" id="questionnaire-container">
      
      {/* Dynamic Progress indicator */}
      <div className="bg-gray-50 border-b border-gray-100 p-4 shrink-0 flex items-center justify-between" id="chat-progress">
        <div>
          <h3 className="text-xs font-bold text-[#112363]/80 uppercase tracking-wider">
            Sua Conexão Comportamental
          </h3>
          <p className="text-xxs text-gray-400 mt-0.5" id="progress-text">
            Questionário SocioEstilo &bull; {testCompleted ? 'Finalizando' : !started ? 'Apresentação' : `Questão ${currentQuestionIndex + 1} de ${questions.length}`}
          </p>
        </div>
        <div className="flex items-center space-x-3.5">
          {started && !testCompleted && autosaveStatus !== 'idle' && (
            <span className={`hidden sm:inline-flex text-[10px] font-extrabold px-2.5 py-1 rounded-full border ${
              autosaveStatus === 'saving'
                ? 'bg-amber-50 text-amber-700 border-amber-100'
                : autosaveStatus === 'error'
                ? 'bg-red-50 text-[#D80E2A] border-red-100'
                : 'bg-emerald-50 text-emerald-700 border-emerald-100'
            }`}>
              {autosaveStatus === 'saving' ? 'Salvando...' : autosaveStatus === 'error' ? 'Erro ao salvar. Tentando novamente.' : 'Salvo automaticamente'}
            </span>
          )}

          {started && !testCompleted && (
            <div className="flex items-center space-x-2 w-32 sm:w-40">
              <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden">
                <div 
                  className="bg-[#D80E2A] h-1.5 rounded-full transition-all duration-500 ease-out" 
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className="text-xxs font-bold text-[#112363] shrink-0">
                {progressPercent}%
              </span>
            </div>
          )}

          {onGoBack && (
            <button
              onClick={onGoBack}
              title="Voltar ao Painel Principal"
              className="flex items-center justify-center p-2 rounded-xl text-[#112363]/60 hover:text-[#112363] hover:bg-white border border-transparent hover:border-gray-200 active:scale-95 transition-all cursor-pointer"
              id="btn-chat-home-nav"
            >
              <Home className="w-4.5 h-4.5" />
            </button>
          )}
        </div>
      </div>

      {/* Message feed stream with inline selections */}
      <div ref={messageFeedRef} className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50/50" id="message-feed">
        {messages.map((message, index) => {
          const isBot = message.sender === 'bot';
          
          // Conditions for showing active options right below current question element
          const isCurrentActiveQuestion = 
            isBot && 
            message.isQuestion && 
            message.questionIndex === currentQuestionIndex && 
            !testCompleted && 
            !isTyping;

          const isPromptProceed = 
            isBot && 
            message.id === 'prompt-proceed' && 
            !started && 
            !isTyping;

          const isFinalDevolutionMessage = 
            isBot && 
            message.id === 'msg-expert-devolution' && 
            savedResultPayload !== null && 
            !isTyping;

          return (
            <div
              key={`${message.id}-${index}`}
              id={isCurrentActiveQuestion ? "active-question-container" : undefined}
              className={`flex flex-col space-y-3 max-w-[90%] scroll-mt-6 ${isBot ? 'mr-auto items-start' : 'ml-auto items-end'}`}
            >
              {/* Main bubble row */}
              <div className={`flex items-start space-x-3.5 ${isBot ? '' : 'flex-row-reverse space-x-reverse'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isBot ? 'bg-[#112363] text-white' : 'bg-[#D80E2A] text-white'}`}>
                  {isBot ? (
                    <Bot className="w-4.5 h-4.5 text-white" />
                  ) : (
                    <User className="w-4 h-4" />
                  )}
                </div>
                <div
                  className={`p-4 rounded-2xl shadow-2xs leading-relaxed text-sm ${
                    isBot
                      ? 'bg-white border border-gray-100 text-gray-800 rounded-tl-none'
                      : 'bg-[#112363] text-white rounded-tr-none'
                  }`}
                >
                  {message.text}
                </div>
              </div>

              {/* Inline Interativity Area for Final Success / Dashboard Forward */}
              {isFinalDevolutionMessage && (
                <div className="w-full pl-11 animate-fade-in mt-2" id="chat-inline-finished-wrapper">
                  <div className="bg-white border border-red-200 rounded-2xl p-6 shadow-md max-w-xl w-full space-y-4">
                    <div className="flex items-start space-x-3 text-red-800">
                      <div className="p-1.5 bg-red-50 text-[#D80E2A] rounded-lg shrink-0 mt-0.5">
                        <Bot className="w-5 h-5 text-[#D80E2A]" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="font-bold text-sm text-[#112363]">Seu Diagnóstico de Socioestilo está pronto!</h4>
                        <p className="text-xs text-gray-500 leading-relaxed">
                          A análise do seu perfil comportamental foi concluída de acordo com as regras da metodologia <strong>Socioestilo Potenciar</strong>. Seu resultado já está disponível para consulta.
                        </p>
                        <p className="text-xs text-gray-400 font-medium">
                          &bull; Uma devolutiva detalhada com um especialista executivo será enviada em breve para consolidar seu plano corporativo.
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => onFinish(savedResultPayload!)}
                      className="w-full flex items-center justify-center space-x-2 bg-[#112363] hover:bg-[#112363]/90 text-white font-extrabold py-4 px-6 rounded-xl text-xs transition-all active:scale-[0.98] cursor-pointer shadow-md shadow-blue-900/10"
                      id="btn-nav-dashboard"
                    >
                      <span>Visualizar Meu Relatório & insights Completos</span>
                      <ChevronRight className="w-4.5 h-4.5 stroke-[2.5px]" />
                    </button>
                  </div>
                </div>
              )}

              {/* Inline Interativity Area for Acceptance Prompt */}
              {isPromptProceed && (
                <div className="w-full pl-11 animate-fade-in mt-2" id="chat-inline-proceed-wrapper">
                  <div className="bg-white border border-gray-150 rounded-2xl p-5 shadow-sm max-w-sm">
                    <button
                      onClick={handleAcceptProceed}
                      className="w-full flex items-center justify-center space-x-2 bg-[#112363] hover:bg-[#112363]/90 text-white font-bold py-3.5 px-6 rounded-xl text-xs transition-all active:scale-[0.98] cursor-pointer"
                      id="btn-proceed-start"
                    >
                      <span>Sim, vamos começar!</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Inline Interativity Area for Active Question */}
              {isCurrentActiveQuestion && activeQ && (
                <div className="w-full pl-11 animate-fade-in mt-2" id="chat-inline-options-wrapper">
                  <div className="bg-white border border-gray-150 rounded-2xl p-5 shadow-sm max-w-2xl w-full">
                    
                    {/* Multi Mode Selection (Question 1) */}
                    {activeQ.mode === 'multi' ? (
                      <div className="space-y-4">
                        <p className="text-xxs font-bold text-gray-400 uppercase tracking-widest">
                          Selecione exatamente {activeMaxChoices} características:
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" id="multi-choice-grid">
                          {activeQ.options.map((opt) => {
                            const isChecked = selectedMultiOptions.includes(opt.text);
                            const isLimit = selectedMultiOptions.length >= activeMaxChoices && !isChecked;

                            return (
                              <button
                                key={opt.text}
                                disabled={isLimit}
                                onClick={() => handleToggleMultiOption(opt.text)}
                                className={`flex items-center justify-between p-3 rounded-xl border text-left text-xs font-medium transition-all cursor-pointer ${
                                  isChecked
                                    ? 'border-[#112363] bg-[#112363]/5 text-[#112363]'
                                    : isLimit
                                    ? 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed'
                                    : 'border-gray-200 bg-white hover:border-gray-300 text-gray-700 hover:bg-gray-50'
                                }`}
                              >
                                <span>{opt.text}</span>
                                <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all ${
                                  isChecked ? 'bg-[#112363] border-[#112363] text-white' : 'border-gray-300 bg-white'
                                }`}>
                                  {isChecked && <Check className="w-3.5 h-3.5 stroke-[3px]" />}
                                </div>
                              </button>
                            );
                          })}
                        </div>

                        <div className="flex items-center justify-between border-t border-gray-100 pt-3">
                          <span className="text-xs text-gray-500 font-semibold">
                            {selectedMultiOptions.length} de {activeMaxChoices} selecionadas
                          </span>
                          <button
                            onClick={handleConfirmMultiOptions}
                            disabled={selectedMultiOptions.length !== activeMaxChoices}
                            className="bg-[#112363] hover:bg-[#112363]/90 text-white font-bold py-2.5 px-5 rounded-xl text-xs flex items-center space-x-1.5 transition-all active:scale-98 disabled:opacity-40 cursor-pointer"
                            id="btn-confirm-qualities"
                          >
                            <span>Confirmar Escolhas</span>
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Single Mode Selection (Question 2-5) */
                      <div className="space-y-3">
                        <p className="text-xxs font-bold text-gray-400 uppercase tracking-widest mb-1">
                          Escolha a alternativa mais representativa:
                        </p>
                        <div className="flex flex-col space-y-2" id="single-choice-panel">
                          {activeQ.options.map((opt) => (
                            <button
                              key={opt.text}
                              onClick={() => handleSelectSingleOption(opt.text)}
                              className="w-full text-left p-3.5 rounded-xl border border-gray-250 hover:border-[#112363] hover:bg-[#112363]/5 text-xs text-gray-700 hover:text-[#112363] font-medium transition-all duration-150 active:scale-[0.99] cursor-pointer"
                            >
                              {opt.text}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Dynamic simulation of Bot Typing */}
        {isTyping && (
          <div className="flex items-center space-x-3 max-w-[80%] mr-auto" id="typing-indicator">
            <div className="w-8 h-8 rounded-full bg-[#112363] text-white flex items-center justify-center shrink-0">
              <Bot className="w-4.5 h-4.5 text-white" />
            </div>
            <div className="bg-white border border-gray-100 p-4 rounded-2xl rounded-tl-none shadow-2xs">
              <div className="flex space-x-1.5 py-1">
                <div className="w-2.5 h-2.5 bg-[#112363]/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2.5 h-2.5 bg-[#112363]/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2.5 h-2.5 bg-[#112363]/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Success Modal - Relatório de Socioestilo Gerado */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-8 space-y-6 animate-fade-in max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-[#112363]">Relatório de Socioestilo Gerado com Sucesso</h2>
                  <p className="text-sm text-gray-500 mt-1">Sua análise comportamental está completa</p>
                </div>
              </div>
              <button
                onClick={() => setShowSuccessModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Summary Content */}
            <div className="space-y-4 bg-blue-50 border border-blue-200 rounded-2xl p-6">
              <h3 className="font-bold text-[#112363] text-sm uppercase tracking-wider">Parecer Executivo</h3>
              <p className="text-gray-700 text-sm leading-relaxed line-clamp-6">
                {reportSummary}
              </p>
            </div>

            {/* Metadata Info */}
            {normalizedResponse && (
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-gray-500 font-semibold uppercase tracking-wider mb-1">Perfil Dominante</p>
                  <p className="text-[#D80E2A] font-black text-base">
                    {normalizedResponse.assessment?.dominantProfile || 'Não identificado'}
                  </p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-gray-500 font-semibold uppercase tracking-wider mb-1">Total de Pontos</p>
                  <p className="text-[#112363] font-black text-base">
                    {normalizedResponse.assessment?.totalPoints || 0} pts
                  </p>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <button
                onClick={() => {
                  setShowSuccessModal(false);
                  if (savedResultPayload) {
                    onFinish(savedResultPayload);
                  }
                }}
                className="flex-1 bg-[#D80E2A] hover:bg-[#D80E2A]/90 text-white font-bold py-4 px-6 rounded-xl text-sm transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
              >
                <span>Acessar Relatório Completo</span>
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => setShowSuccessModal(false)}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-4 px-6 rounded-xl text-sm transition-all active:scale-[0.98] cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
