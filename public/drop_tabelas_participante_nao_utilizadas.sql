-- Auditoria Socioestilo: backup e remocao de tabelas participante_* sem uso confirmado.
-- Execute no Supabase SQL Editor.
-- O script nao usa CASCADE: se houver dependencia oculta, o DROP falha e o COMMIT nao deve ser aplicado.

BEGIN;

CREATE SCHEMA IF NOT EXISTS backup_auditoria;

DO $$
DECLARE
  backup_suffix text := to_char(now(), 'YYYYMMDD_HH24MISS');
  table_name text;
  backup_table_name text;
  row_count bigint;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'participante_memoria',
    'participante_memoria_eventos',
    'participante_metas',
    'participante_evolucao_perfil'
  ]
  LOOP
    IF to_regclass(format('public.%I', table_name)) IS NOT NULL THEN
      backup_table_name := table_name || '_' || backup_suffix;

      EXECUTE format(
        'CREATE TABLE backup_auditoria.%I AS TABLE public.%I',
        backup_table_name,
        table_name
      );

      EXECUTE format('SELECT count(*) FROM backup_auditoria.%I', backup_table_name)
      INTO row_count;

      RAISE NOTICE 'Backup criado: backup_auditoria.% com % linhas.', backup_table_name, row_count;
    ELSE
      RAISE NOTICE 'Tabela public.% nao existe. Backup ignorado.', table_name;
    END IF;
  END LOOP;
END $$;

-- Conferencia de dependencias antes do DROP.
-- Se retornar linhas, revise antes de executar remocao em definitivo.
SELECT
  dependent_ns.nspname AS dependent_schema,
  dependent_class.relname AS dependent_object,
  dependent_class.relkind AS dependent_type,
  source_ns.nspname AS source_schema,
  source_class.relname AS source_table
FROM pg_depend dep
JOIN pg_rewrite rw
  ON rw.oid = dep.objid
JOIN pg_class dependent_class
  ON dependent_class.oid = rw.ev_class
JOIN pg_namespace dependent_ns
  ON dependent_ns.oid = dependent_class.relnamespace
JOIN pg_class source_class
  ON source_class.oid = dep.refobjid
JOIN pg_namespace source_ns
  ON source_ns.oid = source_class.relnamespace
WHERE source_ns.nspname = 'public'
  AND source_class.relname IN (
    'participante_memoria',
    'participante_memoria_eventos',
    'participante_metas',
    'participante_evolucao_perfil'
  )
ORDER BY source_class.relname, dependent_class.relname;

-- Remocao conservadora, sem CASCADE.
-- A ordem remove primeiro tabelas potencialmente filhas/eventos.
DROP TABLE IF EXISTS public.participante_memoria_eventos;
DROP TABLE IF EXISTS public.participante_metas;
DROP TABLE IF EXISTS public.participante_evolucao_perfil;
DROP TABLE IF EXISTS public.participante_memoria;

COMMIT;

-- Verificacao pos-execucao.
SELECT
  table_schema,
  table_name
FROM information_schema.tables
WHERE table_schema IN ('public', 'backup_auditoria')
  AND (
    table_name IN (
      'participante_memoria',
      'participante_memoria_eventos',
      'participante_metas',
      'participante_evolucao_perfil'
    )
    OR table_name LIKE 'participante_memoria_%'
    OR table_name LIKE 'participante_metas_%'
    OR table_name LIKE 'participante_evolucao_perfil_%'
  )
ORDER BY table_schema, table_name;
