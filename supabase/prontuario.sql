-- =====================================================
-- OdontoConnect — prontuário do paciente
-- Rode DEPOIS de "criar-tabela-agendamentos.sql" e
-- "painel-clinica.sql". Pode rodar mais de uma vez.
--
-- Cria:
--   • pacientes            (cadastro de cada paciente)
--   • anotacoes_consulta   (o que foi feito em cada consulta)
--   • odontograma          (situação de cada dente)
--   • plano_tratamento     (procedimentos indicados)
--   • arquivos_paciente    (radiografias, fotos, PDFs)
--   • pasta "prontuario" no Storage, privada
--
-- Tudo isso só pode ser visto e alterado pela equipe
-- cadastrada em equipe_clinica. Pacientes e visitantes
-- do site não têm acesso.
-- =====================================================


-- -------------------------------
-- PACIENTES
-- -------------------------------
-- Mesma pessoa = mesmo e-mail + mesmo nome.
-- (Uma mãe que agenda para o filho com o próprio e-mail
-- gera dois cadastros: um para ela e outro para o filho.)

create table if not exists public.pacientes (
    id              bigint generated always as identity primary key,
    nome            text not null,
    email           text not null,
    telefone        text,
    data_nascimento date,
    criado_em       timestamptz not null default now()
);

create unique index if not exists pacientes_email_nome_unico
    on public.pacientes ((lower(email)), (lower(trim(nome))));

alter table public.agendamentos
    add column if not exists paciente_id bigint
    references public.pacientes (id) on delete set null;

create index if not exists agendamentos_paciente_idx
    on public.agendamentos (paciente_id);


-- Cada agendamento novo encontra (ou cria) o paciente
-- e guarda o vínculo. Roda no banco, então o site não
-- precisa (nem consegue) mexer na tabela de pacientes.

create or replace function public.vincular_paciente()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_paciente_id bigint;
begin
    insert into public.pacientes (nome, email, telefone, data_nascimento)
    values (
        trim(new.nome_paciente),
        lower(trim(new.email)),
        new.telefone,
        new.data_nascimento
    )
    on conflict ((lower(email)), (lower(trim(nome))))
    do update set
        telefone        = excluded.telefone,
        data_nascimento = coalesce(excluded.data_nascimento, public.pacientes.data_nascimento)
    returning id into v_paciente_id;

    new.paciente_id := v_paciente_id;
    return new;
end;
$$;

revoke all on function public.vincular_paciente() from public;

drop trigger if exists agendamentos_vincular_paciente on public.agendamentos;

create trigger agendamentos_vincular_paciente
    before insert on public.agendamentos
    for each row
    execute function public.vincular_paciente();


-- Agendamentos que já existiam ganham o vínculo agora

insert into public.pacientes (nome, email, telefone, data_nascimento)
select distinct on (lower(trim(email)), lower(trim(nome_paciente)))
    trim(nome_paciente),
    lower(trim(email)),
    telefone,
    data_nascimento
from public.agendamentos
order by lower(trim(email)), lower(trim(nome_paciente)), criado_em desc
on conflict do nothing;

update public.agendamentos a
set paciente_id = p.id
from public.pacientes p
where a.paciente_id is null
  and lower(trim(a.email)) = lower(p.email)
  and lower(trim(a.nome_paciente)) = lower(trim(p.nome));


-- -------------------------------
-- QUEM ALTEROU E QUANDO
-- -------------------------------

create or replace function public.marcar_atualizacao()
returns trigger
language plpgsql
set search_path = public
as $$
begin
    new.atualizado_em  := now();
    new.atualizado_por := auth.uid();
    return new;
end;
$$;


-- -------------------------------
-- ANOTAÇÕES DE CADA CONSULTA
-- -------------------------------

create table if not exists public.anotacoes_consulta (
    agendamento_id bigint primary key
                   references public.agendamentos (id) on delete cascade,
    procedimento   text check (char_length(procedimento) <= 2000),
    dentes         text check (char_length(dentes) <= 200),
    observacoes    text check (char_length(observacoes) <= 5000),
    proximo_passo  text check (char_length(proximo_passo) <= 2000),
    atualizado_em  timestamptz not null default now(),
    atualizado_por uuid references auth.users (id) on delete set null
);

drop trigger if exists anotacoes_marcar_atualizacao on public.anotacoes_consulta;

create trigger anotacoes_marcar_atualizacao
    before insert or update on public.anotacoes_consulta
    for each row execute function public.marcar_atualizacao();


-- -------------------------------
-- ODONTOGRAMA
-- -------------------------------
-- Um registro por dente que NÃO está saudável.
-- Numeração FDI: 11–18, 21–28, 31–38, 41–48.

create table if not exists public.odontograma (
    paciente_id    bigint   not null references public.pacientes (id) on delete cascade,
    dente          smallint not null check (
                       dente between 11 and 18 or dente between 21 and 28 or
                       dente between 31 and 38 or dente between 41 and 48
                   ),
    situacao       text not null check (situacao in (
                       'carie', 'restaurado', 'canal', 'coroa', 'implante',
                       'ausente', 'extracao_indicada', 'fratura'
                   )),
    observacao     text check (char_length(observacao) <= 500),
    atualizado_em  timestamptz not null default now(),
    atualizado_por uuid references auth.users (id) on delete set null,
    primary key (paciente_id, dente)
);

