import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Supabase Client on the Server
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://czxxuznpcbluiqgppegzj.supabase.co";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_nMDXUT9SGCS1qdlebnz3Wg_yuQOUDYz";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Lazy-initialized Gemini Client to prevent server startup crashes
let aiInstance: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required. Please add it under Settings > Secrets.");
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
 * Auto-detects if process.env.OPENAI_API_KEY is defined.
 * - If detected, outputs a 1536-dimensional vector (matches standard Flowise / OpenAI index dimensions).
 * - Otherwise, defaults to Gemini's 768-dimensional vector (text-embedding-004).
 */
async function getEmbedding(text: string): Promise<number[]> {
  const openAiKey = process.env.OPENAI_API_KEY;
  if (openAiKey) {
    try {
      console.log("[KNOWLEDGE] Generating 1536-dimensional embedding using OpenAI (to match standard Flowise vectors)...");
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
        console.warn(`[KNOWLEDGE] OpenAI embedding call returned non-200: ${errText}. Falling back to Gemini.`);
      }
    } catch (err: any) {
      console.warn(`[KNOWLEDGE] Error retrieving OpenAI embedding, falling back to Gemini:`, err?.message || err);
    }
  }

  // Gemini Embedding Fallback (768 dimensions)
  try {
    console.log("[KNOWLEDGE] Generating 768-dimensional embedding using Gemini 'gemini-embedding-2-preview'...");
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
    console.error("[KNOWLEDGE] Gemini embedding error:", err?.message || err);
  }

  throw new Error("Não foi possível gerar vetores de embedding por OpenAI ou Gemini.");
}

/**
 * Searches the Supabase documents table using the custom 'match_documents' RPC function
 */
