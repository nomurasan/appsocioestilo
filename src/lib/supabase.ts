import { createClient } from '@supabase/supabase-js';
import { Usuario, Resultado, Empresa, Scores, AnswerDetail } from '../types';
import { QUESTIONS } from '../data/questions';

const env = (import.meta as any).env || {};

const SUPABASE_URL = env.VITE_SUPABASE_URL || 'https://czxxuznpcbluiqgppegzj.supabase.co';
const SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_nMDXUT9SGCS1qdlebnz3Wg_yuQOUDYz';

if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY) {
  console.warn(
    "[SUPABASE-CONFIG] AVISO: VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY não foram fornecidos nas variáveis de ambiente. Usando fallbacks locais padrão."
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Deterministically map a Firebase UID (28-char alphanumeric) to a valid standard UUID
export function mapFirebaseUidToUuid(uid: string): string {
  if (!uid) return uid;
  // If it already looks like a UUID, return it
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(uid)) {
    return uid;
  }

  // Generate deterministic 32-char hex string based on input uid
  let h1 = 0xdeadbeef;
  let h2 = 0x41c64e6d;
  let h3 = 0x9e3779b9;
  let h4 = 0x7b5d19a2;

  for (let i = 0; i < uid.length; i++) {
    const ch = uid.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
    h3 = Math.imul(h3 ^ ch, 3242174889);
    h4 = Math.imul(h4 ^ ch, 4294967291);
  }

  const toHex = (n: number) => {
    return (n >>> 0).toString(16).padStart(8, '0');
  };

  const hex = (toHex(h1) + toHex(h2) + toHex(h3) + toHex(h4)).toLowerCase();

  // Format as 8-4-4-4-12 RFC 4122 v4-ish UUID
  const part1 = hex.slice(0, 8);
  const part2 = hex.slice(8, 12);
  const part3 = '4' + hex.slice(13, 16); // force version 4
  const part4 = ((parseInt(hex.slice(16, 17), 16) & 0x3) | 0x8).toString(16) + hex.slice(17, 20); // force variant RFC 4122
  const part5 = hex.slice(20, 32);

  return `${part1}-${part2}-${part3}-${part4}-${part5}`;
}

// Deterministically map a numeric or string company ID to a valid UUID format to satisfy column constraints
export function mapCompanyIdToUuid(id: any): string | null {
  if (id === undefined || id === null || id === '') return null;
  const strId = String(id).trim();

  // If already a valid UUID, return it
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(strId)) {
    return strId;
  }

  const parsedInt = parseInt(strId, 10);
  if (!isNaN(parsedInt)) {
    // Return a valid deterministic UUID for numeric IDs
    return `00000000-0000-4000-8000-${String(parsedInt).padStart(12, '0')}`;
  }

  // If it's a non-numeric string (like a company name), let's deterministically hash it to a UUID
  let h1 = 0xdeadbeef;
  let h2 = 0x41c64e6d;
  for (let i = 0; i < strId.length; i++) {
    const ch = strId.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  const toHex = (n: number) => (n >>> 0).toString(16).padStart(8, '0');
  const hex = (toHex(h1) + toHex(h2) + toHex(h2) + toHex(h1)).toLowerCase();
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

// Convert a deterministic company UUID back to its original short numeric ID pattern
export function mapUuidToCompanyId(uuidStr: any): string {
  if (!uuidStr) return '';
  const str = String(uuidStr);
  if (str.startsWith('00000000-0000-4000-8000-')) {
    const numPart = str.replace('00000000-0000-4000-8000-', '');
    const num = parseInt(numPart, 10);
    return isNaN(num) ? str : String(num);
  }
  return str;
}

/**
 * Garante que um usuário autenticado pelo Firebase tenha uma correspondência de login no Supabase Auth.
 * Isso gera uma conta "sister" no Supabase Auth para satisfazer restrições de chaves estrangeiras (ex: resultados_id_usuario_fkey).
 */
export async function syncFirebaseUserWithSupabaseAuth(uid: string, email: string): Promise<string> {
  if (!uid) {
    return '';
  }

  const resolvedEmail = (email && email.trim()) ? email.trim() : `${uid.toLowerCase()}@firebase-stub.com`;

  // Senha determinística e segura com base no UID original do Firebase
  const deterministicPassword = `Supa_Fb_Auth_${uid}_SecurePct1!`;

  try {
    // 1. Tentar fazer login no Supabase Auth com email e senha determinística
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: resolvedEmail,
      password: deterministicPassword,
    });

    if (signInError) {
      console.warn(`[SYNC SUPABASE] Falha no login do usuário do Firebase (${resolvedEmail}) no Supabase Auth com a senha determinística:`, signInError.message);
    } else if (signInData?.user) {
      console.log(`[SYNC SUPABASE] Login efetuado com sucesso para ${resolvedEmail}, ID: ${signInData.user.id}`);
      return signInData.user.id;
    }
  } catch (err) {
    console.warn("[SYNC SUPABASE] Exceção ao efetuar login, tentando cadastrar usuário:", err);
  }

  try {
    // 2. Se falhar por não existir, tentar cadastro no Supabase Auth
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: resolvedEmail,
      password: deterministicPassword,
    });

    if (signUpError) {
      console.warn(`[SYNC SUPABASE] Falha no cadastro do usuário do Firebase (${resolvedEmail}) no Supabase Auth:`, signUpError.message);
    } else if (signUpData?.user) {
      console.log(`[SYNC SUPABASE] Cadastro e login efetuado com sucesso para ${resolvedEmail}, ID: ${signUpData.user.id}`);
      return signUpData.user.id;
    }
  } catch (err) {
    console.error("[SYNC SUPABASE] Falha catastrófica ao sincronizar conta com Supabase Auth:", err);
  }

  // Se tudo falhar, retorna o UID mapeado deterministicamente para integridade de fallback
  const fallbackId = mapFirebaseUidToUuid(uid);
  console.warn(`[SYNC SUPABASE] Todos os métodos de autenticação de sincronização falharam para ${resolvedEmail}. Usando fallback ID: ${fallbackId}. Nota: Se a tabela public.resultados tiver uma chave estrangeira para auth.users(id), a inserção falhará a menos que essa trigger/restrição de banco seja removida ou alterada para referenciar public.usuarios(uid).`);
  return fallbackId;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export function handleSupabaseError(error: any, operationType: OperationType, path: string | null): never {
  const errMsg = error?.message || String(error);
  console.log(`[SUPABASE RESOLVED ERROR - ${operationType}] in [${path}]:`, error);
  throw new Error(`Erro na operação ${operationType} em ${path}: ${errMsg}`);
}// -------------------------------------------------------------
// AUXILIARY PARSERS & MODEL MAPPERS
// -------------------------------------------------------------

