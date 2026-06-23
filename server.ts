import express, { Request, Response, NextFunction } from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import { z } from "zod";

dotenv.config();

const app = express();
const PORT = 3000;

// Configurar o Express para confiar nos cabeçalhos de proxy reverso (como Nginx no Easypanel ou o proxy do Cloud Run)
app.set("trust proxy", 1);

// Centralized utilities for security logging and masking
function generateRequestId(): string {
  return "req_" + crypto.randomUUID();
}

function maskSecret(key: string | undefined | null): string {
  if (!key) return "NÃO CONFIGURADA";
  const str = String(key).trim();
  if (str.length <= 8) return "********";
  return `${str.substring(0, 4)}...${str.substring(str.length - 4)}`;
}

// Global Custom Rate Limiter in memory to prevent AI credits abuse
interface RateLimitation {
  count: number;
  resetTime: number;
}
const rateLimitMaps = new Map<string, RateLimitation>();
const WINDOW_MS = 60 * 1000; // 1 minute window
const MAX_REQUESTS = 30; // 30 requests max per minute

function apiRateLimiter(req: Request, res: Response, next: NextFunction) {
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "anonymous_ip";
  const clientKey = String(ip);
  const now = Date.now();
  
  let record = rateLimitMaps.get(clientKey);
  if (!record || now > record.resetTime) {
    record = { count: 1, resetTime: now + WINDOW_MS };
    rateLimitMaps.set(clientKey, record);
    return next();
  }
  
  record.count++;
  if (record.count > MAX_REQUESTS) {
    console.warn(`[SECURITY WARNING] Rate limit exceeded for IP: ${clientKey} on path ${req.path}`);
    return res.status(429).json({
      error: "Muitas requisições sequenciais. Por favor, aguarde alguns segundos antes de tentar novamente.",
      requestId: req.headers["x-request-id"] || "N/A"
    });
  }
  
  next();
}

// Strict validation of secure environment variables
const NODE_ENV = process.env.NODE_ENV || "development";
const IS_PROD = NODE_ENV === "production";

// 1. Helmet para cabeçalhos HTTP altamente seguros com CSP (Content Security Policy) robusto
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'", // Permitir carregamento de inline do build do Vite
          "'unsafe-eval'", // Permitir eval do Vite e dependências
          "https://apis.google.com",
          "https://*.googleapis.com"
        ],
        styleSrc: [
          "'self'",
          "'unsafe-inline'", // Tailwind inline styles
          "https://fonts.googleapis.com"
        ],
        fontSrc: [
          "'self'",
          "https://fonts.gstatic.com",
          "data:"
        ],
        imgSrc: [
          "'self'",
          "data:",
          "https://images.unsplash.com",
          "https://*.supabase.co",
          "https://*.firebasestorage.app"
        ],
        connectSrc: [
          "'self'",
          "ws://localhost:3000",
          "wss://*.run.app", // Sandbox HMR preview no AI Studio
          "https://*.supabase.co",
          "https://*.googleapis.com",
          "https://*.firebaseapp.com",
          "https://api.openai.com",
          "https://n8n-n8n.5wxq0l.easypanel.host",
          "https://*.easypanel.host"
        ],
        frameSrc: [
          "'self'",
          "https://*.firebaseapp.com",
          "https://*.google.com"
        ],
        frameAncestors: [
          "'self'",
          "https://*.google.com",
          "https://*.run.app",
          "https://ai.studio",
          "https://*.aistudio.google"
        ],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: []
      }
    },
    frameguard: false, // Permitir carregamento em iframe no sandbox de desenvolvimento do AI Studio
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: "unsafe-none" }
  })
);

// 2. CORS restritivo por domínio configurável em produção
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
  process.env.APP_URL
].filter(Boolean) as string[];

app.use(
  cors({
    origin: (origin, callback) => {
      // Em dev ou sem header de origem (ex: curl/mobile/servidor), permitir tráfego livremente
      if (!origin || !IS_PROD) {
        return callback(null, true);
      }
      
      const isAllowed = allowedOrigins.some((allowed) => {
        return origin === allowed || origin.endsWith(allowed.replace("https://", "."));
      });
      
      if (isAllowed) {
        callback(null, true);
      } else {
        callback(new Error("Acesso CORS bloqueado por diretivas corporativas de segurança."));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id"]
  })
);

// 3. Compression middleware (Gzip)
app.use(compression());

// 4. Limit JSON payload size defensively (max 2MB para upload de questionários pesados)
app.use(express.json({ limit: "2mb" }));

// Request identifier middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const rid = generateRequestId();
  req.headers["x-request-id"] = rid;
  res.setHeader("X-Request-Id", rid);
  next();
});