async function searchKnowledgeBase(queryText: string, matchCount = 3): Promise<{ formattedText: string; chunks: Array<{ source: string; content: string }> }> {
  try {
    console.log(`[KNOWLEDGE] Initiating similarity search in Supabase for: "${queryText}"`);
    const embedding = await getEmbedding(queryText);
    const rpcName = embedding.length === 768 ? "match_documents_gemini" : "match_documents";

    console.log(`[KNOWLEDGE] Executing Supabase RPC '${rpcName}' (dimensions: ${embedding.length})...`);
    // Call Supabase PgVector RPC function
    let { data, error } = await supabase.rpc(rpcName, {
      query_embedding: embedding,
      match_threshold: 0.15, // Lenient threshold to support robust matching
      match_count: matchCount
    });

    if (error && rpcName === "match_documents_gemini") {
      console.log("[KNOWLEDGE] match_documents_gemini not found, trying generic match_documents...");
      const retryRes = await supabase.rpc("match_documents", {
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
      console.log("[KNOWLEDGE] Info: Supabase similarity RPC deferred to text-search lookup.", error.message);
      
      // Fallback: search using a standard `.select()` query in case the RPC is missing
      console.log("[KNOWLEDGE] Performing broad keyword search on 'documents' table...");
      const words = queryText.split(/\s+/).filter(w => w.length > 3).slice(0, 4);
      let queryBuilder = supabase.from("documents").select("*");
      if (words.length > 0) {
        queryBuilder = queryBuilder.or(words.map(w => `content.ilike.%${w}%`).join(","));
      }
      
      const selectRes = await queryBuilder.limit(matchCount);
      if (selectRes.error) {
        console.log("[KNOWLEDGE] Text search deferred: 'documents' query completed.", selectRes.error.message);
        return { formattedText: "", chunks: [] };
      }
      
      data = selectRes.data;
    }

    if (!data || !Array.isArray(data) || data.length === 0) {
      console.log("[KNOWLEDGE] No matches found in knowledge base.");
      return { formattedText: "", chunks: [] };
    }

    console.log(`[KNOWLEDGE] Retrived ${data.length} document context chunk matches successfully.`);
    const chunks: Array<{ source: string; content: string }> = [];
    const formattedText = data
      .map((doc: any, idx: number) => {
        const textStr = doc.content || doc.page_content || doc.text || JSON.stringify(doc);
        
        // Extract meta tag or origin source for complete traceability
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
          console.warn("[KNOWLEDGE] Error formatting metadata source:", e);
        }

        chunks.push({ source: sourceInfo, content: textStr });
        return `[Documento ${idx + 1} - Fonte: ${sourceInfo}]:\n${textStr}`;
      })
      .join("\n\n");

    return { formattedText, chunks };
  } catch (err: any) {
    console.error(`[KNOWLEDGE] Failure searching documents: ${err?.message || err}`);
    return { formattedText: "", chunks: [] };
  }
}

// Endpoint allowing manual vector searching for debug and external systems
app.post("/api/knowledge-search", async (req, res) => {
  try {
    const { query, limit } = req.body;
    if (!query) {
      return res.status(400).json({ error: "O parâmetro 'query' é obrigatório." });
    }
    const count = Number(limit) || 3;
    const searchResult = await searchKnowledgeBase(query, count);
    return res.json({
      query,
      results: searchResult.formattedText,
      chunks: searchResult.chunks,
      dimension_hint: process.env.OPENAI_API_KEY ? "1536 (OpenAI)" : "768 (Gemini)",
      status: "success"
    });
  } catch (err: any) {
    console.error("[KNOWLEDGE-API] Error:", err);
    return res.status(500).json({ error: err?.message || "Erro desconhecido na busca vetorial." });
  }
});

// Full-stack API Route for AI Insights Generation (with n8n Webhook routing proxy)
app.post("/api/insights", async (req, res) => {
  try {
    const payload = req.body;
    
    // Check if it has metadata and questionnaire
    if (!payload?.metadata || !payload?.questionnaire) {
      return res.status(400).json({ error: "Payload inválido. É necessário conter 'metadata' e 'questionnaire'." });
    }

    let n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;
    if (!n8nWebhookUrl || n8nWebhookUrl.trim().length === 0) {
      n8nWebhookUrl = "https://n8n-n8n.5wxq0l.easypanel.host/webhook/socioestilo/analisar-direto";
    }

    console.log(`[N8N WEBHOOK] Proxying questionnaire payload to: "${n8nWebhookUrl}"`);
    
    const n8nResponse = await fetch(n8nWebhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!n8nResponse.ok) {
      throw new Error(`n8n webhook returned status code ${n8nResponse.status}`);
    }

    const rawResponse = await n8nResponse.text();
    console.log(`[N8N WEBHOOK] Received payload raw length: ${rawResponse.length}`);

    let parsedData: any = null;
    try {
      parsedData = JSON.parse(rawResponse.trim());
    } catch (e) {
      const match = rawResponse.trim().match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
      if (match && match[1]) {
        parsedData = JSON.parse(match[1].trim());
      } else {
        throw new Error("Resposta do n8n não é um JSON válido");
      }
    }

    const normalizedObject = Array.isArray(parsedData) ? parsedData[0] : parsedData;
    
    // Check if it has report_data
    if (!normalizedObject || !normalizedObject.report_data) {
      throw new Error("Resposta do n8n não contém a propriedade 'report_data'.");
    }

    console.log("[N8N WEBHOOK] Success: Received fully structured report from n8n webhook.");
    return res.json(normalizedObject);
  } catch (err: any) {
    console.error("Erro na rota de insights do servidor:", err);
    return res.status(500).json({ error: err.message || "Erro de servidor ao buscar insights do Socioestilo" });
  }
});

// Setup Vite Dev Server / Static Assets Fallback
async function bootstrap() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("[SERVER] Vite Dev Server middleware mounted.");
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("[SERVER] Serving production static files from dist/.");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[SERVER] Full-stack application running on http://localhost:${PORT}`);
  });
}

bootstrap();