export function parseBigIntId(id: any): number | null {
  if (id === undefined || id === null || id === '') return null;
  const unmapped = mapUuidToCompanyId(id);
  const parsed = parseInt(String(unmapped), 10);
  return isNaN(parsed) ? null : parsed;
}

export function parseResultId(id: any): string | number {
  if (id === undefined || id === null || id === '') return '';
  const strId = String(id);
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(strId)) {
    return strId;
  }
  const parsed = parseInt(strId, 10);
  return isNaN(parsed) ? strId : parsed;
}

function mapDbEmpresaToEmpresa(item: any): Empresa | null {
  if (!item) return null;
  return {
    id: String(item.id_empresa || item.id || ''),
    nome: item.nome || '',
    data_criacao: item.data_criacao || item.created_at || ''
  };
}

function mapDbUsuarioToUsuario(item: any, fallbackUid?: string): Usuario | null {
  if (!item) return null;
  const emailVal = item.email || '';
  const resolvedRole = emailVal === 'nomura.eduardo@gmail.com' ? 'admin' : (item.role || 'user');
  return {
    uid: item.uid || item.id || fallbackUid || '',
    email: emailVal,
    nome: item.nome || '',
    empresa_id: String(item.id_empresa === 0 || item.id_empresa ? item.id_empresa : (item.empresa_id || '')),
    empresa_nome: item.empresa_nome || '',
    role: resolvedRole
  };
}

const styleMappings: Record<string, string> = {
  Direto: "Assertivo",
  Expressivo: "Participativo",
  Amavel: "Integrador",
  Analitico: "Analítico"
};

function computeResultProfilesAndScores(scores: Scores) {
  const sortedStyles = Object.entries(scores || {})
    .map(([key, value]) => ({
      key,
      name: styleMappings[key] || key,
      score: Number(value) || 0
    }))
    .sort((a, b) => b.score - a.score);

  const ranking = sortedStyles.map(item => ({
    style: item.name,
    score: item.score
  }));

  const scoresAny = scores as any;
  const pontuacoes_comportamentais = {
    "Assertivo": scores?.Assertivo ?? scoresAny?.Direto ?? 0,
    "Participativo": scores?.Participativo ?? scoresAny?.Expressivo ?? 0,
    "Integrador": scores?.Integrador ?? scoresAny?.Amavel ?? 0,
    "Analítico": scores?.Analitico ?? 0
  };

  return {
    ranking,
    perfil_dominante: sortedStyles[0]?.name || null,
    perfil_secundario: sortedStyles[1]?.name || null,
    perfil_terciario: sortedStyles[2]?.name || null,
    perfil_menos_utilizado: sortedStyles[3]?.name || null,
    pontuacoes_comportamentais
  };
}

function computeDetailedAnswers(answers?: Record<string, string | string[]>) {
  if (!answers) return null;
  const detailed: Array<{ question_id: number; question_text: string; user_answer: any }> = [];
  try {
    Object.entries(answers).forEach(([key, val]) => {
      const qId = Number(key);
      const questionObj = QUESTIONS.find(q => q.id === qId);
      detailed.push({
        question_id: qId,
        question_text: questionObj ? questionObj.text : `Questão ${qId}`,
        user_answer: val
      });
    });
  } catch (err) {
    console.error('Error computing detailed answers:', err);
  }
  return detailed;
}

