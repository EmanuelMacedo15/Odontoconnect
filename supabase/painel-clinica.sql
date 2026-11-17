-- =====================================================
-- OdontoConnect — acesso da clínica ao painel
-- Rode DEPOIS de "criar-tabela-agendamentos.sql".
--
-- Antes de rodar:
--   1. Crie o usuário da Dra. Gabriela em
--      Authentication > Users > Add user > Create new user
--      (e-mail + senha, marque "Auto Confirm User").
--   2. Troque o e-mail no FINAL deste arquivo pelo e-mail
--      que você cadastrou.
-- =====================================================


-- -------------------------------
-- QUEM É DA EQUIPE DA CLÍNICA
-- -------------------------------
-- Ter login não basta: só quem estiver nesta tabela
-- consegue ver e alterar agendamentos.

create table if not exists public.equipe_clinica (
    user_id   uuid primary key references auth.users (id) on delete cascade,
    nome      text,
    criado_em timestamptz not null default now()
);

alter table public.equipe_clinica enable row level security;

revoke all on public.equipe_clinica from anon, authenticated;
grant select on public.equipe_clinica to authenticated;

drop policy if exists "Membro vê o próprio cadastro" on public.equipe_clinica;

create policy "Membro vê o próprio cadastro"
    on public.equipe_clinica
    for select
    to authenticated
    using (user_id = auth.uid());


-- Responde se o usuário logado é da equipe
create or replace function public.eh_equipe_clinica()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1 from public.equipe_clinica
        where user_id = auth.uid()
    );
$$;

revoke all on function public.eh_equipe_clinica() from public;
grant execute on function public.eh_equipe_clinica() to authenticated;


-- -------------------------------
-- PERMISSÕES NOS AGENDAMENTOS
-- -------------------------------
-- A equipe pode ver todos e mudar SOMENTE o status
-- (pendente / confirmado / cancelado). Ninguém apaga
-- agendamentos pelo site.

grant select on public.agendamentos to authenticated;
grant update (status) on public.agendamentos to authenticated;

drop policy if exists "Equipe vê agendamentos" on public.agendamentos;

create policy "Equipe vê agendamentos"
    on public.agendamentos
    for select
    to authenticated
    using (public.eh_equipe_clinica());

drop policy if exists "Equipe altera status" on public.agendamentos;

create policy "Equipe altera status"
    on public.agendamentos
    for update
    to authenticated
    using (public.eh_equipe_clinica())
    with check (public.eh_equipe_clinica());


-- -------------------------------
-- CADASTRAR A DRA. GABRIELA
-- -------------------------------
-- Troque o e-mail abaixo pelo e-mail do usuário criado
-- em Authentication > Users.

insert into public.equipe_clinica (user_id, nome)
select id, 'Dra. Gabriela Valois'
from auth.users
where lower(email) = lower('TROQUE-PELO-EMAIL@exemplo.com')
on conflict (user_id) do nothing;


-- Confira: deve aparecer uma linha com o nome dela.
-- Se não aparecer nada, o e-mail acima está diferente
-- do e-mail cadastrado em Authentication > Users.
select e.nome, u.email
from public.equipe_clinica e
join auth.users u on u.id = e.user_id;
