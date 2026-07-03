-- =========================================================================
-- ORIENTADOR SOCIOESTILO - TABELAS E CARGA INICIAL
-- =========================================================================
-- Execute no Supabase SQL Editor.
--
-- Objetivo:
-- 1. Garantir as tabelas usadas pela Conversa com Orientador.
-- 2. Criar uma carga inicial para relatorios ja existentes em public.resultados.
-- 3. Manter o script idempotente: pode ser executado mais de uma vez.
--
-- Observacao:
-- A aplicacao libera o Orientador com base em public.resultados. Esta tabela
-- auxiliar serve como indice seguro para n8n/backend localizarem o contexto do
-- relatorio por resultado_id sem depender de enviar o relatorio completo pelo
-- frontend.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -------------------------------------------------------------------------
-- 1. Indice de relatorios elegiveis ao Orientador
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.orientador_relatorios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resultado_id text NOT NULL UNIQUE,
  usuario_id text NOT NULL,
  empresa_id text,
  nome_participante text,
  empresa_nome text,
  generated_at timestamptz,
  perfil_dominante text,
  perfil_secundario text,
  perfil_menos_utilizado text,
  scores jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'gerado',
  origem text NOT NULL DEFAULT 'backfill_resultados',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS orientador_relatorios_usuario_idx
  ON public.orientador_relatorios (usuario_id);

CREATE INDEX IF NOT EXISTS orientador_relatorios_empresa_idx
  ON public.orientador_relatorios (empresa_id);

CREATE INDEX IF NOT EXISTS orientador_relatorios_generated_at_idx
  ON public.orientador_relatorios (generated_at DESC);