// Fail Fast: Auditoria de Produção rigorosa para impossibilitar fallbacks inseguros
if (IS_PROD) {
  console.log("[SECURITY CHECK] Validando barramento de produção no Easypanel...");
  
  if (!process.env.SUPABASE_URL || process.env.SUPABASE_URL.startsWith("https://SUA_URL")) {
    console.error("[CRITICAL ERROR] SUPABASE_URL é inválido ou não foi configurado no ambiente de Produção!");
    process.exit(1);
  }
  
  // Exige obrigatoriamente a Service Role Key no Backend em Produção (sem fallbacks a chaves anônimas)
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY.startsWith("SUA_CHAVE")) {
    console.error("[CRITICAL ERROR] SUPABASE_SERVICE_ROLE_KEY é obrigatória e ausente em ambiente de Produção!");
    process.exit(1);
  }
  
  if (!process.env.GEMINI_API_KEY) {
    console.error("[CRITICAL ERROR] GEMINI_API_KEY de produção é obrigatório para as inteligências de socioestilo.");
    process.exit(1);
  }
}

// Configuração segura do cliente Supabase para o Backend
const activeSupabaseUrl = IS_PROD
  ? (process.env.SUPABASE_URL as string)
  : (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://czxxuznpcbluiqgppegzj.supabase.co");

const activeSupabaseKey = IS_PROD
  ? (process.env.SUPABASE_SERVICE_ROLE_KEY as string)
  : (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_nMDXUT9SGCS1qdlebnz3Wg_yuQOUDYz");

const supabase = createClient(activeSupabaseUrl, activeSupabaseKey);

// Lazy-initialized Gemini Client to prevent server startup crashes
let aiInstance: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required. Please check your Easypanel / ENV setup.");
    }
    aiInstance = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiInstance;
}

/**
 * Generates an embedding vector for text query.
 */
