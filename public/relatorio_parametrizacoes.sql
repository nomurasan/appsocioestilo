-- Parametrizacao das secoes/campos exibidos no relatorio final.
-- Execute no Supabase SQL Editor para persistir as alteracoes para todos os usuarios.

CREATE TABLE IF NOT EXISTS public.relatorio_parametros_indicadores (
  id bigserial PRIMARY KEY,
  tipo_usuario text NOT NULL CHECK (tipo_usuario IN ('usuario', 'admin')),
  secao text NOT NULL,
  campo text NOT NULL,
  titulo text NOT NULL,
  descricao text NOT NULL DEFAULT '',
  ativo boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT relatorio_parametros_indicadores_tipo_secao_campo_key UNIQUE (tipo_usuario, secao, campo)
);

CREATE OR REPLACE FUNCTION public.set_relatorio_parametros_indicadores_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_relatorio_parametros_indicadores_updated_at ON public.relatorio_parametros_indicadores;
CREATE TRIGGER trg_relatorio_parametros_indicadores_updated_at
BEFORE UPDATE ON public.relatorio_parametros_indicadores
FOR EACH ROW
EXECUTE FUNCTION public.set_relatorio_parametros_indicadores_updated_at();

ALTER TABLE public.relatorio_parametros_indicadores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura de parametros indicadores do relatorio" ON public.relatorio_parametros_indicadores;
DROP POLICY IF EXISTS "Permitir escrita de parametros indicadores do relatorio" ON public.relatorio_parametros_indicadores;

CREATE POLICY "Permitir leitura de parametros indicadores do relatorio"
ON public.relatorio_parametros_indicadores
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Permitir escrita de parametros indicadores do relatorio"
ON public.relatorio_parametros_indicadores
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

GRANT ALL ON TABLE public.relatorio_parametros_indicadores TO anon, authenticated, postgres;
GRANT USAGE, SELECT ON SEQUENCE public.relatorio_parametros_indicadores_id_seq TO anon, authenticated, postgres;