function mapDbResultadoToResultado(item: any): any {
  if (!item) return null;
  
  let parsedScores = {};
  if (item.scores) {
    try {
      parsedScores = typeof item.scores === 'string' ? JSON.parse(item.scores) : (item.scores || {});
    } catch (e) {
      console.error('Error parsing scores:', e);
    }
  }

  let parsedInsights = undefined;
  if (item.ai_insights) {
    try {
      parsedInsights = typeof item.ai_insights === 'string' ? JSON.parse(item.ai_insights) : item.ai_insights;
    } catch (e) {
      console.error('Error parsing AI insights:', e);
    }
  }

  const safeParseJSON = (val: any) => {
    if (!val) return null;
    if (typeof val === 'string') {
      try {
        return JSON.parse(val);
      } catch (e) {
        console.error('Error parsing custom JSON column:', e);
        return null;
      }
    }
    return val;
  };

  const reconstructedAnswers: Record<string, string | string[]> = {};
  try {
    const q1Options = [item.q1_opcao_1, item.q1_opcao_2, item.q1_opcao_3, item.q1_opcao_4, item.q1_opcao_5].filter(Boolean);
    if (q1Options.length > 0) reconstructedAnswers['1'] = q1Options as string[];

    if (item.q2_resposta) reconstructedAnswers['2'] = String(item.q2_resposta);
    if (item.q3_resposta) reconstructedAnswers['3'] = String(item.q3_resposta);
    if (item.q4_resposta) reconstructedAnswers['4'] = String(item.q4_resposta);

    const q5Options = [item.q5_opcao_1, item.q5_opcao_2, item.q5_opcao_3, item.q5_opcao_4, item.q5_opcao_5].filter(Boolean);
    if (q5Options.length > 0) reconstructedAnswers['5'] = q5Options as string[];

    for (let q = 6; q <= 13; q++) {
      if (item[`q${q}_resposta`] !== undefined && item[`q${q}_resposta`] !== null && item[`q${q}_resposta`] !== "") {
        reconstructedAnswers[String(q)] = String(item[`q${q}_resposta`]);
      }
    }
  } catch (err) {
    console.error("Error reconstructing answers:", err);
  }

  const rawAnswersParsed = safeParseJSON(item.respostas_questionario) || item.answers || {};
  const finalAnswersObj = Object.keys(rawAnswersParsed).length > 0 ? rawAnswersParsed : reconstructedAnswers;

  return {
    id: String(item.id_resultado || item.id || ''),
    id_resultado: String(item.id_resultado || item.id || ''),
    id_usuario: item.id_usuario || item.user_id || item.uid || '',
    nome_usuario: item.user_name || item.nome_usuario || item.usuario_nome || item.nome || 'Usuário Desconhecido',
    empresa_id: String(item.id_empresa === 0 || item.id_empresa ? item.id_empresa : mapUuidToCompanyId(item.empresa_id)),
    empresa_nome: item.company_name || item.empresa_nome || '',
    scores: parsedScores,
    perfil_dominante: item.perfil_dominante || undefined,
    data_conclusao: item.generated_at || item.data_conclusao || item.created_at || '',
    ai_insights: parsedInsights,
    answers: finalAnswersObj,
    
    // Modern extra columns mapped dynamically
    user_name: item.user_name || '',
    company_name: item.company_name || '',
    generated_at: item.generated_at || '',
    ranking: safeParseJSON(item.ranking),
    perfil_secundario: item.perfil_secundario || '',
    perfil_terciario: item.perfil_terciario || '',
    perfil_menos_utilizado: item.perfil_menos_utili || item.perfil_menos_utilizado || '',
    pontuacoes_comportamentais: safeParseJSON(item.pontuacoes_comportamentais),
    respostas_questionario: safeParseJSON(item.respostas_questionario),
    respostas_detalhadas: safeParseJSON(item.respostas_detalhadas),
    relatorio: safeParseJSON(item.relatorio),
    fontes_consultadas: safeParseJSON(item.fontes_consultadas),
    relatorio_pronto_para_app: safeParseJSON(item.relatorio_pronto_para_app),
    raw_payload: safeParseJSON(item.raw_payload)
  };
}

// -------------------------------------------------------------
// EMPRESAS (BUSINESS OR REORGANIZATION)
// -------------------------------------------------------------

/**
 * Criar Empresa
 */
export async function criarEmpresa(nome: string): Promise<Empresa> {
  const { data, error } = await supabase.from('empresas').insert({ nome }).select();
  if (error) {
    handleSupabaseError(error, OperationType.CREATE, `criar_empresa: ${nome}`);
  }
  const raw = data as any;
  const item = Array.isArray(raw) ? raw[0] : raw;
  const mapped = mapDbEmpresaToEmpresa(item);
  if (!mapped) {
    throw new Error(`Falha ao obter os dados mapeados da empresa criada: ${nome}`);
  }
  return mapped;
}

/**
 * Listar Empresas
 */