async function getEmbedding(text: string): Promise<number[]> {
  const openAiKey = process.env.OPENAI_API_KEY;
  if (openAiKey && !openAiKey.startsWith("SUA_OPENAI_API_KEY")) {
    try {
      console.log("[KNOWLEDGE] Gerando embedding de 1536 dimensões via OpenAI...");
      const response = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${openAiKey}`
        },
        body: JSON.stringify({
          model: "text-embedding-3-small",
          input: text
        })
      });

      if (response.ok) {
        const json = await response.json();
        return json.data[0].embedding;
      } else {
        const errText = await response.text();
        console.warn(`[KNOWLEDGE] Chamada OpenAI retornou status de falha: ${errText}. Forçando fallback para Gemini.`);
      }
    } catch (err: any) {
      console.warn(`[KNOWLEDGE] Erro ao recuperar embeddings da OpenAI, acionando Gemini:`, err?.message || err);
    }
  }

  // Gemini Embedding Fallback (768 dimensions)
  try {
    console.log("[KNOWLEDGE] Gerando embedding de 768 dimensões via Gemini native...");
    const client = getGeminiClient();
    const res = await client.models.embedContent({
      model: "gemini-embedding-2-preview",
      contents: text
    });
    const values = (res as any).embedding?.values || (res as any).embeddings?.[0]?.values || (res as any).embeddings?.values;
    if (values) {
      return values;
    }
  } catch (err: any) {
    console.error("[KNOWLEDGE] Erro no embedding do Gemini:", err?.message || err);
  }

  throw new Error("Não foi possível gerar vetores de embedding por OpenAI ou Gemini.");
}

/**
 * Searches the Supabase documents table using the custom 'match_documents' RPC function
 */
async function searchKnowledgeBase(queryText: string, matchCount = 3): Promise<{ formattedText: string; chunks: Array<{ source: string; content: string }> }> {
  try {
    console.log(`[KNOWLEDGE] Pesquisando base de conhecimento para o termo sanitizado.`);
    const embedding = await getEmbedding(queryText);
    const rpcName = embedding.length === 768 ? "match_documents_gemini" : "match_documents";

    console.log(`[KNOWLEDGE] Executando RPC no Supabase '${rpcName}' (Dimensões: ${embedding.length})...`);
    let { data, error } = await supabase.rpc(rpcName, {
      query_embedding: embedding,
      match_threshold: 0.15,
      match_count: matchCount
    });

    if (error && rpcName === "match_documents_gemini") {
      const retryRes = await supabase.rpc("match_documents_v2", {
        query_embedding: embedding,
        match_threshold: 0.15,
        match_count: matchCount
      });
      if (!retryRes.error) {
        data = retryRes.data;
        error = null;
      }
    }

    if (error) {
      console.log("[KNOWLEDGE] Fallback para pesquisa textual simples ativado devido à indisponibilidade de RPC PgVector.");
      const words = queryText.split(/\s+/).filter(w => w.length > 3).slice(0, 4);
      let queryBuilder = supabase.from("documents").select("*");
      if (words.length > 0) {
        queryBuilder = queryBuilder.or(words.map(w => `content.ilike.%${w}%`).join(","));
      }
      
      const selectRes = await queryBuilder.limit(matchCount);
      if (selectRes.error) {
        return { formattedText: "", chunks: [] };
      }
      data = selectRes.data;
    }

    if (!data || !Array.isArray(data) || data.length === 0) {
      return { formattedText: "", chunks: [] };
    }

    const chunks: Array<{ source: string; content: string }> = [];
    const formattedText = data
      .map((doc: any, idx: number) => {
        const textStr = doc.content || doc.page_content || doc.text || JSON.stringify(doc);
        let sourceInfo = "Livro Socioestilo.txt";
        try {
          if (doc.metadata) {
            const meta = typeof doc.metadata === "string" ? JSON.parse(doc.metadata) : doc.metadata;
            sourceInfo = meta.path || meta.source || meta.filename || meta.title || meta.name || sourceInfo;
          } else {
            sourceInfo = doc.path || doc.source || doc.filename || doc.title || doc.name || `doc_ref_${doc.id || idx + 1}`;
          }
          if (typeof sourceInfo === "string" && (sourceInfo.includes("/") || sourceInfo.includes("\\"))) {
            sourceInfo = sourceInfo.split(/[/\\]/).pop() || sourceInfo;
          }
        } catch (e) {
          // Silent log to prevent noise
        }

        chunks.push({ source: sourceInfo, content: textStr });
        return `[Documento ${idx + 1} - Fonte: ${sourceInfo}]:\n${textStr}`;
      })
      .join("\n\n");

    return { formattedText, chunks };
  } catch (err: any) {
    console.error(`[KNOWLEDGE] Falha insolúvel na pesquisa de documentos.`);
    return { formattedText: "", chunks: [] };
  }
}

// ESQUEMAS DE VALIDAÇÃO ZOD PARA ENTRADAS DE ENDPOINTS (ENTERPRISE PROTECTION)

const knowledgeSearchSchema = z.object({
  query: z.string().trim().min(1, "O parâmetro 'query' é obrigatório e não pode ser vazio."),
  limit: z.number().int().positive().max(10).optional()
});

const insightsSchema = z.object({
  metadata: z.object({
    name: z.string().trim().min(1, "O nome do candidato é obrigatório nos metadados."),
    email: z.string().email("Formato de e-mail do candidato é inválido.").optional(),
    empresa_id: z.string().optional()
  }).passthrough(),
  questionnaire: z.array(
    z.object({
      id: z.number().int(),
      category: z.string().trim().min(1, "A categoria da questão é obrigatória."),
      sub: z.string().trim().min(1, "A subcategoria da questão é obrigatória."),
      factor: z.string().trim().min(1, "O fator psicológico da questão é obrigatório."),
      val: z.number().int().min(1, "O valor mínimo de pontuação é 1.").max(10, "O valor máximo de pontuação é 10.")
    })
  ).min(1, "O questionário precisa conter ao menos uma resposta de questão válida.")
});

// ENPOINTS PROTEGIDOS POR RATE LIMITER E PAYLOAD SANITIZER

// Endpoint de busca vetorial manual com proteção de Rate Limit e Validação Zod
app.post("/api/knowledge-search", apiRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = knowledgeSearchSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ 
        error: "Dados de requisição inválidos de acordo com as políticas corporativas.",
        details: parseResult.error.flatten().fieldErrors,
        requestId: req.headers["x-request-id"]
      });
    }

    const { query, limit } = parseResult.data;
    const count = limit || 3;
    const searchResult = await searchKnowledgeBase(query, count);
    
    return res.json({
      query,
      results: searchResult.formattedText,
      chunks: searchResult.chunks,
      dimension_hint: process.env.OPENAI_API_KEY ? "1536 (OpenAI)" : "768 (Gemini)",
      status: "success"
    });
  } catch (err) {
    next(err);
  }
});

// Rota proxy para envio dos questionários ao webhook do n8n com Rate Limit, Validação Zod e Omissão de Erros de Stack em Prod
app.post("/api/insights", apiRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = insightsSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ 
        error: "O payload fornecido não atende aos requisitos mínimos de estrutura e tipo do Socioestilo.",
        details: parseResult.error.flatten().fieldErrors,
        requestId: req.headers["x-request-id"]
      });
    }

    const payload = parseResult.data;

    let n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;
    if (!n8nWebhookUrl || n8nWebhookUrl.trim().length === 0 || n8nWebhookUrl.startsWith("https://SEU_N8N")) {
      n8nWebhookUrl = "https://n8n-n8n.5wxq0l.easypanel.host/webhook/socioestilo/analisar-direto";
    }

    console.log(`[N8N WEBHOOK] Direcionando payload para o portal n8n no subdomínio privado.`);
    
    const n8nResponse = await fetch(n8nWebhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!n8nResponse.ok) {
      throw new Error(`O webhook do n8n respondeu com erro crítico HTTP ${n8nResponse.status}`);
    }

    const rawResponse = await n8nResponse.text();

    let parsedData: any = null;
    try {
      parsedData = JSON.parse(rawResponse.trim());
    } catch (e) {
      const match = rawResponse.trim().match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
      if (match && match[1]) {
        parsedData = JSON.parse(match[1].trim());
      } else {
        throw new Error("A resposta provida pelo servidor n8n não obedece à sintaxe JSON.");
      }
    }

    const normalizedObject = Array.isArray(parsedData) ? parsedData[0] : parsedData;
    
    if (!normalizedObject || !normalizedObject.report_data) {
      throw new Error("A resposta validada do n8n não contém o bloco 'report_data' obrigatório.");
    }

    console.log("[N8N WEBHOOK] Sucesso: Novo laudo de Socioestilo recebido do n8n e envelopado com sucesso.");
    return res.json(normalizedObject);
  } catch (err) {
    next(err);
  }
});

// MIDDLEWARE GLOBAL DE TRATAMENTO DE ERROS DO EXPRESS COM SUPORTE SECURITIZADO E CORRELAÇÃO DE REQUEST ID
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  const requestId = req.headers["x-request-id"] as string || generateRequestId();
  const timestamp = new Date().toISOString();
  
  // Safe sanitized server logs
  console.error(`[INTERNAL ERROR][${timestamp}][ID: ${requestId}] Path: ${req.path}`);
  console.error(`Message: ${err?.message || "Sem mensagem descritiva de erro"}`);
  
  if (NODE_ENV !== "production" && err?.stack) {
    console.error("Stack trace para depuração:", err.stack);
  }

  // Response with zero credential leaks
  return res.status(500).json({
    error: "Ocorreu um erro interno de processamento seguro no cluster de socioestilo.",
    message: IS_PROD ? "Contate o suporte técnico corporativo e forneça o identificador de depuração." : err?.message,
    requestId,
    timestamp
  });
});

// Setup Vite Dev Server / Static Assets Fallback
async function bootstrap() {
  console.log("\n=================================================================");
  console.log("       VALIDADOR ARCHITECT - POTENCIAR SECURITIZADO");
  console.log("=================================================================");
  console.log(`Ambiente de Deploy: ${NODE_ENV.toUpperCase()}`);
  console.log(`Porta Ingress     : ${PORT}`);
  console.log(`Link do Portal    : ${process.env.APP_URL || "Usando mapeamento interno"}`);
  console.log(`Supabase Target   : ${activeSupabaseUrl}`);
  console.log(`Chave Supabase    : ${maskSecret(activeSupabaseKey)}`);
  console.log(`Chave Gemini      : ${maskSecret(process.env.GEMINI_API_KEY)}`);
  console.log(`Chave OpenAI      : ${maskSecret(process.env.OPENAI_API_KEY)}`);
  console.log(`Webhook n8n       : ${maskSecret(process.env.N8N_WEBHOOK_URL)}`);
  console.log("=================================================================\n");

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("[SERVER-INIT] Middleware completo do Vite acoplado em modo desenvolvimento.");
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("[SERVER-INIT] Servidor de produção servindo dist/ estático.");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[SERVER-BOOT] Aplicação executada com segurança de nível prod em http://0.0.0.0:${PORT}`);
  });
}

bootstrap();

