-- =====================================================
-- OdontoConnect — área do paciente (e-mail + senha)
-- Rode DEPOIS de "prontuario.sql". Pode rodar mais de uma vez.
--
-- Como funciona:
--   1. Primeiro acesso: o paciente entra com o e-mail do
--      agendamento e a senha provisória 0000.
--   2. Antes de ver qualquer dado, ele é obrigado a criar
--      a própria senha (mínimo 6 caracteres).
--   3. Dali em diante entra com e-mail + senha dele.
--   4. Esqueceu a senha: a clínica clica em "Redefinir senha
--      para 0000" no prontuário e o paciente refaz o passo 1.
--
-- • As senhas são guardadas criptografadas (bcrypt).
-- • 5 senhas erradas bloqueiam o e-mail por 15 minutos.
-- • O site só acessa os dados por meio das funções abaixo,
--   que devolvem SÓ as informações daquele paciente.
-- • Mesmo e-mail com mais de um paciente (ex.: mãe e filho):
--   a senha vale para os cadastros em que ela confere, e o
--   site deixa escolher de quem ver as informações.
-- =====================================================

create extension if not exists pgcrypto with schema extensions;


-- -------------------------------
-- LIMPEZA DA VERSÃO ANTERIOR (códigos de acesso)
-- -------------------------------

drop function if exists public.gerar_codigo_paciente(bigint);
drop function if exists public.paciente_tem_acesso(bigint);
drop function if exists public.paciente_dados(text);
drop function if exists public.paciente_dados(text, bigint);
drop function if exists public.paciente_cancelar_consulta(text, bigint);
drop function if exists public.pacientes_permitidos(text);
drop function if exists public.paciente_da_sessao(text);
drop function if exists public.paciente_sair(text);
drop function if exists public.paciente_entrar(text, text);


-- -------------------------------
-- TABELAS INTERNAS (ninguém acessa pelo site)
-- -------------------------------

create table if not exists public.acesso_paciente (
    paciente_id        bigint primary key references public.pacientes (id) on delete cascade,
    codigo_hash        text,
    criado_em          timestamptz not null default now(),
    tentativas_erradas int    not null default 0,
    bloqueado_ate      timestamptz
);

-- Na primeira vez que este script roda, os códigos antigos
-- viram "senha provisória 0000"
do $$
begin
    if not exists (
        select 1 from information_schema.columns
        where table_schema = 'public'
          and table_name = 'acesso_paciente'
          and column_name = 'senha_provisoria'
    ) then
        alter table public.acesso_paciente alter column codigo_hash drop not null;
        alter table public.acesso_paciente add column senha_provisoria boolean not null default true;
        update public.acesso_paciente set codigo_hash = null, senha_provisoria = true;
    end if;
end;
$$;

-- Sessões: um token pode dar acesso a mais de um cadastro
-- (mãe e filho com o mesmo e-mail e a mesma senha)
drop table if exists public.sessoes_paciente;

create table public.sessoes_paciente (
    token_hash  text   not null,
    paciente_id bigint not null references public.pacientes (id) on delete cascade,
    provisoria  boolean not null default false,
    criado_em   timestamptz not null default now(),
    expira_em   timestamptz not null,
    primary key (token_hash, paciente_id)
);

alter table public.acesso_paciente  enable row level security;
alter table public.sessoes_paciente enable row level security;

revoke all on public.acesso_paciente, public.sessoes_paciente from anon, authenticated;


-- -------------------------------
-- AJUDANTES INTERNOS
-- -------------------------------

create or replace function public.hash_token(p_token text)
returns text
language sql
immutable
set search_path = public, extensions
as $$
    select encode(digest(coalesce(p_token, ''), 'sha256'), 'hex');
$$;

revoke all on function public.hash_token(text) from public, anon, authenticated;


-- Pacientes que o token pode ver
create or replace function public.pacientes_da_sessao(p_token text)
returns table (paciente_id bigint, provisoria boolean)
language sql
stable
security definer
set search_path = public, extensions
as $$
    select s.paciente_id, s.provisoria
    from public.sessoes_paciente s
    where s.token_hash = public.hash_token(p_token)
      and s.expira_em > now();
