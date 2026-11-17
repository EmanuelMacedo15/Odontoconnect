// =====================================================
// ÁREA DO PACIENTE (site) — e-mail + senha
//
// 1. Primeiro acesso: e-mail do agendamento + senha 0000.
// 2. Antes de ver os dados, o paciente cria a própria senha.
// 3. Dali em diante entra com e-mail + a senha dele.
// 4. Esqueceu: a clínica redefine para 0000 no painel.
//
// Os dados vêm de funções do banco (supabase/area-paciente.sql)
// que só devolvem as informações daquele paciente.
// Tudo que vem do banco entra na página com textContent.
// =====================================================

(function() {

    const caixaAcesso = document.getElementById("form-acesso-paciente");

    if (!caixaAcesso) {
        return;
    }

    const tituloAcesso = document.getElementById("titulo-acesso");
    const textoAcesso = document.getElementById("texto-acesso");

    const etapaLogin = document.getElementById("etapa-login");
    const campoEmail = document.getElementById("email-acesso");
    const campoSenha = document.getElementById("senha-acesso");
    const btnEntrar = document.getElementById("btn-entrar-paciente");
    const dicaPrimeiroAcesso = document.getElementById("dica-primeiro-acesso");

    const etapaCriarSenha = document.getElementById("etapa-criar-senha");
    const campoNovaSenha = document.getElementById("nova-senha");
    const campoRepetirSenha = document.getElementById("repetir-senha");
    const btnCriarSenha = document.getElementById("btn-criar-senha");

    const infoAcesso = document.getElementById("info-acesso");
    const erroAcesso = document.getElementById("erro-acesso");
    const ajudaAcesso = document.getElementById("ajuda-acesso");

    const barraLogado = document.getElementById("paciente-logado");
    const btnSair = document.getElementById("btn-sair-paciente");
    const btnAlterarSenha = document.getElementById("btn-alterar-senha");
    const escolherPaciente = document.getElementById("escolher-paciente");

    const formAlterar = document.getElementById("form-alterar-senha");
    const campoSenhaAtual = document.getElementById("senha-atual");
    const campoAlterarNova = document.getElementById("alterar-nova-senha");
    const campoAlterarRepetir = document.getElementById("alterar-repetir-senha");
    const btnSalvarAlteracao = document.getElementById("btn-salvar-alteracao");
    const btnCancelarAlteracao = document.getElementById("btn-cancelar-alteracao");
    const erroAlterar = document.getElementById("erro-alterar");

    const areas = {
        consultas: {
            info: document.getElementById("info-consultas"),
            botao: document.getElementById("btn-consultas")
        },
        prontuario: {
            info: document.getElementById("info-prontuario"),
            botao: document.getElementById("btn-prontuario")
        },
        plano: {
            info: document.getElementById("info-plano"),
            botao: document.getElementById("btn-plano")
        },
        orcamentos: {
            info: document.getElementById("info-orcamentos"),
            botao: document.getElementById("btn-orcamentos")
        }
    };

    const NUMERO_WHATSAPP_CLINICA = "5581988042614";
    const CHAVE_SESSAO = "odontoconnect_sessao_paciente";
    const SENHA_MINIMA = 6;

    const conectado = typeof supabaseClient !== "undefined" && !!supabaseClient.rpc;

    let pacienteEscolhido = null;


    // ===============================
    // SESSÃO (fica salva só nesta aba do navegador)
    // ===============================

    function lerSessao() {
        try {
            return sessionStorage.getItem(CHAVE_SESSAO);
        } catch (e) {
            return null;
        }
    }

    function salvarSessao(token) {
        try {
            sessionStorage.setItem(CHAVE_SESSAO, token);
        } catch (e) {
            // navegador sem armazenamento: funciona até recarregar
        }
    }

    function apagarSessao() {
        try {
            sessionStorage.removeItem(CHAVE_SESSAO);
        } catch (e) {
            // nada a fazer
        }
    }

    let tokenAtual = lerSessao();


    // ===============================
    // AJUDANTES
    // ===============================

    function el(tag, classe, texto) {

        const elemento = document.createElement(tag);

        if (classe) {
            elemento.className = classe;
        }

        if (texto !== undefined && texto !== null) {
            elemento.textContent = texto;
        }

        return elemento;

    }

    function limpar(elemento) {
        while (elemento.firstChild) {
            elemento.removeChild(elemento.firstChild);
        }
    }

    function hojeISO() {
        const d = new Date();
        return d.getFullYear() + "-" +
            String(d.getMonth() + 1).padStart(2, "0") + "-" +
            String(d.getDate()).padStart(2, "0");
    }

    const diasSemana = [
        "Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira",
        "Quinta-feira", "Sexta-feira", "Sábado"
    ];

    function dataBR(textoISO) {
        const p = textoISO.split("-");
        return p[2] + "/" + p[1] + "/" + p[0];
    }

    function dataComDia(textoISO) {
        const p = textoISO.split("-");
        const d = new Date(+p[0], +p[1] - 1, +p[2]);
        return diasSemana[d.getDay()] + ", " + dataBR(textoISO);
    }

    const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

    function emReais(valor) {
        return reais.format(Number(valor) || 0);
    }

    function abrirArea(chave) {

        const area = areas[chave];

        if (area.info && area.botao) {
            area.info.classList.add("mostrar");
            area.botao.textContent = "Fechar";
        }

    }

    function fecharTodas() {

        Object.keys(areas).forEach(function(chave) {
            const area = areas[chave];
            if (area.info && area.botao) {
                area.info.classList.remove("mostrar");
                area.botao.textContent = "Acessar";
            }
        });

    }

    function chamar(funcao, parametros) {

        return supabaseClient.rpc(funcao, parametros).then(function(resposta) {
            if (resposta.error) {
                throw resposta.error;
            }
            return resposta.data;
        });

    }

    function mostrarErro(texto) {
        erroAcesso.textContent = texto || "";
        if (texto) {
            infoAcesso.textContent = "";
        }
    }

    function mostrarInfo(texto) {
        infoAcesso.textContent = texto || "";
    }

    // Confere a nova senha digitada duas vezes
    function problemaNaSenha(nova, repetida) {

        if (nova.length < SENHA_MINIMA) {
            return "A senha precisa ter pelo menos " + SENHA_MINIMA + " caracteres.";
        }

        if (/^0+$/.test(nova)) {
            return "Escolha uma senha diferente da senha provisória.";
        }

        if (nova !== repetida) {
            return "As duas senhas não são iguais. Digite de novo.";
        }

        return null;

    }

    function mensagemErroSenha(erro) {

        return {
            senha_curta: "A senha precisa ter pelo menos " + SENHA_MINIMA + " caracteres.",
            senha_longa: "A senha é longa demais. Use até 72 caracteres.",
            senha_atual_errada: "A senha atual está incorreta.",
            sessao_expirada: "Sua sessão expirou. Entre novamente."
        }[erro] || "Não foi possível salvar a senha. Tente novamente.";

    }


    // ===============================
    // TELAS DO ACESSO
    // ===============================

    function telaLogin() {

        tituloAcesso.textContent = "🔒 Entre na sua área";
        textoAcesso.textContent = "Use o e-mail que você informou no agendamento e a sua senha.";

        etapaLogin.hidden = false;
        dicaPrimeiroAcesso.hidden = false;
        ajudaAcesso.hidden = false;
        etapaCriarSenha.hidden = true;

    }

    function telaCriarSenha() {

        tituloAcesso.textContent = "🔑 Crie sua senha";
        textoAcesso.textContent =
            "Este é o seu primeiro acesso. Crie uma senha pessoal para proteger suas informações. " +
            "Nas próximas vezes, entre com o seu e-mail e essa senha.";

        etapaLogin.hidden = true;
        dicaPrimeiroAcesso.hidden = true;
        ajudaAcesso.hidden = true;
        etapaCriarSenha.hidden = false;

        campoNovaSenha.value = "";
        campoRepetirSenha.value = "";
        campoNovaSenha.focus();

    }


    // ===============================
    // DESLOGADO
    // ===============================

    const textosDeslogado = {
        consultas: "suas consultas",
        prontuario: "seu prontuário",
        plano: "seu plano de tratamento",
        orcamentos: "seus orçamentos"
    };

    function mostrarDeslogado(mensagem) {

        pacienteEscolhido = null;

        caixaAcesso.hidden = false;
        barraLogado.hidden = true;
        escolherPaciente.hidden = true;
        formAlterar.hidden = true;

        telaLogin();
        mostrarInfo("");
        mostrarErro(mensagem || "");

        Object.keys(areas).forEach(function(chave) {

            const info = areas[chave].info;

            if (!info) {
                return;
            }

            limpar(info);

            const texto = el("p", "texto-area-paciente");
            texto.appendChild(
                document.createTextNode(
                    "Entre com seu e-mail e senha para ver " + textosDeslogado[chave] + ". "
                )
            );

            const link = el("a", "link-area-paciente", "Entrar");
            link.href = "#acesso-paciente";
            link.addEventListener("click", function() {
                setTimeout(function() { campoEmail.focus(); }, 300);
            });

            texto.appendChild(link);
            info.appendChild(texto);

        });

    }


    // ===============================
    // ENTRAR
    // ===============================

    etapaLogin.addEventListener("submit", function(evento) {

        evento.preventDefault();
        mostrarErro("");

        const email = campoEmail.value.trim();
        const senha = campoSenha.value;

        if (!email || !senha) {
            mostrarErro("Preencha o e-mail e a senha.");
            return;
        }

        if (!conectado) {
            mostrarErro("Sem conexão com o servidor. Verifique a internet e recarregue a página.");
            return;
        }

        btnEntrar.disabled = true;
        btnEntrar.textContent = "Entrando...";

        chamar("paciente_entrar", { p_email: email, p_senha: senha })
            .then(function(resposta) {

                if (resposta && resposta.token) {

                    tokenAtual = resposta.token;
                    salvarSessao(tokenAtual);
                    campoSenha.value = "";

                    if (resposta.trocar_senha) {
                        telaCriarSenha();
                        return;
                    }

                    return carregarDados(true);

                }

                if (resposta && resposta.erro === "bloqueado") {

                    const ate = new Date(resposta.ate);

                    mostrarErro(
                        "Muitas tentativas erradas. Tente novamente depois das " +
                        String(ate.getHours()).padStart(2, "0") + ":" +
                        String(ate.getMinutes()).padStart(2, "0") + "."
                    );

                } else {

                    mostrarErro(
                        "E-mail ou senha incorretos. No primeiro acesso, use a senha 0000 " +
                        "e o mesmo e-mail do agendamento."
                    );

                }

            })
            .catch(function(erro) {
                console.error(erro);
                mostrarErro("Não foi possível entrar agora. Tente novamente.");
            })
            .finally(function() {
                btnEntrar.disabled = false;
                btnEntrar.textContent = "Entrar";
            });

    });


    // ===============================
    // CRIAR A PRÓPRIA SENHA (1º ACESSO)
    // ===============================

    etapaCriarSenha.addEventListener("submit", function(evento) {

        evento.preventDefault();
        mostrarErro("");

        const problema = problemaNaSenha(campoNovaSenha.value, campoRepetirSenha.value);

        if (problema) {
            mostrarErro(problema);
            campoNovaSenha.focus();
            return;
        }

        btnCriarSenha.disabled = true;
        btnCriarSenha.textContent = "Salvando...";

        chamar("paciente_definir_senha", {
            p_token: tokenAtual,
            p_nova_senha: campoNovaSenha.value
        })
            .then(function(resposta) {

                if (!resposta || !resposta.ok) {

                    if (resposta && resposta.erro === "sessao_expirada") {
                        tokenAtual = null;
                        apagarSessao();
                        mostrarDeslogado(mensagemErroSenha("sessao_expirada"));
                        return;
                    }

                    mostrarErro(mensagemErroSenha(resposta && resposta.erro));
                    return;

                }

                campoNovaSenha.value = "";
                campoRepetirSenha.value = "";

                return carregarDados(true).then(function() {
                    window.alert(
                        "Senha criada! Nas próximas vezes, entre com o seu e-mail e a senha que você acabou de criar."
                    );
                });

            })
            .catch(function(erro) {
                console.error(erro);
                mostrarErro("Não foi possível salvar a senha. Tente novamente.");
            })
            .finally(function() {
                btnCriarSenha.disabled = false;
                btnCriarSenha.textContent = "Salvar senha";
            });

    });


    // ===============================
    // ALTERAR SENHA (JÁ LOGADO)
    // ===============================

    btnAlterarSenha.addEventListener("click", function() {

        formAlterar.hidden = !formAlterar.hidden;
        erroAlterar.textContent = "";

        if (!formAlterar.hidden) {
            campoSenhaAtual.value = "";
            campoAlterarNova.value = "";
            campoAlterarRepetir.value = "";
            campoSenhaAtual.focus();
        }

    });

    btnCancelarAlteracao.addEventListener("click", function() {
        formAlterar.hidden = true;
    });

    formAlterar.addEventListener("submit", function(evento) {

        evento.preventDefault();
        erroAlterar.textContent = "";

        if (!campoSenhaAtual.value) {
            erroAlterar.textContent = "Digite a sua senha atual.";
            campoSenhaAtual.focus();
            return;
        }

        const problema = problemaNaSenha(campoAlterarNova.value, campoAlterarRepetir.value);

        if (problema) {
            erroAlterar.textContent = problema;
            campoAlterarNova.focus();
            return;
        }

        btnSalvarAlteracao.disabled = true;
        btnSalvarAlteracao.textContent = "Salvando...";

        chamar("paciente_definir_senha", {
            p_token: tokenAtual,
            p_nova_senha: campoAlterarNova.value,
            p_senha_atual: campoSenhaAtual.value
        })
            .then(function(resposta) {

                if (!resposta || !resposta.ok) {

                    if (resposta && resposta.erro === "sessao_expirada") {
                        tokenAtual = null;
                        apagarSessao();
                        fecharTodas();
                        mostrarDeslogado(mensagemErroSenha("sessao_expirada"));
                        return;
                    }

                    erroAlterar.textContent = mensagemErroSenha(resposta && resposta.erro);
                    return;

                }

                formAlterar.hidden = true;
                window.alert("Senha alterada com sucesso!");

            })
            .catch(function(erro) {
                console.error(erro);
                erroAlterar.textContent = "Não foi possível salvar a senha. Tente novamente.";
            })
            .finally(function() {
                btnSalvarAlteracao.disabled = false;
                btnSalvarAlteracao.textContent = "Salvar nova senha";
            });

    });


    // ===============================
    // SAIR
    // ===============================

    btnSair.addEventListener("click", function() {

        const token = tokenAtual;

        tokenAtual = null;
        apagarSessao();
        fecharTodas();
        mostrarDeslogado();

        if (token && conectado) {
            chamar("paciente_sair", { p_token: token }).catch(function() {});
        }

    });


    // ===============================
    // CARREGAR DADOS
    // ===============================

    // "Olá, Francisco!" ou, quando o e-mail tem mais de um
    // cadastro, "Você está vendo as informações de Pedro."
    function escreverSaudacao(dados) {

        const frase = barraLogado.querySelector("p");
        const primeiroNome = (dados.paciente.nome || "").split(" ")[0];
        const varios = dados.pacientes_disponiveis && dados.pacientes_disponiveis.length > 1;

        limpar(frase);

        if (varios) {
            frase.appendChild(document.createTextNode("Você está vendo as informações de "));
            frase.appendChild(el("strong", null, primeiroNome));
            frase.appendChild(document.createTextNode("."));
        } else {
            frase.appendChild(document.createTextNode("Olá, "));
            frase.appendChild(el("strong", null, primeiroNome));
            frase.appendChild(document.createTextNode("! Suas informações estão abaixo."));
        }

    }

    function desenharEscolha(disponiveis, idAtual) {

        limpar(escolherPaciente);

        if (!disponiveis || disponiveis.length < 2) {
            escolherPaciente.hidden = true;
            return;
        }

        escolherPaciente.hidden = false;
        escolherPaciente.appendChild(el("span", null, "Ver informações de:"));

        disponiveis.forEach(function(p) {

            const botao = el(
                "button",
                "opcao-paciente" + (p.id === idAtual ? " ativa" : ""),
                p.nome
            );

            botao.type = "button";
            botao.setAttribute("aria-pressed", p.id === idAtual ? "true" : "false");

            botao.addEventListener("click", function() {
                if (p.id !== idAtual) {
                    pacienteEscolhido = p.id;
                    carregarDados(false);
                }
            });

            escolherPaciente.appendChild(botao);

        });

    }

    function carregarDados(acabouDeEntrar) {

        return chamar("paciente_dados", {
            p_token: tokenAtual,
            p_paciente_id: pacienteEscolhido
        })
            .then(function(dados) {

                if (dados && dados.erro === "trocar_senha") {
                    caixaAcesso.hidden = false;
                    barraLogado.hidden = true;
                    telaCriarSenha();
                    return;
                }

                if (!dados || dados.erro) {
                    tokenAtual = null;
                    apagarSessao();
                    fecharTodas();
                    mostrarDeslogado("Sua sessão expirou. Entre novamente.");
                    return;
                }

                pacienteEscolhido = dados.paciente_id;

                caixaAcesso.hidden = true;
                barraLogado.hidden = false;
                mostrarErro("");
                mostrarInfo("");

                escreverSaudacao(dados);
                desenharEscolha(dados.pacientes_disponiveis, dados.paciente_id);
                desenharConsultas(dados.consultas);
                desenharProntuario(dados.odontograma, dados.consultas);
                desenharPlano(dados.plano);
                desenharOrcamentos(dados.plano);

                if (acabouDeEntrar) {
                    abrirArea("consultas");
                }

            })
            .catch(function(erro) {

                console.error(erro);

                mostrarDeslogado(
                    "Não foi possível carregar suas informações. Recarregue a página e tente de novo."
                );

            });

    }


    // ===============================
    // MINHAS CONSULTAS
    // ===============================

    function seloConsulta(consulta) {

        const jaPassou = consulta.data_consulta < hojeISO();

        if (consulta.status === "cancelado") {
            return ["Cancelada", "selo-pac-cancelado"];
        }

        if (jaPassou) {
            return consulta.status === "confirmado"
                ? ["Realizada", "selo-pac-realizado"]
                : ["Não confirmada", "selo-pac-cancelado"];
        }

        return consulta.status === "confirmado"
            ? ["Confirmada", "selo-pac-confirmado"]
            : ["Aguardando confirmação", "selo-pac-pendente"];

    }

    function linhaConsulta(consulta, podeCancelar) {

        const linha = el("div", "item-pac");

        const topo = el("div", "item-pac-topo");
        topo.appendChild(
            el("strong", null, dataComDia(consulta.data_consulta) + " às " + consulta.horario)
        );

        const selo = seloConsulta(consulta);
        topo.appendChild(el("span", "selo-pac " + selo[1], selo[0]));
        linha.appendChild(topo);

        linha.appendChild(el("span", "item-pac-detalhe", consulta.tipo_consulta));

        if (podeCancelar) {

            const btnCancelar = el("button", "btn-pac-cancelar", "Cancelar consulta");
            btnCancelar.type = "button";

            btnCancelar.addEventListener("click", function() {
                cancelarConsulta(consulta, btnCancelar, linha);
            });

            linha.appendChild(btnCancelar);

        }

        return linha;

    }

    function desenharConsultas(consultas) {

        const info = areas.consultas.info;
        limpar(info);

        const hoje = hojeISO();

        const proximas = consultas
            .filter(function(c) { return c.data_consulta >= hoje && c.status !== "cancelado"; })
            .reverse(); // a mais próxima primeiro

        const anteriores = consultas.filter(function(c) {
            return c.data_consulta < hoje || c.status === "cancelado";
        });

        info.appendChild(el("h4", "titulo-area-pac", "Próximas consultas"));

        if (proximas.length === 0) {

            const vazio = el("p", "texto-area-paciente", "Você não tem consultas marcadas. ");
            const link = el("a", "link-area-paciente", "Agendar uma consulta");
            link.href = "#agendamento";
            vazio.appendChild(link);
            info.appendChild(vazio);

        } else {

            proximas.forEach(function(c) {
                info.appendChild(linhaConsulta(c, true));
            });

        }

        if (anteriores.length) {

            info.appendChild(el("h4", "titulo-area-pac", "Histórico"));

            anteriores.forEach(function(c) {
                info.appendChild(linhaConsulta(c, false));
            });

        }

    }

    function cancelarConsulta(consulta, botao, linha) {

        const confirmou = window.confirm(
            "Cancelar sua consulta de " + dataComDia(consulta.data_consulta) +
            " às " + consulta.horario + "?\n\nO horário ficará livre para outra pessoa."
        );

        if (!confirmou) {
            return;
        }

        botao.disabled = true;
        botao.textContent = "Cancelando...";

        chamar("paciente_cancelar_consulta", {
            p_token: tokenAtual,
            p_agendamento_id: consulta.id
        })
            .then(function(resposta) {

                if (!resposta || !resposta.ok) {

                    if (resposta && resposta.erro === "sessao_expirada") {
                        return carregarDados(false);
                    }

                    botao.disabled = false;
                    botao.textContent = "Cancelar consulta";
                    window.alert("Não foi possível cancelar esta consulta. Fale com a clínica pelo WhatsApp.");
                    return;

                }

                // Aviso para a clínica
                const mensagem =
                    "Olá, Dra. Gabriela! Cancelei pelo site a minha consulta de " +
                    dataComDia(consulta.data_consulta) + " às " + consulta.horario +
                    " (" + consulta.tipo_consulta + ").";

                const aviso = el("div", "aviso-cancelamento");
                aviso.appendChild(el("p", null, "Consulta cancelada. Quer avisar a clínica?"));

                const link = el("a", "link-whatsapp-pac", "Avisar pelo WhatsApp");
                link.href = "https://wa.me/" + NUMERO_WHATSAPP_CLINICA + "?text=" + encodeURIComponent(mensagem);
                link.target = "_blank";
                link.rel = "noopener";
                aviso.appendChild(link);

                return carregarDados(false).then(function() {
                    areas.consultas.info.insertBefore(aviso, areas.consultas.info.firstChild);
                });

            })
            .catch(function(erro) {
                console.error(erro);
                botao.disabled = false;
                botao.textContent = "Cancelar consulta";
                window.alert("Não foi possível cancelar agora. Tente novamente.");
            });

    }


    // ===============================
    // MEU PRONTUÁRIO
    // ===============================

    const situacoes = {
        carie:             ["Cárie", "●"],
        restaurado:        ["Restaurado", "R"],
        canal:             ["Tratamento de canal", "C"],
        coroa:             ["Coroa / prótese", "P"],
        implante:          ["Implante", "I"],
        extracao_indicada: ["Extração indicada", "E"],
        fratura:           ["Fratura", "F"],
        ausente:           ["Ausente / extraído", "✕"]
    };

    const posicoes = {
        1: "Incisivo central", 2: "Incisivo lateral", 3: "Canino",
        4: "1º pré-molar", 5: "2º pré-molar", 6: "1º molar",
        7: "2º molar", 8: "3º molar (siso)"
    };

    const quadrantes = {
        1: "superior direito", 2: "superior esquerdo",
        3: "inferior esquerdo", 4: "inferior direito"
    };

    function nomeDente(numero) {
        return posicoes[numero % 10] + " " + quadrantes[Math.floor(numero / 10)];
    }

    function desenharProntuario(odontograma, consultas) {

        const info = areas.prontuario.info;
        limpar(info);

        const realizados = consultas.filter(function(c) {
            return c.procedimento || c.proximo_passo;
        });

        if (odontograma.length === 0 && realizados.length === 0) {
            info.appendChild(
                el("p", "texto-area-paciente", "Ainda não há registros no seu prontuário.")
            );
            return;
        }

        if (odontograma.length) {

            info.appendChild(el("h4", "titulo-area-pac", "Situação dos dentes"));

            odontograma.forEach(function(d) {

                const s = situacoes[d.situacao] || [d.situacao, "?"];
                const linha = el("div", "item-pac item-dente-pac");

                linha.appendChild(el("span", "simbolo-dente-pac sit-" + d.situacao, s[1]));

                const texto = el("div");
                texto.appendChild(el("strong", null, "Dente " + d.dente + " · " + s[0]));
                texto.appendChild(
                    el("span", "item-pac-detalhe", nomeDente(d.dente) + (d.observacao ? " — " + d.observacao : ""))
                );

                linha.appendChild(texto);
                info.appendChild(linha);

            });

        }

        if (realizados.length) {

            info.appendChild(el("h4", "titulo-area-pac", "Procedimentos realizados"));

            realizados.forEach(function(c) {

                const linha = el("div", "item-pac");
                linha.appendChild(el("strong", null, dataBR(c.data_consulta) + " · " + c.tipo_consulta));

                if (c.procedimento) {
                    linha.appendChild(
                        el("span", "item-pac-detalhe", c.procedimento + (c.dentes ? " (dentes " + c.dentes + ")" : ""))
                    );
                }

                if (c.proximo_passo) {
                    linha.appendChild(el("span", "item-pac-proximo", "Próximo passo: " + c.proximo_passo));
                }

                info.appendChild(linha);

            });

        }

    }


    // ===============================
    // PLANO DE TRATAMENTO
    // ===============================

    const statusPlano = {
        a_fazer: ["A fazer", "selo-pac-pendente"],
        em_andamento: ["Em andamento", "selo-pac-andamento"],
        concluido: ["Concluído", "selo-pac-confirmado"],
        cancelado: ["Cancelado", "selo-pac-cancelado"]
    };

    function desenharPlano(plano) {

        const info = areas.plano.info;
        limpar(info);

        const ativos = plano.filter(function(p) { return p.status !== "cancelado"; });

        if (ativos.length === 0) {
            info.appendChild(
                el("p", "texto-area-paciente", "Ainda não há um plano de tratamento para você.")
            );
            return;
        }

        const concluidos = ativos.filter(function(p) { return p.status === "concluido"; }).length;
        const porcentagem = Math.round((concluidos / ativos.length) * 100);

        const progresso = el("div", "progresso-pac");
        progresso.appendChild(
            el("span", null, concluidos + " de " + ativos.length + " procedimentos concluídos")
        );

        const barra = el("div", "barra-pac");
        const preenchido = el("div", "barra-pac-preenchida");
        preenchido.style.width = porcentagem + "%";
        barra.appendChild(preenchido);
        barra.setAttribute("role", "progressbar");
        barra.setAttribute("aria-valuenow", String(porcentagem));
        barra.setAttribute("aria-valuemin", "0");
        barra.setAttribute("aria-valuemax", "100");
        progresso.appendChild(barra);

        info.appendChild(progresso);

        ativos.forEach(function(p) {

            const linha = el("div", "item-pac");
            const topo = el("div", "item-pac-topo");
            topo.appendChild(el("strong", null, p.procedimento));

            const s = statusPlano[p.status];
            topo.appendChild(el("span", "selo-pac " + s[1], s[0]));

            linha.appendChild(topo);

            if (p.dente) {
                linha.appendChild(el("span", "item-pac-detalhe", "Dente(s): " + p.dente));
            }

            info.appendChild(linha);

        });

    }


    // ===============================
    // ORÇAMENTOS
    // ===============================

    function desenharOrcamentos(plano) {

        const info = areas.orcamentos.info;
        limpar(info);

        const comValor = plano.filter(function(p) {
            return p.status !== "cancelado" && p.valor !== null;
        });

        if (comValor.length === 0) {
            info.appendChild(
                el("p", "texto-area-paciente", "Nenhum orçamento disponível no momento.")
            );
            return;
        }

        const soma = function(lista) {
            return lista.reduce(function(t, p) { return t + Number(p.valor); }, 0);
        };

        const realizado = comValor.filter(function(p) { return p.status === "concluido"; });
        const aRealizar = comValor.filter(function(p) { return p.status !== "concluido"; });

        const tabela = el("table", "tabela-orcamento");
        const cabecalho = el("tr");
        cabecalho.appendChild(el("th", null, "Procedimento"));
        cabecalho.appendChild(el("th", "coluna-valor", "Valor"));
        tabela.appendChild(cabecalho);

        comValor.forEach(function(p) {

            const linha = el("tr", p.status === "concluido" ? "linha-concluida" : null);

            const nome = el("td");
            nome.appendChild(el("span", null, p.procedimento));

            if (p.status === "concluido") {
                nome.appendChild(el("span", "marca-concluido", " ✓ concluído"));
            }

            linha.appendChild(nome);
            linha.appendChild(el("td", "coluna-valor", emReais(p.valor)));
            tabela.appendChild(linha);

        });

        info.appendChild(tabela);

        const totais = el("div", "totais-orcamento");

        [
            ["Total do tratamento", soma(comValor), "total-destaque"],
            ["Já realizado", soma(realizado), null],
            ["A realizar", soma(aRealizar), null]
        ].forEach(function(item) {
            const linha = el("div", "linha-total" + (item[2] ? " " + item[2] : ""));
            linha.appendChild(el("span", null, item[0]));
            linha.appendChild(el("strong", null, emReais(item[1])));
            totais.appendChild(linha);
        });

        info.appendChild(totais);

        info.appendChild(
            el(
                "p",
                "nota-orcamento",
                "Valores informados pela clínica. Formas de pagamento: consulte a clínica."
            )
        );

    }


    // ===============================
    // AO ABRIR A PÁGINA
    // ===============================
    // Se o paciente já tinha entrado nesta aba, continua logado.

    mostrarDeslogado();

    if (tokenAtual && conectado) {
        carregarDados(false);
    }

})();
