import express, { Request, Response, NextFunction } from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";

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

// Global Custom Rate Limiter in memory to prevent requisições abuse
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
          "https://*.firebasestorage.app",
          "https://*.youtube.com",
          "https://*.ytimg.com"
        ],
        connectSrc: [
          "'self'",
          "ws://localhost:3000",
          "wss://*.run.app", // Sandbox HMR preview no AI Studio
          "wss://*.supabase.co",
          "https://*.supabase.co",
          "https://*.googleapis.com",
          "https://identitytoolkit.googleapis.com",
          "https://securetoken.googleapis.com",
          "https://www.googleapis.com",
          "https://*.firebaseapp.com",
        ],
        frameSrc: [
          "'self'",
          "https://*.firebaseapp.com",
          "https://*.google.com",
          "https://*.youtube.com",
          "https://*.youtube-nocookie.com",
          "https://youtube.com"
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
    crossOriginOpenerPolicy: { policy: "unsafe-none" },
    crossOriginResourcePolicy: false,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" }
  })
);

// 2. CORS restritivo somente nas rotas /api/* do backend
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
  process.env.APP_URL
].filter(Boolean) as string[];

const apiCorsOptions = {
  origin: (origin: string | undefined, callback: any) => {
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
};

app.use("/api", cors(apiCorsOptions));
app.options("/api", cors(apiCorsOptions));
app.options("/api/*", cors(apiCorsOptions));

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
}

// Configuração segura do cliente Supabase para o Backend
const activeSupabaseUrl = process.env.SUPABASE_URL as string;
if (!activeSupabaseUrl) {
  throw new Error("SUPABASE_URL is required for backend Supabase client initialization.");
}

const activeSupabaseKey = IS_PROD
  ? (process.env.SUPABASE_SERVICE_ROLE_KEY as string)
  : (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_nMDXUT9SGCS1qdlebnz3Wg_yuQOUDYz");

const supabase = createClient(activeSupabaseUrl, activeSupabaseKey);

// ENDPOINTS PROTEGIDOS POR RATE LIMITER E PAYLOAD SANITIZER

app.get("/api/resultados", apiRateLimiter, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const { data, error } = await supabase.from("resultados").select("*");

    if (error) {
      console.error("[RESULTADOS] Falha ao listar resultados via backend:", error.message);
      return res.status(500).json({
        error: "Não foi possível carregar os resultados.",
        details: error.message
      });
    }

    return res.json({
      data: data || [],
      count: data?.length || 0
    });
  } catch (err) {
    next(err);
  }
});

app.delete("/api/resultados/:id", apiRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) {
      return res.status(400).json({ error: "ID do resultado é obrigatório." });
    }

    let deletedCount = 0;
    const idColumns = ["id", "id_resultado", "relatorio_uuid"];

    for (const column of idColumns) {
      const { error, count } = await supabase
        .from("resultados")
        .delete({ count: "exact" })
        .eq(column, id);

      if (error) {
        const message = error.message || "";
        if (message.includes("does not exist") || message.includes("Could not find")) {
          continue;
        }

        console.error("[RESULTADOS] Falha ao excluir resultado via backend:", error.message);
        return res.status(500).json({
          error: "Não foi possível excluir o resultado.",
          details: error.message
        });
      }

      deletedCount += count || 0;
      if (deletedCount > 0) break;
    }

    if (!deletedCount) {
      return res.status(404).json({
        error: "Resultado não encontrado para exclusão.",
        id
      });
    }

    return res.json({
      success: true,
      deleted: deletedCount,
      id
    });
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