export async function listarEmpresas(): Promise<Empresa[]> {
  const { data, error } = await supabase.from('empresas').select('*');
  if (error) {
    handleSupabaseError(error, OperationType.LIST, 'listar_empresas');
  }
  const rawArray = Array.isArray(data) ? data : (data ? [data] : []);
  return rawArray.map(mapDbEmpresaToEmpresa).filter(Boolean) as Empresa[];
}

/**
 * Buscar Empresa
 */
export async function buscarEmpresa(idEmpresa: string): Promise<Empresa | null> {
  const parsedId = parseBigIntId(idEmpresa);
  const { data, error } = await supabase.from('empresas').select('*').eq('id_empresa', parsedId).maybeSingle();
  if (error) {
    handleSupabaseError(error, OperationType.GET, `buscar_empresa: ${idEmpresa}`);
  }
  return mapDbEmpresaToEmpresa(data);
}

/**
 * Atualizar Empresa
 */
export async function atualizarEmpresa(idEmpresa: string, nome: string): Promise<boolean> {
  const parsedId = parseBigIntId(idEmpresa);
  const { error } = await supabase.from('empresas').update({ nome }).eq('id_empresa', parsedId);
  if (error) {
    handleSupabaseError(error, OperationType.UPDATE, `atualizar_empresa: ${idEmpresa}`);
  }
  return true;
}

/**
 * Excluir Empresa
 */
export async function excluirEmpresa(idEmpresa: string): Promise<boolean> {
  const parsedId = parseBigIntId(idEmpresa);
  const { error } = await supabase.from('empresas').delete().eq('id_empresa', parsedId);
  if (error) {
    handleSupabaseError(error, OperationType.DELETE, `excluir_empresa: ${idEmpresa}`);
  }
  return true;
}

// -------------------------------------------------------------
// USUÁRIOS (MEMBERS & STAFF)
// -------------------------------------------------------------

/**
 * Criar Usuário
 */
export async function criarUsuario(
  uid: string,
  email: string,
  nome: string,
  idEmpresa: string,
  role: string = 'user',
  perfilDominante?: string | null
): Promise<any> {
  const mappedUid = mapFirebaseUidToUuid(uid);
  const parsedIdEmpresa = parseBigIntId(idEmpresa);
  
  // We strictly insert only existing database columns:
  // uid, email, nome, id_empresa, and the recently added role column.
  // We completely omit 'perfil_dominante' since it should not be in the 'usuarios' table.
  const { data, error } = await supabase.from('usuarios').insert({
    uid: mappedUid,
    email: email,
    nome: nome,
    id_empresa: parsedIdEmpresa,
    role: role
  }).select();

  if (error) {
    handleSupabaseError(error, OperationType.CREATE, `criar_usuario: ${mappedUid}`);
  }
  const raw = data as any;
  const item = Array.isArray(raw) ? raw[0] : raw;
  return mapDbUsuarioToUsuario(item, mappedUid);
}

/**
 * Listar Usuários
 */
export async function listarUsuarios(): Promise<Usuario[]> {
  const { data: usersData, error } = await supabase.from('usuarios').select('*');
  if (error) {
    handleSupabaseError(error, OperationType.LIST, 'listar_usuarios');
  }
  if (!usersData || usersData.length === 0) return [];
  
  // Resiliently fetch companies to correctly map names
  const { data: empsData } = await supabase.from('empresas').select('id_empresa, nome');
  const empMap: Record<string, string> = {};
  if (empsData) {
    empsData.forEach((e: any) => {
      empMap[String(e.id_empresa)] = e.nome || '';
    });
  }

  return usersData.map((item: any) => {
    const u = mapDbUsuarioToUsuario(item);
    if (u) {
      u.empresa_nome = empMap[u.empresa_id] || '';
    }
    return u;
  }).filter(Boolean) as Usuario[];
}

/**
 * Buscar Usuário
 */
export async function buscarUsuario(uid: string): Promise<Usuario | null> {
  const mappedUid = mapFirebaseUidToUuid(uid);
  const { data, error } = await supabase.from('usuarios').select('*').eq('uid', mappedUid).maybeSingle();
  if (error) {
    handleSupabaseError(error, OperationType.GET, `buscar_usuario: ${mappedUid}`);
  }
  if (!data) return null;
  
  const user = mapDbUsuarioToUsuario(data, mappedUid);
  if (user && user.empresa_id) {
    const { data: empData } = await supabase.from('empresas').select('nome').eq('id_empresa', parseBigIntId(user.empresa_id)).maybeSingle();
    if (empData) {
      user.empresa_nome = empData.nome || '';
    }
  }
  return user;
}

/**
 * Atualizar Usuário
 */
export async function atualizarUsuario(
  uid: string,
  email: string,
  nome: string,
  idEmpresa: string,
  role: string,
  perfilDominante?: string | null
): Promise<boolean> {
  const mappedUid = mapFirebaseUidToUuid(uid);
  const parsedIdEmpresa = parseBigIntId(idEmpresa);
  
  const { error } = await supabase.from('usuarios').update({
    email: email,
    nome: nome,
    id_empresa: parsedIdEmpresa,
    role: role
  }).eq('uid', mappedUid);

  if (error) {
    handleSupabaseError(error, OperationType.UPDATE, `atualizar_usuario: ${mappedUid}`);
  }
  return true;
}