$$;

revoke all on function public.pacientes_da_sessao(text) from public, anon, authenticated;


-- -------------------------------
-- 1. PACIENTE ENTRA (e-mail + senha)
-- -------------------------------
-- Devolve {"token", "nome", "trocar_senha"} ou {"erro"}.
-- Não usa "raise" nos erros para que a contagem de
-- tentativas erradas fique salva.

create or replace function public.paciente_entrar(p_email text, p_senha text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
    v_email      text := lower(trim(coalesce(p_email, '')));
    v_senha      text := coalesce(p_senha, '');
    v_bloqueio   timestamptz;
    v_token      text;
    v_definitiva bigint[];
    v_provisoria bigint[];
    v_nome       text;
begin
    delete from public.sessoes_paciente where expira_em < now();

    if v_email = '' or v_senha = '' then
        return jsonb_build_object('erro', 'dados_invalidos');
    end if;

    -- Todo paciente com este e-mail ganha uma linha de acesso
    -- (assim a contagem de erros funciona desde o 1º acesso)
    insert into public.acesso_paciente (paciente_id)
    select p.id from public.pacientes p
    where lower(p.email) = v_email
    on conflict (paciente_id) do nothing;

    select max(a.bloqueado_ate) into v_bloqueio
    from public.acesso_paciente a
    join public.pacientes p on p.id = a.paciente_id
    where lower(p.email) = v_email
      and a.bloqueado_ate > now();

    if v_bloqueio is not null then
        return jsonb_build_object('erro', 'bloqueado', 'ate', v_bloqueio);
    end if;

    -- Cadastros em que a senha pessoal confere
    select array_agg(a.paciente_id order by a.paciente_id) into v_definitiva
    from public.acesso_paciente a
    join public.pacientes p on p.id = a.paciente_id
    where lower(p.email) = v_email
      and not a.senha_provisoria
      and a.codigo_hash is not null
      and a.codigo_hash = crypt(v_senha, a.codigo_hash);

    -- Cadastros ainda na senha provisória 0000
    if v_definitiva is null and v_senha = '0000' then
        select array_agg(a.paciente_id order by a.paciente_id) into v_provisoria
        from public.acesso_paciente a
        join public.pacientes p on p.id = a.paciente_id
        where lower(p.email) = v_email
          and a.senha_provisoria;
    end if;

    if v_definitiva is null and v_provisoria is null then

        update public.acesso_paciente a
        set tentativas_erradas = case when a.tentativas_erradas + 1 >= 5 then 0
                                      else a.tentativas_erradas + 1 end,
            bloqueado_ate      = case when a.tentativas_erradas + 1 >= 5
                                      then now() + interval '15 minutes'
                                      else a.bloqueado_ate end
        from public.pacientes p
        where p.id = a.paciente_id
          and lower(p.email) = v_email;

        return jsonb_build_object('erro', 'invalido');

    end if;

    update public.acesso_paciente
    set tentativas_erradas = 0, bloqueado_ate = null
    where paciente_id = any(coalesce(v_definitiva, v_provisoria));

    v_token := encode(gen_random_bytes(32), 'hex');

    insert into public.sessoes_paciente (token_hash, paciente_id, provisoria, expira_em)
    select public.hash_token(v_token), x, v_definitiva is null, now() + interval '2 hours'
    from unnest(coalesce(v_definitiva, v_provisoria)) as x;

    select nome into v_nome from public.pacientes
    where id = (coalesce(v_definitiva, v_provisoria))[1];

    return jsonb_build_object(
        'token', v_token,
        'nome', v_nome,
        'trocar_senha', v_definitiva is null
    );
end;
$$;

revoke all on function public.paciente_entrar(text, text) from public;
grant execute on function public.paciente_entrar(text, text) to anon, authenticated;


-- -------------------------------
-- 2. PACIENTE CRIA / TROCA A SENHA
-- -------------------------------
-- • Vindo da senha 0000: não precisa da senha atual.
-- • Já tem senha: precisa informar a senha atual.

create or replace function public.paciente_definir_senha(
    p_token       text,
    p_nova_senha  text,
    p_senha_atual text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
    v_ids        bigint[];
    v_provisoria boolean;
begin
    select array_agg(paciente_id), bool_or(provisoria)
    into v_ids, v_provisoria
    from public.pacientes_da_sessao(p_token);

    if v_ids is null then
        return jsonb_build_object('erro', 'sessao_expirada');
    end if;

    if char_length(coalesce(p_nova_senha, '')) < 6 then
        return jsonb_build_object('erro', 'senha_curta');
    end if;

    if char_length(p_nova_senha) > 72 then
        return jsonb_build_object('erro', 'senha_longa');
    end if;

    if not v_provisoria then
        if not exists (
            select 1 from public.acesso_paciente
            where paciente_id = v_ids[1]
              and codigo_hash = crypt(coalesce(p_senha_atual, ''), codigo_hash)
        ) then
            return jsonb_build_object('erro', 'senha_atual_errada');
        end if;
    end if;

    update public.acesso_paciente
    set codigo_hash = crypt(p_nova_senha, gen_salt('bf')),
        senha_provisoria = false,
        criado_em = now(),
        tentativas_erradas = 0,
        bloqueado_ate = null
    where paciente_id = any(v_ids);

    -- Desconecta outros aparelhos e libera esta sessão
    delete from public.sessoes_paciente
    where paciente_id = any(v_ids)
      and token_hash <> public.hash_token(p_token);

    update public.sessoes_paciente
    set provisoria = false
    where token_hash = public.hash_token(p_token);

    return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.paciente_definir_senha(text, text, text) from public;
grant execute on function public.paciente_definir_senha(text, text, text) to anon, authenticated;


-- -------------------------------
-- 3. DADOS DO PACIENTE
-- -------------------------------
-- NÃO inclui as observações clínicas internas nem os arquivos.
-- p_paciente_id escolhe qual cadastro ver quando há mais de um.

create or replace function public.paciente_dados(
    p_token       text,
    p_paciente_id bigint default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
    v_ids        bigint[];
    v_provisoria boolean;
    v_id         bigint;
begin
    select array_agg(paciente_id order by paciente_id), bool_or(provisoria)
    into v_ids, v_provisoria
    from public.pacientes_da_sessao(p_token);

    if v_ids is null then
        return jsonb_build_object('erro', 'sessao_expirada');
    end if;

    if v_provisoria then
        return jsonb_build_object('erro', 'trocar_senha');
    end if;

    v_id := case when p_paciente_id = any(v_ids) then p_paciente_id else v_ids[1] end;

    return jsonb_build_object(
        'paciente_id', v_id,
        'pacientes_disponiveis', (
            select jsonb_agg(jsonb_build_object('id', p.id, 'nome', p.nome) order by p.id)
            from public.pacientes p
            where p.id = any(v_ids)
        ),
        'paciente', (
            select jsonb_build_object(
                'nome', p.nome, 'email', p.email,
                'telefone', p.telefone, 'data_nascimento', p.data_nascimento
            )
            from public.pacientes p where p.id = v_id
        ),
        'consultas', coalesce((
            select jsonb_agg(jsonb_build_object(
                'id', a.id,
                'data_consulta', a.data_consulta,
                'horario', to_char(a.horario, 'HH24:MI'),
                'tipo_consulta', a.tipo_consulta,
                'status', a.status,
                'procedimento', n.procedimento,
                'dentes', n.dentes,
                'proximo_passo', n.proximo_passo
            ) order by a.data_consulta desc, a.horario desc)
            from public.agendamentos a
            left join public.anotacoes_consulta n on n.agendamento_id = a.id
            where a.paciente_id = v_id
        ), '[]'::jsonb),
        'plano', coalesce((
            select jsonb_agg(jsonb_build_object(
                'procedimento', t.procedimento,
                'dente', t.dente,
                'valor', t.valor,
                'status', t.status
            ) order by t.criado_em)
            from public.plano_tratamento t
            where t.paciente_id = v_id
        ), '[]'::jsonb),
        'odontograma', coalesce((
            select jsonb_agg(jsonb_build_object(
                'dente', o.dente,
                'situacao', o.situacao,
                'observacao', o.observacao
            ) order by o.dente)
            from public.odontograma o
            where o.paciente_id = v_id
        ), '[]'::jsonb)
    );
end;
$$;

revoke all on function public.paciente_dados(text, bigint) from public;
grant execute on function public.paciente_dados(text, bigint) to anon, authenticated;


-- -------------------------------
-- 4. PACIENTE CANCELA UMA CONSULTA FUTURA
-- -------------------------------

create or replace function public.paciente_cancelar_consulta(p_token text, p_agendamento_id bigint)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
    v_linhas int;
begin
    if not exists (select 1 from public.pacientes_da_sessao(p_token) where not provisoria) then
        return jsonb_build_object('erro', 'sessao_expirada');
    end if;

    update public.agendamentos
    set status = 'cancelado'
    where id = p_agendamento_id
      and paciente_id in (select paciente_id from public.pacientes_da_sessao(p_token))
      and status <> 'cancelado'
      and data_consulta >= current_date;

    get diagnostics v_linhas = row_count;

    if v_linhas = 0 then
        return jsonb_build_object('erro', 'nao_permitido');
    end if;

    return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.paciente_cancelar_consulta(text, bigint) from public;
grant execute on function public.paciente_cancelar_consulta(text, bigint) to anon, authenticated;


-- -------------------------------
-- 5. PACIENTE SAI
-- -------------------------------

create or replace function public.paciente_sair(p_token text)
returns void
language sql
volatile
security definer
set search_path = public, extensions
as $$
    delete from public.sessoes_paciente
    where token_hash = public.hash_token(p_token);
$$;

revoke all on function public.paciente_sair(text) from public;
grant execute on function public.paciente_sair(text) to anon, authenticated;


-- -------------------------------
-- 6. CLÍNICA: SITUAÇÃO E REDEFINIÇÃO DA SENHA
-- -------------------------------

-- {"senha_propria": true/false, "desde": data, "bloqueado_ate": data}
create or replace function public.paciente_situacao_senha(p_paciente_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
    v_acesso record;
begin
    if not public.eh_equipe_clinica() then
        raise exception 'Acesso negado';
    end if;

    select senha_provisoria, criado_em, bloqueado_ate into v_acesso
    from public.acesso_paciente where paciente_id = p_paciente_id;

    return jsonb_build_object(
        'senha_propria', coalesce(not v_acesso.senha_provisoria, false),
        'desde', v_acesso.criado_em,
        'bloqueado_ate', case when v_acesso.bloqueado_ate > now() then v_acesso.bloqueado_ate end
    );
end;
$$;

revoke all on function public.paciente_situacao_senha(bigint) from public, anon, authenticated;
grant execute on function public.paciente_situacao_senha(bigint) to authenticated;


-- Volta a senha do paciente para 0000 e desconecta ele
create or replace function public.redefinir_senha_paciente(p_paciente_id bigint)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
    if not public.eh_equipe_clinica() then
        raise exception 'Acesso negado';
    end if;

    insert into public.acesso_paciente (paciente_id, codigo_hash, senha_provisoria)
    values (p_paciente_id, null, true)
    on conflict (paciente_id) do update set
        codigo_hash        = null,
        senha_provisoria   = true,
        criado_em          = now(),
        tentativas_erradas = 0,
        bloqueado_ate      = null;

    -- Libera o bloqueio de tentativas erradas do e-mail inteiro
    -- (ex.: mãe e filho com o mesmo e-mail)
    update public.acesso_paciente
    set tentativas_erradas = 0, bloqueado_ate = null
    where paciente_id in (
        select p.id from public.pacientes p
        where lower(p.email) = (
            select lower(email) from public.pacientes where id = p_paciente_id
        )
    );

    delete from public.sessoes_paciente where paciente_id = p_paciente_id;

    return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.redefinir_senha_paciente(bigint) from public, anon, authenticated;
grant execute on function public.redefinir_senha_paciente(bigint) to authenticated;