-- -------------------------------------------------------------------------
-- 2. Conversas do Orientador
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.orientador_conversas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id text NOT NULL,
  empresa_id text,
  resultado_id text NOT NULL,
  status text NOT NULL DEFAULT 'ativa',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT orientador_conversas_resultado_fk
    FOREIGN KEY (resultado_id)
    REFERENCES public.orientador_relatorios (resultado_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS orientador_conversas_usuario_idx
  ON public.orientador_conversas (usuario_id);

CREATE INDEX IF NOT EXISTS orientador_conversas_resultado_idx
  ON public.orientador_conversas (resultado_id);

-- -------------------------------------------------------------------------
-- 3. Mensagens das conversas
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.orientador_mensagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id uuid NOT NULL REFERENCES public.orientador_conversas (id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  fontes jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS orientador_mensagens_conversa_idx
  ON public.orientador_mensagens (conversa_id, created_at);

-- -------------------------------------------------------------------------
-- 4. Carga inicial a partir de public.resultados
-- -------------------------------------------------------------------------
-- Usa to_jsonb(r) para ser tolerante a variacoes de schema, sem referenciar
-- diretamente colunas que podem nao existir em bancos mais antigos.
INSERT INTO public.orientador_relatorios (
  resultado_id,
  usuario_id,
  empresa_id,
  nome_participante,
  empresa_nome,
  generated_at,
  perfil_dominante,
  perfil_secundario,
  perfil_menos_utilizado,
  scores,
  status,
  origem,
  updated_at
)
SELECT
  COALESCE(
    NULLIF(row_data ->> 'id_resultado', ''),
    NULLIF(row_data ->> 'id', ''),
    NULLIF(row_data -> 'report_data' -> 'identificacao' ->> 'relatorio_uuid', ''),
    NULLIF(row_data -> 'raw_payload' -> 'report_data' -> 'identificacao' ->> 'relatorio_uuid', '')
  ) AS resultado_id,
  COALESCE(
    NULLIF(row_data ->> 'id_usuario', ''),
    NULLIF(row_data ->> 'user_id', ''),
    NULLIF(row_data ->> 'uid', ''),
    NULLIF(row_data -> 'metadata' ->> 'userId', ''),
    NULLIF(row_data -> 'raw_payload' -> 'metadata' ->> 'userId', '')
  ) AS usuario_id,
  COALESCE(
    NULLIF(row_data ->> 'empresa_id', ''),
    NULLIF(row_data ->> 'id_empresa', ''),
    NULLIF(row_data -> 'metadata' ->> 'companyId', ''),
    NULLIF(row_data -> 'raw_payload' -> 'metadata' ->> 'companyId', '')
  ) AS empresa_id,
  COALESCE(
    NULLIF(row_data ->> 'nome_usuario', ''),
    NULLIF(row_data ->> 'user_name', ''),
    NULLIF(row_data -> 'metadata' ->> 'userName', ''),
    NULLIF(row_data -> 'raw_payload' -> 'metadata' ->> 'userName', ''),
    NULLIF(row_data -> 'report_data' -> 'identificacao' ->> 'nome', ''),
    NULLIF(row_data -> 'raw_payload' -> 'report_data' -> 'identificacao' ->> 'nome', '')
  ) AS nome_participante,
  COALESCE(
    NULLIF(row_data ->> 'empresa_nome', ''),
    NULLIF(row_data ->> 'company_name', ''),
    NULLIF(row_data -> 'metadata' ->> 'companyName', ''),
    NULLIF(row_data -> 'raw_payload' -> 'metadata' ->> 'companyName', ''),
    NULLIF(row_data -> 'report_data' -> 'identificacao' ->> 'empresa', ''),
    NULLIF(row_data -> 'raw_payload' -> 'report_data' -> 'identificacao' ->> 'empresa', '')
  ) AS empresa_nome,
  CASE
    WHEN generated_at_text ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN generated_at_text::timestamptz
    ELSE NULL
  END AS generated_at,
  COALESCE(
    NULLIF(row_data ->> 'perfil_dominante', ''),
    NULLIF(row_data -> 'report_data' -> 'resultado' ->> 'perfil_dominante', ''),
    NULLIF(row_data -> 'raw_payload' -> 'report_data' -> 'resultado' ->> 'perfil_dominante', '')
  ) AS perfil_dominante,
  COALESCE(
    NULLIF(row_data ->> 'perfil_secundario', ''),
    NULLIF(row_data -> 'report_data' -> 'resultado' ->> 'perfil_secundario', ''),
    NULLIF(row_data -> 'raw_payload' -> 'report_data' -> 'resultado' ->> 'perfil_secundario', '')
  ) AS perfil_secundario,
  COALESCE(
    NULLIF(row_data ->> 'perfil_menos_utilizado', ''),
    NULLIF(row_data ->> 'perfil_menos_utili', ''),
    NULLIF(row_data -> 'report_data' -> 'resultado' ->> 'perfil_menos_utilizado', ''),
    NULLIF(row_data -> 'raw_payload' -> 'report_data' -> 'resultado' ->> 'perfil_menos_utilizado', '')
  ) AS perfil_menos_utilizado,
  COALESCE(
    CASE
      WHEN jsonb_typeof(row_data -> 'scores') = 'object' THEN row_data -> 'scores'
      ELSE NULL
    END,
    CASE
      WHEN jsonb_typeof(row_data -> 'report_data' -> 'resultado' -> 'scores') = 'object' THEN row_data -> 'report_data' -> 'resultado' -> 'scores'
      ELSE NULL
    END,
    CASE
      WHEN jsonb_typeof(row_data -> 'raw_payload' -> 'report_data' -> 'resultado' -> 'scores') = 'object' THEN row_data -> 'raw_payload' -> 'report_data' -> 'resultado' -> 'scores'
      ELSE NULL
    END,
    '{}'::jsonb
  ) AS scores,
  'gerado' AS status,
  'backfill_resultados' AS origem,
  now() AS updated_at
FROM public.resultados r
CROSS JOIN LATERAL (SELECT to_jsonb(r) AS row_data) payload
CROSS JOIN LATERAL (
  SELECT COALESCE(
    NULLIF(row_data ->> 'generated_at', ''),
    NULLIF(row_data ->> 'data_conclusao', ''),
    NULLIF(row_data ->> 'created_at', ''),
    NULLIF(row_data -> 'metadata' ->> 'generatedAt', ''),
    NULLIF(row_data -> 'raw_payload' -> 'metadata' ->> 'generatedAt', ''),
    NULLIF(row_data -> 'report_data' -> 'identificacao' ->> 'generated_at', ''),
    NULLIF(row_data -> 'raw_payload' -> 'report_data' -> 'identificacao' ->> 'generated_at', '')
  ) AS generated_at_text
) dates
WHERE COALESCE(
    NULLIF(row_data ->> 'id_resultado', ''),
    NULLIF(row_data ->> 'id', ''),
    NULLIF(row_data -> 'report_data' -> 'identificacao' ->> 'relatorio_uuid', ''),
    NULLIF(row_data -> 'raw_payload' -> 'report_data' -> 'identificacao' ->> 'relatorio_uuid', '')
  ) IS NOT NULL
  AND COALESCE(
    NULLIF(row_data ->> 'id_usuario', ''),
    NULLIF(row_data ->> 'user_id', ''),
    NULLIF(row_data ->> 'uid', ''),
    NULLIF(row_data -> 'metadata' ->> 'userId', ''),
    NULLIF(row_data -> 'raw_payload' -> 'metadata' ->> 'userId', '')
  ) IS NOT NULL
ON CONFLICT (resultado_id) DO UPDATE SET
  usuario_id = EXCLUDED.usuario_id,
  empresa_id = EXCLUDED.empresa_id,
  nome_participante = EXCLUDED.nome_participante,
  empresa_nome = EXCLUDED.empresa_nome,
  generated_at = EXCLUDED.generated_at,
  perfil_dominante = EXCLUDED.perfil_dominante,
  perfil_secundario = EXCLUDED.perfil_secundario,
  perfil_menos_utilizado = EXCLUDED.perfil_menos_utilizado,
  scores = EXCLUDED.scores,
  status = EXCLUDED.status,
  updated_at = now();

-- -------------------------------------------------------------------------
-- 5. RLS permissiva para leitura autenticada e escrita por backend/n8n
-- -------------------------------------------------------------------------
ALTER TABLE public.orientador_relatorios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orientador_conversas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orientador_mensagens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Orientador relatorios leitura autenticada" ON public.orientador_relatorios;
DROP POLICY IF EXISTS "Orientador conversas leitura autenticada" ON public.orientador_conversas;
DROP POLICY IF EXISTS "Orientador mensagens leitura autenticada" ON public.orientador_mensagens;

CREATE POLICY "Orientador relatorios leitura autenticada"
ON public.orientador_relatorios
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Orientador conversas leitura autenticada"
ON public.orientador_conversas
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Orientador mensagens leitura autenticada"
ON public.orientador_mensagens
FOR SELECT
TO authenticated
USING (true);

GRANT SELECT ON public.orientador_relatorios TO authenticated, anon;
GRANT SELECT ON public.orientador_conversas TO authenticated;
GRANT SELECT ON public.orientador_mensagens TO authenticated;
GRANT ALL ON public.orientador_relatorios TO postgres;
GRANT ALL ON public.orientador_conversas TO postgres;
GRANT ALL ON public.orientador_mensagens TO postgres;

-- -------------------------------------------------------------------------
-- 6. Conferencia da carga
-- -------------------------------------------------------------------------
SELECT
  COUNT(*) AS relatorios_indexados_orientador,
  COUNT(*) FILTER (WHERE usuario_id IS NOT NULL AND usuario_id <> '') AS relatorios_com_usuario,
  COUNT(*) FILTER (WHERE generated_at IS NOT NULL) AS relatorios_com_data
FROM public.orientador_relatorios;