/**
 * Excluir Usuário
 */
export async function excluirUsuario(uid: string): Promise<boolean> {
  const mappedUid = mapFirebaseUidToUuid(uid);
  const { error } = await supabase.from('usuarios').delete().eq('uid', mappedUid);
  if (error) {
    handleSupabaseError(error, OperationType.DELETE, `excluir_usuario: ${mappedUid}`);
  }
  return true;
}

// -------------------------------------------------------------
// RESULTADOS (SOCIOESTILO DIAGNOSTIC RESULTS)
// -------------------------------------------------------------

/**
 * Criar Resultado
 */
export async function criarResultado(
  uid: string,
  idEmpresa: string,
  param3: any, // Scores OR aiInsights (n8n payload)
  param4?: any, // perfilDominante OR answers (Record)
  param5?: any, // aiInsights OR userNameOpt (string)
  param6?: any, // answers OR companyNameOpt (string)
  param7?: string, // userNameOpt
  param8?: string, // companyNameOpt
  param9?: AnswerDetail[] // answersDetailed
): Promise<any> {
  const mappedUid = mapFirebaseUidToUuid(uid);
  const parsedIdEmpresa = parseBigIntId(idEmpresa);

  let scores: Scores = { Assertivo: 0, Participativo: 0, Integrador: 0, Analitico: 0 };
  let perfilDominante = '';
  let aiInsights: any = null;
  let answers: Record<string, string | string[]> | undefined = undefined;
  let userName = '';
  let companyName = '';
  let finalAnswersDetailed: AnswerDetail[] | undefined = undefined;

  // Detect which signature overload has been used
  const isPayloadFromN8n = param3 && (param3.report_data || param3.metadata || param3.questionnaire);

  if (isPayloadFromN8n) {
    aiInsights = param3;
    answers = param4;
    userName = typeof param5 === 'string' ? param5 : '';
    companyName = typeof param6 === 'string' ? param6 : '';
    
    const reportData = aiInsights?.report_data || {};
    scores = reportData.resultado?.scores || { Assertivo: 0, Participativo: 0, Integrador: 0, Analitico: 0 };
    perfilDominante = reportData.resultado?.perfil_dominante || '';
  } else {
    scores = param3 || { Assertivo: 0, Participativo: 0, Integrador: 0, Analitico: 0 };
    perfilDominante = param4 || '';
    aiInsights = param5 || null;
    answers = param6;
    userName = param7 || '';
    companyName = param8 || '';
    finalAnswersDetailed = param9;
  }

  if (!userName || !companyName) {
    try {
      const { data: userData } = await supabase.from('usuarios').select('nome, id_empresa').eq('uid', mappedUid).maybeSingle();
      if (userData) {
        if (!userName) userName = userData.nome || '';
        const resolvedEmp = parsedIdEmpresa || userData.id_empresa;
        if (resolvedEmp && !companyName) {
          const { data: empData } = await supabase.from('empresas').select('nome').eq('id_empresa', parseBigIntId(String(resolvedEmp))).maybeSingle();
          if (empData) {
            companyName = empData.nome || '';
          }
        }
      }
    } catch (dbErr) {
      console.warn("Error querying name/company in criarResultado:", dbErr);
    }
  }

  const ext = computeResultProfilesAndScores(scores);
  const detailedAnswers = computeDetailedAnswers(answers);

  // Normalize or construct raw_payload
  let rawPayload = aiInsights || {};
  if (typeof rawPayload === 'string') {
    try {
      rawPayload = JSON.parse(rawPayload);
    } catch {
      rawPayload = {};
    }
  }
  if (typeof rawPayload !== 'object' || rawPayload === null) {
    rawPayload = {};
  }

  // Under the New Architecture, retrieve structured fields if present:
  const metadata = rawPayload.metadata || {};
  const assessment = rawPayload.assessment || {};
  const participantReport = rawPayload.participantReport || {};

  // For backward compatibility block, set legacy nestings:
  if (!rawPayload.contextoQuestionario) {
    rawPayload.contextoQuestionario = {};
  }
  if (!rawPayload.relatorio) {
    rawPayload.relatorio = {};
  }

  const cp = rawPayload.contextoQuestionario;
  if (!cp.userName) cp.userName = metadata.userName || userName || '';
  if (!cp.companyName) cp.companyName = metadata.companyName || companyName || '';
  if (!cp.completedAt) cp.completedAt = metadata.completedAt || new Date().toISOString();
  if (!cp.generatedAt) cp.generatedAt = metadata.generatedAt || new Date().toISOString();
  if (!cp.scores) cp.scores = assessment.scores || scores;
  if (!cp.ranking) cp.ranking = assessment.ranking || ext.ranking;
  if (!cp.perfilPredominante) cp.perfilPredominante = assessment.dominantProfile || ext.perfil_dominante || perfilDominante;
  if (!cp.perfilSecundario) cp.perfilSecundario = assessment.secondaryProfile || ext.perfil_secundario;
  if (!cp.perfilTerciario) cp.perfilTerciario = assessment.thirdProfile || ext.perfil_terciario;
  if (!cp.perfilMenosUtilizado) cp.perfilMenosUtilizado = assessment.lowestProfile || ext.perfil_menos_utilizado;
  if (!cp.respostasDetalhadas) cp.respostasDetalhadas = detailedAnswers;

  const rel = rawPayload.relatorio;
  if (!rel.parecer_executivo) rel.parecer_executivo = participantReport.executiveSummary || aiInsights?.resumo || aiInsights?.parecer_executivo || '';
  if (!rel.oportunidades_alavancas) rel.oportunidades_alavancas = participantReport.opportunities || aiInsights?.oportunidades || aiInsights?.oportunidades_alavancas || [];
  if (!rel.pontos_criticos_desafios) rel.pontos_criticos_desafios = participantReport.developmentPoints || aiInsights?.desafios || aiInsights?.pontos_criticos_desafios || [];
  if (!rel.conselho_alta_performance) rel.conselho_alta_performance = participantReport.highPerformanceAdvice || aiInsights?.insights || aiInsights?.conselho_alta_performance || '';
  
  if (!rel.analise_comportamental) {
    rel.analise_comportamental = {
      estilo_identificado: cp.perfilPredominante,
      descricao: participantReport.profileSummary || '',
      pontos_fortes_talentos: participantReport.strengths || [],
      pontos_desenvolvimento: participantReport.developmentPoints || []
    };
  }

  if (!rel.metodologia_potenciar_ativada) rel.metodologia_potenciar_ativada = aiInsights?.conhecimento_aplicado || '';
  if (!rel.sobre_metodologia) rel.sobre_metodologia = "Metodologia Potenciar de Diagnóstico de Socioestilos.";
  if (!rawPayload.respostasQuestionario) rawPayload.respostasQuestionario = answers || {};
  if (finalAnswersDetailed) {
    if (!rawPayload.questionnaire) rawPayload.questionnaire = {};
    rawPayload.questionnaire.answersDetailed = finalAnswersDetailed;
    rawPayload.answersDetailed = finalAnswersDetailed;
  }

  // Extract individual questionnaire answers to record them in their designated columns if they exist
  const questionAnswersPayload: Record<string, any> = {};
  if (answers) {
    try {
      // Q1 (multi) - up to 5 options
      const q1Ans = answers['1'];
      if (Array.isArray(q1Ans)) {
        for (let i = 0; i < 5; i++) {
          questionAnswersPayload[`q1_opcao_${i + 1}`] = q1Ans[i] || null;
        }
      } else if (typeof q1Ans === 'string') {
        questionAnswersPayload['q1_opcao_1'] = q1Ans;
      }

      // Q2, Q3, Q4 (single)
      if (answers['2']) questionAnswersPayload['q2_resposta'] = String(answers['2']);
      if (answers['3']) questionAnswersPayload['q3_resposta'] = String(answers['3']);
      if (answers['4']) questionAnswersPayload['q4_resposta'] = String(answers['4']);

      // Q5 (multi) - up to 5 options
      const q5Ans = answers['5'];
      if (Array.isArray(q5Ans)) {
        for (let i = 0; i < 5; i++) {
          questionAnswersPayload[`q5_opcao_${i + 1}`] = q5Ans[i] || null;
        }
      } else if (typeof q5Ans === 'string') {
        questionAnswersPayload['q5_opcao_1'] = q5Ans;
      }

      // Q6 to Q13 (single)
      for (let q = 6; q <= 13; q++) {
        if (answers[String(q)]) {
          questionAnswersPayload[`q${q}_resposta`] = String(answers[String(q)]);
        }
      }
    } catch (err) {
      console.warn("Erro ao mapear respostas individuais das questões:", err);
    }
  }

  const rawIdEmpresa = rawPayload.db_record?.id_empresa || rawPayload.db_record?.empresa_id || metadata.companyId || idEmpresa;
  const parsedEmpresaId = parseBigIntId(rawIdEmpresa);

  // Dynamically resolve the active Supabase Auth user id to satisfy rigid Row Level Security policies
  let activeSupaUserId: string | null = null;
  try {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser?.id) {
      activeSupaUserId = authUser.id;
    }
  } catch (err) {
    console.log("[criarResultado] Info: auth user id check:", err);
  }

  const rawInsertPayload: any = {
    user_id: activeSupaUserId || rawPayload.db_record?.user_id || mappedUid,
    id_usuario: rawPayload.db_record?.id_usuario || rawPayload.db_record?.user_id || mappedUid,
    id_empresa: parsedEmpresaId || null,
    empresa_id: parsedEmpresaId || null,
    user_name: rawPayload.db_record?.user_name || metadata.userName || userName || null,
    company_name: rawPayload.db_record?.company_name || metadata.companyName || companyName || null,
    perfil_dominante: rawPayload.db_record?.perfil_dominante || assessment.dominantProfile || cp.perfilPredominante || null,
    perfil_secundario: rawPayload.db_record?.perfil_secundario || assessment.secondaryProfile || cp.perfilSecundario || null,
    perfil_terciario: rawPayload.db_record?.perfil_terciario || assessment.thirdProfile || cp.perfilTerciario || null,
    perfil_menos_utili: rawPayload.db_record?.perfil_menos_utilizado || rawPayload.db_record?.perfil_menos_utili || assessment.lowestProfile || cp.perfilMenosUtilizado || null,
    perfil_menos_utilizado: rawPayload.db_record?.perfil_menos_utilizado || rawPayload.db_record?.perfil_menos_utili || assessment.lowestProfile || cp.perfilMenosUtilizado || null,
    scores: rawPayload.db_record?.scores || assessment.scores || cp.scores || null,
    raw_payload: rawPayload, // Stores full JSON returned by n8n
    ai_insights: rawPayload, // Stores full JSON payload as requested to protect all report sections
    data_conclusao: rawPayload.db_record?.data_conclusao || metadata.completedAt || cp.completedAt || null,
    generated_at: rawPayload.db_record?.generated_at || metadata.generatedAt || cp.generatedAt || null,
    answers: answers || {},
    respostas_questionario: answers || {},
    answers_detailed: finalAnswersDetailed || null,
    respostas_detalhadas: finalAnswersDetailed || null,
    ...questionAnswersPayload
  };

  let attempt = 0;
  let successData: any = null;
  let lastError: any = null;
  const currentPayload = { ...rawInsertPayload };

  while (attempt < 60) {
    console.log(`[criarResultado] Tentando inserção no banco (tentativa ${attempt + 1})...`);
    const { data, error } = await supabase.from('resultados').insert(currentPayload).select();

    if (!error) {
      console.log("[criarResultado] Gravação na tabela resultados efetuada com sucesso!");
      successData = data;
      break;
    }

    lastError = error;
    console.log(`[criarResultado] Integridade na gravação (tentativa ${attempt + 1}):`, error.message, error);

    const offendingColumn = (() => {
      const msg = error.message || '';
      const m1 = msg.match(/column "([^"]+)" of relation "resultados" does not exist/) || 
                 msg.match(/column "([^"]+)" does not exist/);
      if (m1 && m1[1]) return m1[1];
      
      const m2 = msg.match(/Could not find the ['"]([^'"]+)['"] column/i);
      if (m2 && m2[1]) return m2[1];

      const m3 = msg.match(/Could not find the ['"]([^'"]+)['"]/i);
      if (m3 && m3[1]) return m3[1];

      return null;
    })();

    if (offendingColumn) {
      console.log(`[criarResultado] Removendo coluna inexistente do payload e tentando novamente: "${offendingColumn}"`);
      delete currentPayload[offendingColumn];
      attempt++;
    } else {
      break;
    }
  }

  if (lastError && !successData) {
    handleSupabaseError(lastError, OperationType.CREATE, `criar_resultado: ${mappedUid}`);
  }

  const raw = successData as any;
  const item = Array.isArray(raw) ? raw[0] : raw;
  return mapDbResultadoToResultado(item);
}

