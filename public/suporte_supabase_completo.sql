-- =========================================================================
-- SCRIPT DE AJUSTE COMPLETO DO BANCO DE DADOS (SUPABASE)
-- Socioestilo Potenciar - Soluções Integradas (RLS & Busca Vetorial PgVector)
-- =========================================================================
-- Execute este script no Painel do Supabase -> SQL Editor para corrigir
-- as permissões de gravação de resultados e habilitar a busca na base de conhecimento.

-- -------------------------------------------------------------------------
-- 1. EXTENSÕES & BUSCA VETORIAL (PGVECTOR)
-- -------------------------------------------------------------------------

-- Habilita a extensão pgvector caso ela esteja desativada
CREATE EXTENSION IF NOT EXISTS vector;

-- Criação da tabela de documentos da base de conhecimento (caso não exista)
CREATE TABLE IF NOT EXISTS public.documents (
  id bigserial PRIMARY KEY,
  content text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  embedding vector(1536) -- Modificar para 768 caso vá usar embeddings nativos do Gemini
);

-- RPC 1: Define a busca vetorial para embeddings de 1536 dimensões (Padrão OpenAI Embeddings)
CREATE OR REPLACE FUNCTION public.match_documents (
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id bigint,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    documents.id,
    documents.content,
    documents.metadata,
    1 - (documents.embedding <=> query_embedding) AS similarity
  FROM public.documents
  WHERE 1 - (documents.embedding <=> query_embedding) > match_threshold
  ORDER BY documents.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- RPC 2: Define a busca vetorial para embeddings de 768 dimensões (Caso use Gemini Embeddings)
CREATE OR REPLACE FUNCTION public.match_documents_gemini (
  query_embedding vector(768),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id bigint,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    documents.id,
    documents.content,
    documents.metadata,
    1 - (documents.embedding <=> query_embedding) AS similarity
  FROM public.documents
  WHERE 1 - (documents.embedding <=> query_embedding) > match_threshold
  ORDER BY documents.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;


-- -------------------------------------------------------------------------
-- 2. POLÍTICAS DE SEGURANÇA (RLS - ROW LEVEL SECURITY)
-- -------------------------------------------------------------------------

-- Garante que a tabela 'resultados' tenha RLS ativada
ALTER TABLE public.resultados ENABLE ROW LEVEL SECURITY;

-- Remove políticas anteriores conflitantes para evitar instabilidades
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.resultados;
DROP POLICY IF EXISTS "Enable select for authenticated users only" ON public.resultados;
DROP POLICY IF EXISTS "Enable select for users based on user_id" ON public.resultados;
DROP POLICY IF EXISTS "Permitir insercoes de resultados por todos" ON public.resultados;
DROP POLICY IF EXISTS "Permitir leitura de resultados por todos" ON public.resultados;
DROP POLICY IF EXISTS "Permitir insercoes de resultados de socioestilos para todos" ON public.resultados;
DROP POLICY IF EXISTS "Permitir leitura de todos os resultados de socioestilos para todos" ON public.resultados;

-- OPÇÃO BULLETPROOF PARA AMBIENTES INTEGRADOS E WEBHOOKS (CONECTADOS À API EXTERNA N8N):
-- Permite que usuários (autenticados, anônimos ou vindos de conexões webhook do n8n) possam inserir e consultar registros livremente. Nova RLS livre de falhas de chaves.
CREATE POLICY "Permitir insercoes de resultados de socioestilos para todos"
ON public.resultados
FOR INSERT
TO public, anon, authenticated
WITH CHECK (true);

CREATE POLICY "Permitir leitura de todos os resultados de socioestilos para todos"
ON public.resultados
FOR SELECT
TO public, anon, authenticated
USING (true);

-- Caso deseje manter RLS rígidas por usuário, você poderá utilizar o padrão abaixo (descomente para usar):
-- CREATE POLICY "Apenas o proprio usuario pode inserir seus resultados" 
-- ON public.resultados FOR INSERT TO authenticated 
-- WITH CHECK (auth.uid() = user_id);

-- CREATE POLICY "Apenas o proprio usuario pode ver seus resultados" 
-- ON public.resultados FOR SELECT TO authenticated 
-- USING (auth.uid() = user_id);

-- Garante que as permissões básicas de manipulação de tabelas estejam concedidas para as roles anônimas e autenticadas
GRANT ALL ON TABLE public.resultados TO anon, authenticated, postgres;
GRANT ALL ON TABLE public.documents TO anon, authenticated, postgres;

-- -------------------------------------------------------------------------
-- 3. COMENTÁRIO DE CONCLUSÃO DO PROCESSO
-- -------------------------------------------------------------------------
COMMENT ON TABLE public.resultados IS 'Resultados Socioestilo - Políticas RLS e busca vetorial reestruturadas para compatibilidade robusta';
