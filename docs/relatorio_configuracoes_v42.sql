-- V42: Configuração de visibilidade do relatório Sócio Estilo
-- Fonte editorial permanece em resultados.report_output.visao_geral
-- Esta tabela guarda apenas regras de exibição.

create table if not exists public.relatorio_configuracoes (
  id bigserial primary key,
  scope text not null check (scope in ('global', 'company')),
  empresa_id bigint null,
  view_type text not null check (view_type in ('synthetic', 'analytical')),
  viewer_role text null check (viewer_role in ('participant', 'consultant', 'admin')),
  configuracao jsonb not null default '{}'::jsonb,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint relatorio_configuracoes_scope_empresa_ck check (
    (scope = 'global' and empresa_id is null)
    or
    (scope = 'company' and empresa_id is not null)
  ),
  constraint relatorio_configuracoes_synthetic_role_ck check (
    (view_type = 'synthetic' and viewer_role is null)
    or
    (view_type = 'analytical' and viewer_role is not null)
  )
);

create index if not exists relatorio_configuracoes_scope_idx
  on public.relatorio_configuracoes(scope, view_type, viewer_role, empresa_id)
  where ativo = true;

-- Global Sintético: uma única configuração ativa
create unique index if not exists relatorio_configuracoes_uq_global_synthetic
  on public.relatorio_configuracoes(view_type)
  where scope = 'global' and view_type = 'synthetic' and ativo = true;

-- Global Analítico: uma configuração por papel
create unique index if not exists relatorio_configuracoes_uq_global_analytical_role
  on public.relatorio_configuracoes(view_type, viewer_role)
  where scope = 'global' and view_type = 'analytical' and ativo = true;

-- Empresa Analítico: uma configuração por empresa + papel
create unique index if not exists relatorio_configuracoes_uq_company_analytical_role
  on public.relatorio_configuracoes(empresa_id, view_type, viewer_role)
  where scope = 'company' and view_type = 'analytical' and ativo = true;

create or replace function public.set_updated_at_relatorio_configuracoes()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_set_updated_at_relatorio_configuracoes
  on public.relatorio_configuracoes;

create trigger trg_set_updated_at_relatorio_configuracoes
before update on public.relatorio_configuracoes
for each row execute function public.set_updated_at_relatorio_configuracoes();

alter table public.relatorio_configuracoes enable row level security;

-- Leitura para usuários autenticados (ajuste conforme sua política de negócio)
drop policy if exists relatorio_configuracoes_select_authenticated on public.relatorio_configuracoes;
create policy relatorio_configuracoes_select_authenticated
on public.relatorio_configuracoes
for select
using (auth.role() = 'authenticated');

-- Escrita restrita a usuários administrativos do projeto
-- Ajuste a função is_admin() para sua base se necessário.
drop policy if exists relatorio_configuracoes_write_admin on public.relatorio_configuracoes;
create policy relatorio_configuracoes_write_admin
on public.relatorio_configuracoes
for all
using (
  auth.role() = 'service_role'
  or coalesce((auth.jwt() ->> 'role'), '') in ('admin', 'administrator')
)
with check (
  auth.role() = 'service_role'
  or coalesce((auth.jwt() ->> 'role'), '') in ('admin', 'administrator')
);