/**
 * Listar Resultados
 */
export async function listarResultados(): Promise<Resultado[]> {
  const { data: rawData, error } = await supabase.from('resultados').select('*');
  if (error) {
    handleSupabaseError(error, OperationType.LIST, 'listar_resultados');
  }
  if (!rawData || rawData.length === 0) return [];

  // Fetch all users and companies to map names easily and perfectly
  const { data: usersData } = await supabase.from('usuarios').select('uid, nome');
  const { data: empsData } = await supabase.from('empresas').select('id_empresa, nome');

  const userMap: Record<string, string> = {};
  if (usersData) {
    usersData.forEach((u: any) => {
      userMap[String(u.uid)] = u.nome || '';
    });
  }

  const empMap: Record<string, string> = {};
  if (empsData) {
    empsData.forEach((e: any) => {
      empMap[String(e.id_empresa)] = e.nome || '';
    });
  }

  return rawData.map((item: any) => {
    const mapped = mapDbResultadoToResultado(item);
    if (mapped) {
      mapped.nome_usuario = userMap[mapped.id_usuario] || 'Usuário Desconhecido';
      mapped.empresa_nome = empMap[mapped.empresa_id] || '';
    }
    return mapped;
  }).filter(Boolean) as Resultado[];
}

/**
 * Buscar Resultado
 */
