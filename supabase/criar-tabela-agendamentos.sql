-- =====================================================
-- OdontoConnect — tabela de agendamentos
-- Como usar: no painel do Supabase, abra "SQL Editor",
-- cole este arquivo inteiro e clique em "Run".
-- =====================================================


-- -------------------------------
-- TABELA
-- -------------------------------

create table if not exists public.agendamentos (
    id                  bigint generated always as identity primary key,
    criado_em           timestamptz not null default now(),

    -- Consulta
    data_consulta       date        not null,
    horario             time        not null,
    tipo_consulta       text        not null check (char_length(tipo_consulta) <= 120),
    primeira_consulta   boolean,
    observacoes         text        check (char_length(observacoes) <= 1000),

    -- Paciente
    nome_paciente       text        not null check (char_length(nome_paciente) between 3 and 120),
    data_nascimento     date,
    telefone            text        not null check (char_length(telefone) <= 20),
    email               text        not null check (char_length(email) <= 200),
    aceita_comunicacoes boolean     not null default false,

    -- Situação: o site sempre cria como "pendente";
    -- a clínica muda para "confirmado" ou "cancelado"
    status              text        not null default 'pendente'
                        check (status in ('pendente', 'confirmado', 'cancelado'))
);


-- Impede dois agendamentos no mesmo dia e horário.
-- Agendamentos cancelados liberam o horário de novo.
create unique index if not exists agendamentos_horario_unico
    on public.agendamentos (data_consulta, horario)
    where status <> 'cancelado';


-- -------------------------------
-- SEGURANÇA (RLS)
-- -------------------------------
-- A chave publicável fica no site, então qualquer pessoa
-- pode usá-la. Com o RLS ligado, ela só consegue CRIAR
-- agendamentos novos: não consegue ler, alterar nem apagar
-- os dados dos pacientes.

alter table public.agendamentos enable row level security;

revoke all on public.agendamentos from anon, authenticated;
grant insert on public.agendamentos to anon, authenticated;

drop policy if exists "Site pode criar agendamentos" on public.agendamentos;

create policy "Site pode criar agendamentos"
    on public.agendamentos
    for insert
    to anon, authenticated
    with check (
        status = 'pendente'
        and data_consulta >= current_date
    );


-- -------------------------------
-- HORÁRIOS OCUPADOS
-- -------------------------------
-- O calendário precisa saber quais horários já estão
-- reservados, mas sem ver quem reservou. Esta função
-- devolve só a data e o horário.

create or replace function public.horarios_ocupados(inicio date, fim date)
returns table (data_consulta date, horario time)
language sql
stable
security definer
set search_path = public
as $$
    select a.data_consulta, a.horario
    from public.agendamentos a
    where a.status <> 'cancelado'
      and a.data_consulta between inicio and fim;
$$;

revoke all on function public.horarios_ocupados(date, date) from public;
grant execute on function public.horarios_ocupados(date, date) to anon, authenticated;