drop trigger if exists odontograma_marcar_atualizacao on public.odontograma;

create trigger odontograma_marcar_atualizacao
    before insert or update on public.odontograma
    for each row execute function public.marcar_atualizacao();


-- -------------------------------
-- PLANO DE TRATAMENTO
-- -------------------------------

create table if not exists public.plano_tratamento (
    id             bigint generated always as identity primary key,
    paciente_id    bigint not null references public.pacientes (id) on delete cascade,
    procedimento   text   not null check (char_length(procedimento) between 1 and 200),
    dente          text   check (char_length(dente) <= 50),
    valor          numeric(10, 2) check (valor >= 0),
    status         text   not null default 'a_fazer'
                   check (status in ('a_fazer', 'em_andamento', 'concluido', 'cancelado')),
    observacao     text   check (char_length(observacao) <= 1000),
    criado_em      timestamptz not null default now(),
    atualizado_em  timestamptz not null default now(),
    atualizado_por uuid references auth.users (id) on delete set null
);

create index if not exists plano_paciente_idx
    on public.plano_tratamento (paciente_id);

drop trigger if exists plano_marcar_atualizacao on public.plano_tratamento;

create trigger plano_marcar_atualizacao
    before insert or update on public.plano_tratamento
    for each row execute function public.marcar_atualizacao();


-- -------------------------------
-- ARQUIVOS (RADIOGRAFIAS, FOTOS, PDFs)
-- -------------------------------

create table if not exists public.arquivos_paciente (
    id           bigint generated always as identity primary key,
    paciente_id  bigint not null references public.pacientes (id) on delete cascade,
    caminho      text   not null unique,
    nome_arquivo text   not null check (char_length(nome_arquivo) <= 200),
    tipo         text,
    tamanho      bigint,
    descricao    text   check (char_length(descricao) <= 300),
    criado_em    timestamptz not null default now(),
    enviado_por  uuid default auth.uid() references auth.users (id) on delete set null
);

create index if not exists arquivos_paciente_idx
    on public.arquivos_paciente (paciente_id);


-- Pasta privada no Storage: até 10 MB por arquivo,
-- só imagens e PDF
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'prontuario',
    'prontuario',
    false,
    10485760,
    array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update set
    public             = false,
    file_size_limit    = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;


-- -------------------------------
-- SEGURANÇA (RLS): SÓ A EQUIPE
-- -------------------------------

alter table public.pacientes          enable row level security;
alter table public.anotacoes_consulta enable row level security;
alter table public.odontograma        enable row level security;
alter table public.plano_tratamento   enable row level security;
alter table public.arquivos_paciente  enable row level security;

revoke all on public.pacientes, public.anotacoes_consulta, public.odontograma,
              public.plano_tratamento, public.arquivos_paciente
    from anon, authenticated;

grant select, update on public.pacientes to authenticated;

grant select, insert, update, delete
    on public.anotacoes_consulta, public.odontograma,
       public.plano_tratamento, public.arquivos_paciente
    to authenticated;

drop policy if exists "Equipe gerencia pacientes" on public.pacientes;
create policy "Equipe gerencia pacientes" on public.pacientes
    for all to authenticated
    using (public.eh_equipe_clinica()) with check (public.eh_equipe_clinica());

drop policy if exists "Equipe gerencia anotações" on public.anotacoes_consulta;
create policy "Equipe gerencia anotações" on public.anotacoes_consulta
    for all to authenticated
    using (public.eh_equipe_clinica()) with check (public.eh_equipe_clinica());

drop policy if exists "Equipe gerencia odontograma" on public.odontograma;
create policy "Equipe gerencia odontograma" on public.odontograma
    for all to authenticated
    using (public.eh_equipe_clinica()) with check (public.eh_equipe_clinica());

drop policy if exists "Equipe gerencia plano" on public.plano_tratamento;
create policy "Equipe gerencia plano" on public.plano_tratamento
    for all to authenticated
    using (public.eh_equipe_clinica()) with check (public.eh_equipe_clinica());

drop policy if exists "Equipe gerencia arquivos" on public.arquivos_paciente;
create policy "Equipe gerencia arquivos" on public.arquivos_paciente
    for all to authenticated
    using (public.eh_equipe_clinica()) with check (public.eh_equipe_clinica());


-- Arquivos dentro da pasta "prontuario" do Storage

drop policy if exists "Equipe vê arquivos do prontuário" on storage.objects;
create policy "Equipe vê arquivos do prontuário" on storage.objects
    for select to authenticated
    using (bucket_id = 'prontuario' and public.eh_equipe_clinica());

drop policy if exists "Equipe envia arquivos do prontuário" on storage.objects;
create policy "Equipe envia arquivos do prontuário" on storage.objects
    for insert to authenticated
    with check (bucket_id = 'prontuario' and public.eh_equipe_clinica());

drop policy if exists "Equipe apaga arquivos do prontuário" on storage.objects;
create policy "Equipe apaga arquivos do prontuário" on storage.objects
    for delete to authenticated
    using (bucket_id = 'prontuario' and public.eh_equipe_clinica());


-- Confira: deve listar os pacientes já cadastrados
select id, nome, email from public.pacientes order by id;