export async function buscarResultado(idResultado: string): Promise<Resultado | null> {
  const parsedId = parseResultId(idResultado);
  const { data: rawData, error } = await supabase.from('resultados').select('*').eq('id', parsedId).maybeSingle();
  if (error) {
    handleSupabaseError(error, OperationType.GET, `buscar_resultado: ${idResultado}`);
  }
  if (!rawData) return null;

  const mapped = mapDbResultadoToResultado(rawData);
  if (mapped && mapped.id_usuario) {
    const { data: userData } = await supabase.from('usuarios').select('nome, id_empresa').eq('uid', mapped.id_usuario).maybeSingle();
    if (userData) {
      mapped.nome_usuario = userData.nome || '';
      const resolvedEmp = mapped.empresa_id || userData.id_empresa;
      if (resolvedEmp) {
        const { data: empData } = await supabase.from('empresas').select('nome').eq('id_empresa', parseBigIntId(resolvedEmp)).maybeSingle();
        if (empData) {
          mapped.empresa_nome = empData.nome || '';
        }
      }
    }
  }
  return mapped;
}

/**
 * Listar Resultados do Usuário
 */
export async function listarResultadosUsuario(uid: string): Promise<Resultado[]> {
  const mappedUid = mapFirebaseUidToUuid(uid);
  const { data: rawData, error } = await supabase.from('resultados').select('*').eq('user_id', mappedUid);
  if (error) {
    handleSupabaseError(error, OperationType.LIST, `listar_resultados_usuario: ${mappedUid}`);
  }
  if (!rawData || rawData.length === 0) return [];

  // Fetch user name and company name
  const { data: userData } = await supabase.from('usuarios').select('nome, id_empresa').eq('uid', mappedUid).maybeSingle();
  const userName = userData ? userData.nome : '';
  const empId = userData ? String(userData.id_empresa || '') : '';

  let companyName = '';
  if (empId) {
    const { data: empData } = await supabase.from('empresas').select('nome').eq('id_empresa', parseBigIntId(empId)).maybeSingle();
    if (empData) {
      companyName = empData.nome || '';
    }
  }

  return rawData.map((item: any) => {
    const mapped = mapDbResultadoToResultado(item);
    if (mapped) {
      mapped.nome_usuario = userName || 'Usuário Desconhecido';
      mapped.empresa_nome = companyName || '';
    }
    return mapped;
  }).filter(Boolean) as Resultado[];
}

/**
 * Atualizar Resultado
 */
export async function atualizarResultado(
  idResultado: string,
  scores: Scores,
  perfilDominante: string,
  aiInsights: any
): Promise<boolean> {
  const ext = computeResultProfilesAndScores(scores);

  const rawUpdatePayload: any = {
    scores: scores,
    perfil_dominante: ext.perfil_dominante || perfilDominante,
    ai_insights: aiInsights,

    ranking: ext.ranking,
    perfil_secundario: ext.perfil_secundario,
    perfil_terciario: ext.perfil_terciario,
    perfil_menos_utili: ext.perfil_menos_utilizado,
    perfil_menos_utilizado: ext.perfil_menos_utilizado,
    pontuacoes_comportamentais: ext.pontuacoes_comportamentais,
    relatorio: aiInsights || null,
    relatorio_pronto_para_app: aiInsights?.relatorio_pronto_para_app || aiInsights || null,
    raw_payload: aiInsights?.raw_payload || aiInsights || null
  };

  let attempt = 0;
  let success = false;
  let lastError: any = null;
  const currentPayload = { ...rawUpdatePayload };

  while (attempt < 60) {
    console.log(`[atualizarResultado] Tentando atualização no banco (tentativa ${attempt + 1})...`);
    const { error } = await supabase
      .from('resultados')
      .update(currentPayload)
      .eq('id', parseResultId(idResultado));

    if (!error) {
      console.log("[atualizarResultado] Atualização na tabela resultados efetuada com sucesso!");
      success = true;
      break;
    }

    lastError = error;
    console.warn(`[atualizarResultado] Erro na atualização (tentativa ${attempt + 1}):`, error.message, error);

    const offendingColumn = (() => {
      const msg = error.message || '';
      const m1 = msg.match(/column "([^"]+)" of relation "resultados" does not exist/) || 
                 msg.match(/column "([^"]+)" does not exist/);
      if (m1 && m1[1]) return m1[1];
      
      const m2 = msg.match(/Could not find the ['"]([^'"]+)['"] column/i);
      if (m2 && m2[1]) return m2[1];

      const m3 = msg.match(/Could not find the ['"]([^'"]+)['"]/i);
      if (m3 && m3[1]) return m3[1];

      return null;
    })();

    if (offendingColumn) {
      console.log(`[atualizarResultado] Removendo coluna inexistente do payload e tentando novamente: "${offendingColumn}"`);
      delete currentPayload[offendingColumn];
      attempt++;
    } else {
      break;
    }
  }

  if (lastError && !success) {
    handleSupabaseError(lastError, OperationType.UPDATE, `atualizar_resultado: ${idResultado}`);
  }

  return true;
}

/**
 * Excluir Resultado
 */
export async function excluirResultado(idResultado: string): Promise<boolean> {
  const { error } = await supabase.from('resultados').delete().eq('id', parseResultId(idResultado));
  if (error) {
    handleSupabaseError(error, OperationType.DELETE, `excluir_resultado: ${idResultado}`);
  }
  return true;
}
