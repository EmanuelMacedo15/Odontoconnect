// =====================================================
// PRONTUÁRIO DO PACIENTE (painel da clínica)
// Usa funções definidas no Painel.html:
// criarElemento, dataBrasileira, hojeISO, lerDataISO,
// formatarDataISO, linkWhatsappPaciente
//
// Todo texto digitado (pelo paciente ou pela clínica)
// entra na página com textContent, nunca innerHTML.
// =====================================================


// ===============================
// ELEMENTOS
// ===============================

const modalProntuario = document.getElementById("modal-prontuario");
const prontuarioNome = document.getElementById("prontuario-nome");
const prontuarioContato = document.getElementById("prontuario-contato");
const prontuarioConteudo = document.getElementById("prontuario-conteudo");
const abasProntuario = document.querySelectorAll(".aba-prontuario");

let pacienteAtual = null;
let agendamentoOrigem = null;
let abaAtual = "consultas";

// Evita que uma resposta antiga do servidor
// desenhe por cima de uma aba que já foi trocada
let numeroCarregamento = 0;


// ===============================
// AJUDANTES
// ===============================

function limpar(elemento) {
    while (elemento.firstChild) {
        elemento.removeChild(elemento.firstChild);
    }
}

function avisoEm(container, texto, ehErro) {
    limpar(container);
    container.appendChild(
        criarElemento("div", "aviso-lista" + (ehErro ? " erro" : ""), texto)
    );
}

function falhou(container, erro) {
    console.error(erro);
    avisoEm(
        container,
        "Não foi possível carregar. Verifique a conexão e tente de novo. " +
        "Se o erro continuar, confira se o script prontuario.sql foi executado no Supabase.",
        true
    );
}

function resultado(resposta) {
    if (resposta.error) {
        throw resposta.error;
    }
    return resposta.data;
}

function criarBotao(classe, texto, aoClicar) {
    const botao = criarElemento("button", classe, texto);
    botao.type = "button";
    if (aoClicar) {
        botao.addEventListener("click", aoClicar);
    }
    return botao;
}

function criarCampo(rotulo, tipo, valor, opcoes) {

    opcoes = opcoes || {};

    const campo = criarElemento("label", "campo-prontuario");
    campo.appendChild(criarElemento("span", null, rotulo));

    const entrada = document.createElement(tipo === "textarea" ? "textarea" : "input");

    if (tipo !== "textarea") {
        entrada.type = tipo;
    } else {
        entrada.rows = opcoes.linhas || 3;
    }

    entrada.value = valor || "";

    if (opcoes.placeholder) {
        entrada.placeholder = opcoes.placeholder;
    }

    if (opcoes.maximo) {
        entrada.maxLength = opcoes.maximo;
    }

    if (opcoes.modoTeclado) {
        entrada.inputMode = opcoes.modoTeclado;
    }

    campo.appendChild(entrada);

    return { campo: campo, entrada: entrada };

}

function dataHoraBrasileira(textoISO) {

    if (!textoISO) {
        return "";
    }

    const data = new Date(textoISO);

    return String(data.getDate()).padStart(2, "0") + "/" +
        String(data.getMonth() + 1).padStart(2, "0") + "/" +
        data.getFullYear() + " às " +
        String(data.getHours()).padStart(2, "0") + ":" +
        String(data.getMinutes()).padStart(2, "0");

}

function idadeEmAnos(textoISO) {

    if (!textoISO) {
        return null;
    }

    const nascimento = lerDataISO(textoISO);
    const hoje = new Date();

    let idade = hoje.getFullYear() - nascimento.getFullYear();

    if (
        hoje.getMonth() < nascimento.getMonth() ||
        (hoje.getMonth() === nascimento.getMonth() && hoje.getDate() < nascimento.getDate())
    ) {
        idade--;
    }

    return idade;

}

const formatoReais = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
});

function emReais(valor) {
    return formatoReais.format(Number(valor) || 0);
}

// Aceita "150", "150,50", "1.250,00", "R$ 90"
function lerValor(texto) {

    let limpo = (texto || "").replace(/R\$|\s/g, "");

    if (limpo === "") {
        return null;
    }

    if (limpo.indexOf(",") !== -1) {
        limpo = limpo.replace(/\./g, "").replace(",", ".");
    }

    const numero = Number(limpo);

    return isNaN(numero) || numero < 0 ? NaN : Math.round(numero * 100) / 100;

}


// ===============================
// SENHA DO PACIENTE (ÁREA DO PACIENTE)
// ===============================
// O paciente entra no site com e-mail + senha. No primeiro
// acesso a senha é 0000 e ele cria a própria. Se esquecer,
// a clínica redefine para 0000 aqui.

const prontuarioAcesso = document.getElementById("prontuario-acesso");

// Endereço do site para ir na mensagem. Fica vazio quando
// o site está rodando só no computador (Live Server).
function enderecoDoSite() {

    const local = ["localhost", "127.0.0.1", ""].indexOf(window.location.hostname) !== -1;

    if (local || window.location.protocol.indexOf("http") !== 0) {
        return "";
    }

    return window.location.href.replace(/paginas\/Painel\.html.*$/, "index.html#pacientes");

}

function mostrarAcessoPaciente() {

    limpar(prontuarioAcesso);

    if (!pacienteAtual || !pacienteAtual.id) {
        return;
    }

    const pacienteDaVez = pacienteAtual.id;
    prontuarioAcesso.appendChild(
        criarElemento("span", "situacao-acesso", "Verificando a senha da área do paciente...")
    );

    supabaseClient
        .rpc("paciente_situacao_senha", { p_paciente_id: pacienteDaVez })
        .then(function(resposta) {

            if (!pacienteAtual || pacienteAtual.id !== pacienteDaVez) {
                return;
            }

            limpar(prontuarioAcesso);

            if (resposta.error || !resposta.data) {
                console.error(resposta.error);
                prontuarioAcesso.appendChild(
                    criarElemento(
                        "span",
                        "situacao-acesso",
                        "Área do paciente indisponível (rode o script area-paciente.sql no Supabase)."
                    )
                );
                return;
            }

            const situacao = resposta.data;
            let texto;

            if (situacao.senha_propria) {
                texto = "🔑 Área do paciente: senha criada pelo paciente em " +
                    dataHoraBrasileira(situacao.desde);
            } else {
                texto = "🔑 Área do paciente: ainda com a senha provisória 0000";
            }

            if (situacao.bloqueado_ate) {
                texto += " · bloqueado por tentativas erradas até " +
                    dataHoraBrasileira(situacao.bloqueado_ate).split(" às ")[1];
            }

            prontuarioAcesso.appendChild(criarElemento("span", "situacao-acesso", texto));

            if (situacao.senha_propria || situacao.bloqueado_ate) {
                prontuarioAcesso.appendChild(
                    criarBotao(
                        "btn btn-secundario btn-pequeno",
                        "Redefinir senha para 0000",
                        redefinirSenha
                    )
                );
            }

        });

}

function redefinirSenha() {

    const paciente = pacienteAtual;

    if (
        !window.confirm(
            "Redefinir a senha de " + paciente.nome + " para 0000?\n\n" +
            "A senha atual deixa de funcionar e o paciente será desconectado. " +
            "No próximo acesso ele entra com 0000 e cria uma senha nova."
        )
    ) {
        return;
    }

    supabaseClient
        .rpc("redefinir_senha_paciente", { p_paciente_id: paciente.id })
        .then(function(resposta) {

            if (resposta.error) {
                console.error(resposta.error);
                window.alert("Não foi possível redefinir a senha. Tente novamente.");
                return;
            }

            if (!pacienteAtual || pacienteAtual.id !== paciente.id) {
                return;
            }

            const site = enderecoDoSite();

            const mensagem =
                "Olá, " + paciente.nome.split(" ")[0] + "! Aqui é da clínica da Dra. Gabriela Valois.\n\n" +
                "Sua senha da *Área do paciente* foi redefinida. Para entrar:\n" +
                "E-mail: " + paciente.email + "\n" +
                "Senha: *0000*\n\n" +
                (site ? "Acesse: " + site + "\n\n" : "") +
                "Logo depois você vai criar uma senha nova.";

            limpar(prontuarioAcesso);

            const caixa = criarElemento("div", "caixa-codigo");

            const texto = criarElemento("div", "caixa-codigo-texto");
            texto.appendChild(criarElemento("span", null, "Senha redefinida para"));
            texto.appendChild(criarElemento("strong", "codigo-gerado", "0000"));
            texto.appendChild(
                criarElemento(
                    "span",
                    "codigo-aviso",
                    "Avise o paciente: no próximo acesso ele cria uma senha nova."
                )
            );
            caixa.appendChild(texto);

            const botoes = criarElemento("div", "botoes-form");
            const link = linkWhatsappPaciente({ telefone: paciente.telefone }, mensagem);

            if (link) {
                const btnWhats = criarElemento("a", "btn btn-principal btn-pequeno", "Avisar pelo WhatsApp");
                btnWhats.href = link;
                btnWhats.target = "_blank";
                btnWhats.rel = "noopener";
                botoes.appendChild(btnWhats);
            }

            botoes.appendChild(
                criarBotao("btn btn-secundario btn-pequeno", "Concluído", mostrarAcessoPaciente)
            );

            caixa.appendChild(botoes);
            prontuarioAcesso.appendChild(caixa);

        });

}


// ===============================
// ABRIR E FECHAR
// ===============================

function preencherCabecalho(paciente) {

    prontuarioNome.textContent = paciente.nome;
    limpar(prontuarioContato);

    const linkTelefone = linkWhatsappPaciente({ telefone: paciente.telefone }, "");

    const telefone = criarElemento(
        linkTelefone ? "a" : "span",
        null,
        "📱 " + (paciente.telefone || "sem telefone")
    );

    if (linkTelefone) {
        telefone.href = linkTelefone.split("?")[0];
        telefone.target = "_blank";
        telefone.rel = "noopener";
    }

    prontuarioContato.appendChild(telefone);

    const email = criarElemento("a", null, "✉️ " + paciente.email);
    email.href = "mailto:" + encodeURIComponent(paciente.email);
    prontuarioContato.appendChild(email);

    if (paciente.data_nascimento) {
        prontuarioContato.appendChild(
            criarElemento(
                "span",
                null,
                "🎂 " + dataBrasileira(paciente.data_nascimento) +
                " (" + idadeEmAnos(paciente.data_nascimento) + " anos)"
            )
        );
    }

}

function abrirProntuario(agendamento) {

    agendamentoOrigem = agendamento;

    pacienteAtual = {
        id: agendamento.paciente_id,
        nome: agendamento.nome_paciente,
        email: agendamento.email,
        telefone: agendamento.telefone,
        data_nascimento: agendamento.data_nascimento
    };

    preencherCabecalho(pacienteAtual);
    mostrarAcessoPaciente();
    selecionarAba("consultas");

    if (typeof modalProntuario.showModal === "function") {
        modalProntuario.showModal();
    } else {
        modalProntuario.setAttribute("open", "");
    }

}

function fecharProntuario() {

    if (typeof modalProntuario.close === "function") {
        modalProntuario.close();
    } else {
        modalProntuario.removeAttribute("open");
    }

}

document
    .getElementById("btn-fechar-prontuario")
    .addEventListener("click", fecharProntuario);

modalProntuario.addEventListener("click", function(evento) {
    if (evento.target === modalProntuario) {
        fecharProntuario();
    }
});

// Ao fechar, atualiza a lista do painel
// (pode ter mudado alguma coisa lá dentro)
modalProntuario.addEventListener("close", function() {
    if (typeof carregarTudo === "function") {
        carregarTudo();
    }
});


// ===============================
// ABAS
// ===============================

function selecionarAba(nome) {

    abaAtual = nome;
    numeroCarregamento++;

    abasProntuario.forEach(function(aba) {
        const ativa = aba.dataset.aba === nome;
        aba.classList.toggle("ativa", ativa);
        aba.setAttribute("aria-selected", ativa ? "true" : "false");
    });

    if (!pacienteAtual || !pacienteAtual.id) {
        avisoEm(
            prontuarioConteudo,
            "Este agendamento ainda não está ligado a um cadastro de paciente. " +
            "Rode o script prontuario.sql no Supabase e clique em Atualizar no painel.",
            true
        );
        return;
    }

    avisoEm(prontuarioConteudo, "Carregando...", false);

    const desenhar = {
        consultas: carregarConsultas,
        odontograma: carregarOdontograma,
        plano: carregarPlano,
        arquivos: carregarArquivos
    }[nome];

    desenhar(numeroCarregamento);

}

abasProntuario.forEach(function(aba) {
    aba.addEventListener("click", function() {
        selecionarAba(aba.dataset.aba);
    });
});

function aindaValido(numero) {
    return numero === numeroCarregamento && modalProntuario.open;
}


// =====================================================
// ABA 1 — CONSULTAS E ANOTAÇÕES
// =====================================================

function carregarConsultas(numero) {

    supabaseClient
        .from("agendamentos")
        .select("*")
        .eq("paciente_id", pacienteAtual.id)
        .order("data_consulta", { ascending: false })
        .order("horario", { ascending: false })
        .then(resultado)
        .then(function(consultas) {

            const ids = consultas.map(function(c) { return c.id; });

            if (ids.length === 0) {
                return { consultas: consultas, anotacoes: [] };
            }

            return supabaseClient
                .from("anotacoes_consulta")
                .select("*")
                .in("agendamento_id", ids)
                .then(resultado)
                .then(function(anotacoes) {
                    return { consultas: consultas, anotacoes: anotacoes };
                });

        })
        .then(function(dados) {

            if (!aindaValido(numero)) {
                return;
            }

            const anotacaoPorConsulta = {};

            dados.anotacoes.forEach(function(a) {
                anotacaoPorConsulta[a.agendamento_id] = a;
            });

            desenharConsultas(dados.consultas, anotacaoPorConsulta);

        })
        .catch(function(erro) {
            if (aindaValido(numero)) {
                falhou(prontuarioConteudo, erro);
            }
        });

}

function situacaoDaConsulta(item) {

    const jaPassou = item.data_consulta < hojeISO();

    if (item.status === "cancelado") {
        return { texto: "cancelada", classe: "selo-cancelado" };
    }

    if (jaPassou && item.status === "confirmado") {
        return { texto: "realizada", classe: "selo-realizado" };
    }

    if (jaPassou) {
        return { texto: "não confirmada", classe: "selo-cancelado" };
    }

    return { texto: item.status, classe: "selo-" + item.status };

}

function itemResumo(numero, texto) {
    const item = criarElemento("div", "historico-resumo-item");
    item.appendChild(criarElemento("strong", null, String(numero)));
    item.appendChild(criarElemento("span", null, texto));
    return item;
}

function desenharConsultas(consultas, anotacaoPorConsulta) {

    limpar(prontuarioConteudo);

    const hoje = hojeISO();

    const realizadas = consultas.filter(function(c) {
        return c.data_consulta < hoje && c.status === "confirmado";
    }).length;

    const proximas = consultas.filter(function(c) {
        return c.data_consulta >= hoje && c.status !== "cancelado";
    }).length;

    const canceladas = consultas.filter(function(c) {
        return c.status === "cancelado";
    }).length;

    const resumo = criarElemento("div", "historico-resumo");
    resumo.appendChild(itemResumo(realizadas, realizadas === 1 ? "realizada" : "realizadas"));
    resumo.appendChild(itemResumo(proximas, proximas === 1 ? "próxima" : "próximas"));
    resumo.appendChild(itemResumo(canceladas, canceladas === 1 ? "cancelada" : "canceladas"));

    if (consultas.length > 0) {
        resumo.appendChild(
            itemResumo(
                dataBrasileira(consultas[consultas.length - 1].data_consulta),
                "primeira consulta"
            )
        );
    }

    prontuarioConteudo.appendChild(resumo);

    if (consultas.length === 0) {
        prontuarioConteudo.appendChild(
            criarElemento("div", "aviso-lista", "Nenhuma consulta encontrada.")
        );
        return;
    }

    consultas.forEach(function(item) {
        prontuarioConteudo.appendChild(
            criarItemConsulta(item, anotacaoPorConsulta[item.id] || null)
        );
    });

}

function criarItemConsulta(item, anotacao) {

    const situacao = situacaoDaConsulta(item);

    const linha = criarElemento(
        "div",
        "historico-item" + (agendamentoOrigem && item.id === agendamentoOrigem.id ? " atual" : "")
    );

    const quando = criarElemento("div", "historico-quando");
    quando.appendChild(criarElemento("strong", null, dataBrasileira(item.data_consulta)));
    quando.appendChild(criarElemento("span", null, (item.horario || "").slice(0, 5)));
    linha.appendChild(quando);

    const corpo = criarElemento("div", "historico-corpo");

    const titulo = criarElemento("div", "historico-tipo");
    titulo.appendChild(document.createTextNode(item.tipo_consulta));
    titulo.appendChild(criarElemento("span", "selo " + situacao.classe, situacao.texto));

    if (agendamentoOrigem && item.id === agendamentoOrigem.id) {
        titulo.appendChild(criarElemento("span", "historico-marcador", "esta consulta"));
    }

    corpo.appendChild(titulo);

    if (item.observacoes) {
        corpo.appendChild(
            criarElemento("div", "historico-obs", "Paciente escreveu: " + item.observacoes)
        );
    }

    const areaAnotacao = criarElemento("div", "area-anotacao");
    corpo.appendChild(areaAnotacao);

    mostrarAnotacao(areaAnotacao, item, anotacao);

    linha.appendChild(corpo);

    return linha;

}


// Mostra a anotação (ou o botão para criar uma)

const camposAnotacao = [
    { chave: "procedimento", rotulo: "Procedimento realizado" },
    { chave: "dentes", rotulo: "Dentes" },
    { chave: "observacoes", rotulo: "Observações clínicas" },
    { chave: "proximo_passo", rotulo: "Próximo passo" }
];

function mostrarAnotacao(area, item, anotacao) {

    limpar(area);

    if (anotacao) {

        const bloco = criarElemento("div", "anotacao-clinica");

        camposAnotacao.forEach(function(c) {

            if (!anotacao[c.chave]) {
                return;
            }

            const linha = criarElemento("p");
            linha.appendChild(criarElemento("strong", null, c.rotulo + ": "));
            linha.appendChild(document.createTextNode(anotacao[c.chave]));
            bloco.appendChild(linha);

        });

        bloco.appendChild(
            criarElemento(
                "span",
                "anotacao-data",
                "Anotado em " + dataHoraBrasileira(anotacao.atualizado_em)
            )
        );

        area.appendChild(bloco);

    }

    if (item.status === "cancelado") {
        return;
    }

    area.appendChild(
        criarBotao(
            "btn btn-secundario btn-pequeno",
            anotacao ? "✎ Editar anotação" : "✎ Anotar consulta",
            function() {
                editarAnotacao(area, item, anotacao);
            }
        )
    );

}

function editarAnotacao(area, item, anotacao) {

    limpar(area);

    const formulario = criarElemento("form", "form-prontuario");

    const procedimento = criarCampo(
        "Procedimento realizado", "textarea",
        anotacao && anotacao.procedimento,
        { linhas: 2, maximo: 2000, placeholder: "Ex.: Restauração em resina composta" }
    );

    const dentes = criarCampo(
        "Dentes", "text",
        anotacao && anotacao.dentes,
        { maximo: 200, placeholder: "Ex.: 16, 26" }
    );

    const observacoes = criarCampo(
        "Observações clínicas", "textarea",
        anotacao && anotacao.observacoes,
        { linhas: 3, maximo: 5000, placeholder: "Anestesia, materiais, reação do paciente…" }
    );

    const proximoPasso = criarCampo(
        "Próximo passo", "textarea",
        anotacao && anotacao.proximo_passo,
        { linhas: 2, maximo: 2000, placeholder: "Ex.: Retorno em 15 dias para polimento" }
    );

    formulario.appendChild(procedimento.campo);
    formulario.appendChild(dentes.campo);
    formulario.appendChild(observacoes.campo);
    formulario.appendChild(proximoPasso.campo);

    const erro = criarElemento("p", "mensagem-erro");
    const botoes = criarElemento("div", "botoes-form");

    const btnSalvar = criarElemento("button", "btn btn-principal", "Salvar anotação");
    btnSalvar.type = "submit";

    botoes.appendChild(btnSalvar);
    botoes.appendChild(
        criarBotao("btn btn-secundario", "Cancelar", function() {
            mostrarAnotacao(area, item, anotacao);
        })
    );

    formulario.appendChild(botoes);
    formulario.appendChild(erro);
    area.appendChild(formulario);

    procedimento.entrada.focus();

    formulario.addEventListener("submit", function(evento) {

        evento.preventDefault();

        const dados = {
            agendamento_id: item.id,
            procedimento: procedimento.entrada.value.trim() || null,
            dentes: dentes.entrada.value.trim() || null,
            observacoes: observacoes.entrada.value.trim() || null,
            proximo_passo: proximoPasso.entrada.value.trim() || null
        };

        const vazio =
            !dados.procedimento && !dados.dentes &&
            !dados.observacoes && !dados.proximo_passo;

        btnSalvar.disabled = true;
        btnSalvar.textContent = "Salvando...";
        erro.textContent = "";

        // Tudo em branco = apagar a anotação
        const pedido = vazio
            ? supabaseClient
                .from("anotacoes_consulta")
                .delete()
                .eq("agendamento_id", item.id)
                .then(resultado)
                .then(function() { return null; })
            : supabaseClient
                .from("anotacoes_consulta")
                .upsert(dados, { onConflict: "agendamento_id" })
                .select()
                .then(resultado)
                .then(function(linhas) { return linhas[0]; });

        pedido
            .then(function(salva) {
                mostrarAnotacao(area, item, salva);
            })
            .catch(function(e) {
                console.error(e);
                btnSalvar.disabled = false;
                btnSalvar.textContent = "Salvar anotação";
                erro.textContent = "Não foi possível salvar. Tente novamente.";
            });

    });

}


// =====================================================
// ABA 2 — ODONTOGRAMA
// =====================================================

const situacoesDente = {
    carie:             { nome: "Cárie",              simbolo: "●" },
    restaurado:        { nome: "Restaurado",         simbolo: "R" },
    canal:             { nome: "Tratamento de canal", simbolo: "C" },
    coroa:             { nome: "Coroa / prótese",    simbolo: "P" },
    implante:          { nome: "Implante",           simbolo: "I" },
    extracao_indicada: { nome: "Extração indicada",  simbolo: "E" },
    fratura:           { nome: "Fratura",            simbolo: "F" },
    ausente:           { nome: "Ausente / extraído", simbolo: "✕" }
};

// Ordem em que os dentes aparecem na tela,
// como se a pessoa estivesse de frente para a dentista
const arcadaSuperior = [[18, 17, 16, 15, 14, 13, 12, 11], [21, 22, 23, 24, 25, 26, 27, 28]];
const arcadaInferior = [[48, 47, 46, 45, 44, 43, 42, 41], [31, 32, 33, 34, 35, 36, 37, 38]];

const nomesPorPosicao = {
    1: "Incisivo central",
    2: "Incisivo lateral",
    3: "Canino",
    4: "1º pré-molar",
    5: "2º pré-molar",
    6: "1º molar",
    7: "2º molar",
    8: "3º molar (siso)"
};

const nomesQuadrante = {
    1: "superior direito",
    2: "superior esquerdo",
    3: "inferior esquerdo",
    4: "inferior direito"
};

function nomeDoDente(numero) {
    return nomesPorPosicao[numero % 10] + " " + nomesQuadrante[Math.floor(numero / 10)];
}

function carregarOdontograma(numero) {

    supabaseClient
        .from("odontograma")
        .select("*")
        .eq("paciente_id", pacienteAtual.id)
        .then(resultado)
        .then(function(registros) {

            if (!aindaValido(numero)) {
                return;
            }

            const porDente = {};

            registros.forEach(function(r) {
                porDente[r.dente] = r;
            });

            desenharOdontograma(porDente, null);

        })
        .catch(function(erro) {
            if (aindaValido(numero)) {
                falhou(prontuarioConteudo, erro);
            }
        });

}

function desenharOdontograma(porDente, denteAberto) {

    limpar(prontuarioConteudo);

    prontuarioConteudo.appendChild(
        criarElemento(
            "p",
            "dica-prontuario",
            "Clique em um dente para registrar a situação dele. Dentes sem marcação estão saudáveis."
        )
    );

    const odontograma = criarElemento("div", "odontograma");

    function criarArcada(titulo, quadrantes) {

        const arcada = criarElemento("div", "arcada");
        arcada.appendChild(criarElemento("span", "arcada-titulo", titulo));

        const linha = criarElemento("div", "arcada-quadrantes");

        quadrantes.forEach(function(dentes) {

            const quadrante = criarElemento("div", "quadrante");

            dentes.forEach(function(numeroDente) {

                const registro = porDente[numeroDente];
                const situacao = registro ? situacoesDente[registro.situacao] : null;

                const botao = criarElemento(
                    "button",
                    "dente" +
                        (registro ? " situacao-" + registro.situacao : "") +
                        (numeroDente === denteAberto ? " selecionado" : "")
                );

                botao.type = "button";
                botao.title = numeroDente + " · " + nomeDoDente(numeroDente) +
                    (situacao ? " · " + situacao.nome : "");
                botao.setAttribute(
                    "aria-label",
                    "Dente " + numeroDente + ", " + nomeDoDente(numeroDente) +
                    ": " + (situacao ? situacao.nome : "saudável")
                );

                botao.appendChild(
                    criarElemento("span", "dente-coroa", situacao ? situacao.simbolo : "")
                );
                botao.appendChild(
                    criarElemento("span", "dente-numero", String(numeroDente))
                );

                botao.addEventListener("click", function() {
                    desenharOdontograma(porDente, numeroDente);
                });

                quadrante.appendChild(botao);

            });

            linha.appendChild(quadrante);

        });

        arcada.appendChild(linha);

        return arcada;

    }

    odontograma.appendChild(criarArcada("Superior", arcadaSuperior));
    odontograma.appendChild(criarArcada("Inferior", arcadaInferior));

    prontuarioConteudo.appendChild(odontograma);


    // Legenda
    const legenda = criarElemento("div", "legenda-odontograma");

    Object.keys(situacoesDente).forEach(function(chave) {
        const item = criarElemento("span", "legenda-item");
        item.appendChild(
            criarElemento("span", "legenda-cor situacao-" + chave, situacoesDente[chave].simbolo)
        );
        item.appendChild(document.createTextNode(situacoesDente[chave].nome));
        legenda.appendChild(item);
    });

    prontuarioConteudo.appendChild(legenda);


    // Editor do dente escolhido
    if (denteAberto) {
        prontuarioConteudo.appendChild(
            criarEditorDente(porDente, denteAberto)
        );
    }


    // Lista dos dentes marcados
    const marcados = Object.keys(porDente)
        .map(Number)
        .sort(function(a, b) { return a - b; });

    const lista = criarElemento("div", "registros-dentes");
    lista.appendChild(criarElemento("h3", "historico-subtitulo", "Dentes com registro"));

    if (marcados.length === 0) {
        lista.appendChild(
            criarElemento("p", "dica-prontuario", "Nenhum dente marcado ainda.")
        );
    }

    marcados.forEach(function(numeroDente) {

        const r = porDente[numeroDente];

        const linha = criarElemento("button", "registro-dente");
        linha.type = "button";

        linha.appendChild(
            criarElemento("span", "legenda-cor situacao-" + r.situacao, situacoesDente[r.situacao].simbolo)
        );

        const texto = criarElemento("span", "registro-texto");
        texto.appendChild(
            criarElemento("strong", null, numeroDente + " · " + situacoesDente[r.situacao].nome)
        );
        texto.appendChild(
            criarElemento("span", null, nomeDoDente(numeroDente) + (r.observacao ? " — " + r.observacao : ""))
        );
        linha.appendChild(texto);

        linha.addEventListener("click", function() {
            desenharOdontograma(porDente, numeroDente);
        });

        lista.appendChild(linha);

    });

    prontuarioConteudo.appendChild(lista);

}

function criarEditorDente(porDente, numeroDente) {

    const registro = porDente[numeroDente] || null;
    let escolhida = registro ? registro.situacao : "saudavel";

    const editor = criarElemento("form", "editor-dente form-prontuario");

    const topo = criarElemento("div", "editor-dente-topo");
    topo.appendChild(criarElemento("strong", null, "Dente " + numeroDente));
    topo.appendChild(criarElemento("span", null, nomeDoDente(numeroDente)));
    editor.appendChild(topo);

    const opcoes = criarElemento("div", "opcoes-situacao");
    const botoesOpcao = [];

    const todas = [{ chave: "saudavel", nome: "Saudável", simbolo: "" }].concat(
        Object.keys(situacoesDente).map(function(chave) {
            return { chave: chave, nome: situacoesDente[chave].nome, simbolo: situacoesDente[chave].simbolo };
        })
    );

    todas.forEach(function(opcao) {

        const botao = criarBotao(
            "opcao-situacao" + (opcao.chave === escolhida ? " ativa" : ""),
            null,
            function() {
                escolhida = opcao.chave;
                botoesOpcao.forEach(function(b) {
                    b.classList.toggle("ativa", b.dataset.chave === escolhida);
                });
            }
        );

        botao.dataset.chave = opcao.chave;
        botao.appendChild(
            criarElemento("span", "legenda-cor situacao-" + opcao.chave, opcao.simbolo)
        );
        botao.appendChild(document.createTextNode(opcao.nome));

        botoesOpcao.push(botao);
        opcoes.appendChild(botao);

    });

    editor.appendChild(opcoes);

    const observacao = criarCampo(
        "Observação sobre o dente", "text",
        registro && registro.observacao,
        { maximo: 500, placeholder: "Ex.: cárie na face oclusal" }
    );

    editor.appendChild(observacao.campo);

    const botoes = criarElemento("div", "botoes-form");
    const btnSalvar = criarElemento("button", "btn btn-principal", "Salvar dente");
    btnSalvar.type = "submit";
    botoes.appendChild(btnSalvar);
    botoes.appendChild(
        criarBotao("btn btn-secundario", "Fechar", function() {
            desenharOdontograma(porDente, null);
        })
    );
    editor.appendChild(botoes);

    const erro = criarElemento("p", "mensagem-erro");
    editor.appendChild(erro);

    editor.addEventListener("submit", function(evento) {

        evento.preventDefault();

        btnSalvar.disabled = true;
        btnSalvar.textContent = "Salvando...";
        erro.textContent = "";

        const pedido = escolhida === "saudavel"
            ? supabaseClient
                .from("odontograma")
                .delete()
                .eq("paciente_id", pacienteAtual.id)
                .eq("dente", numeroDente)
                .then(resultado)
                .then(function() { return null; })
            : supabaseClient
                .from("odontograma")
                .upsert({
                    paciente_id: pacienteAtual.id,
                    dente: numeroDente,
                    situacao: escolhida,
                    observacao: observacao.entrada.value.trim() || null
                }, { onConflict: "paciente_id,dente" })
                .select()
                .then(resultado)
                .then(function(linhas) { return linhas[0]; });

        pedido
            .then(function(salvo) {

                if (salvo) {
                    porDente[numeroDente] = salvo;
                } else {
                    delete porDente[numeroDente];
                }

                desenharOdontograma(porDente, null);

            })
            .catch(function(e) {
                console.error(e);
                btnSalvar.disabled = false;
                btnSalvar.textContent = "Salvar dente";
                erro.textContent = "Não foi possível salvar. Tente novamente.";
            });

    });

    return editor;

}


// =====================================================
// ABA 3 — PLANO DE TRATAMENTO
// =====================================================

const statusPlano = {
    a_fazer: "A fazer",
    em_andamento: "Em andamento",
    concluido: "Concluído",
    cancelado: "Cancelado"
};

function carregarPlano(numero) {

    supabaseClient
        .from("plano_tratamento")
        .select("*")
        .eq("paciente_id", pacienteAtual.id)
        .order("criado_em", { ascending: true })
        .then(resultado)
        .then(function(itens) {
            if (aindaValido(numero)) {
                desenharPlano(itens);
            }
        })
        .catch(function(erro) {
            if (aindaValido(numero)) {
                falhou(prontuarioConteudo, erro);
            }
        });

}

function recarregarAbaAtual() {
    selecionarAba(abaAtual);
}

function desenharPlano(itens) {

    limpar(prontuarioConteudo);

    const ativos = itens.filter(function(i) { return i.status !== "cancelado"; });

    const soma = function(lista) {
        return lista.reduce(function(total, i) { return total + (Number(i.valor) || 0); }, 0);
    };

    const concluidos = ativos.filter(function(i) { return i.status === "concluido"; });
    const pendentes = ativos.filter(function(i) { return i.status !== "concluido"; });

    const resumo = criarElemento("div", "historico-resumo resumo-plano");
    resumo.appendChild(itemResumo(emReais(soma(ativos)), "valor total do plano"));
    resumo.appendChild(itemResumo(emReais(soma(concluidos)), "já realizado"));
    resumo.appendChild(itemResumo(emReais(soma(pendentes)), "a realizar"));
    resumo.appendChild(
        itemResumo(
            concluidos.length + " de " + ativos.length,
            "procedimentos concluídos"
        )
    );
    prontuarioConteudo.appendChild(resumo);

    const lista = criarElemento("div", "lista-plano");

    if (itens.length === 0) {
        lista.appendChild(
            criarElemento("div", "aviso-lista", "Nenhum procedimento no plano ainda. Adicione abaixo.")
        );
    }

    itens.forEach(function(item) {

        const linha = criarElemento(
            "div",
            "item-plano" + (item.status === "cancelado" ? " cancelado" : "") +
                (item.status === "concluido" ? " concluido" : "")
        );

        const info = criarElemento("div", "item-plano-info");
        info.appendChild(criarElemento("strong", null, item.procedimento));

        const detalhes = [];
        if (item.dente) { detalhes.push("Dente(s): " + item.dente); }
        if (item.observacao) { detalhes.push(item.observacao); }

        if (detalhes.length) {
            info.appendChild(criarElemento("span", null, detalhes.join(" · ")));
        }

        linha.appendChild(info);

        linha.appendChild(
            criarElemento("span", "item-plano-valor", item.valor !== null ? emReais(item.valor) : "—")
        );

        const seletor = document.createElement("select");
        seletor.className = "seletor-status";
        seletor.setAttribute("aria-label", "Status de " + item.procedimento);

        Object.keys(statusPlano).forEach(function(chave) {
            const opcao = document.createElement("option");
            opcao.value = chave;
            opcao.textContent = statusPlano[chave];
            opcao.selected = chave === item.status;
            seletor.appendChild(opcao);
        });

        seletor.addEventListener("change", function() {

            seletor.disabled = true;

            supabaseClient
                .from("plano_tratamento")
                .update({ status: seletor.value })
                .eq("id", item.id)
                .select("id")
                .then(resultado)
                .then(recarregarAbaAtual)
                .catch(function(e) {
                    console.error(e);
                    seletor.disabled = false;
                    seletor.value = item.status;
                    window.alert("Não foi possível alterar o status. Tente novamente.");
                });

        });

        linha.appendChild(seletor);

        linha.appendChild(
            criarBotao("btn-icone", "🗑", function() {

                if (!window.confirm("Remover \"" + item.procedimento + "\" do plano de tratamento?")) {
                    return;
                }

                supabaseClient
                    .from("plano_tratamento")
                    .delete()
                    .eq("id", item.id)
                    .then(resultado)
                    .then(recarregarAbaAtual)
                    .catch(function(e) {
                        console.error(e);
                        window.alert("Não foi possível remover. Tente novamente.");
                    });

            })
        );

        lista.appendChild(linha);

    });

    prontuarioConteudo.appendChild(lista);
    prontuarioConteudo.appendChild(criarFormPlano());

}

function criarFormPlano() {

    const formulario = criarElemento("form", "form-prontuario form-plano");
    formulario.appendChild(criarElemento("h3", "historico-subtitulo", "Adicionar procedimento"));

    const linha = criarElemento("div", "form-plano-linha");

    const procedimento = criarCampo("Procedimento *", "text", "", {
        maximo: 200, placeholder: "Ex.: Clareamento a laser"
    });
    const dente = criarCampo("Dente(s)", "text", "", {
        maximo: 50, placeholder: "Ex.: 11, 21"
    });
    const valor = criarCampo("Valor (R$)", "text", "", {
        maximo: 15, placeholder: "Ex.: 350,00", modoTeclado: "decimal"
    });

    procedimento.campo.classList.add("campo-largo");

    linha.appendChild(procedimento.campo);
    linha.appendChild(dente.campo);
    linha.appendChild(valor.campo);
    formulario.appendChild(linha);

    const observacao = criarCampo("Observação", "text", "", {
        maximo: 1000, placeholder: "Opcional"
    });
    formulario.appendChild(observacao.campo);

    const botoes = criarElemento("div", "botoes-form");
    const btnAdicionar = criarElemento("button", "btn btn-principal", "+ Adicionar ao plano");
    btnAdicionar.type = "submit";
    botoes.appendChild(btnAdicionar);
    formulario.appendChild(botoes);

    const erro = criarElemento("p", "mensagem-erro");
    formulario.appendChild(erro);

    formulario.addEventListener("submit", function(evento) {

        evento.preventDefault();
        erro.textContent = "";

        const nome = procedimento.entrada.value.trim();
        const numeroValor = lerValor(valor.entrada.value);

        if (!nome) {
            erro.textContent = "Informe o procedimento.";
            procedimento.entrada.focus();
            return;
        }

        if (Number.isNaN(numeroValor)) {
            erro.textContent = "Valor inválido. Use números, por exemplo 350,00.";
            valor.entrada.focus();
            return;
        }

        btnAdicionar.disabled = true;
        btnAdicionar.textContent = "Salvando...";

        supabaseClient
            .from("plano_tratamento")
            .insert({
                paciente_id: pacienteAtual.id,
                procedimento: nome,
                dente: dente.entrada.value.trim() || null,
                valor: numeroValor,
                observacao: observacao.entrada.value.trim() || null
            })
            .select("id")
            .then(resultado)
            .then(recarregarAbaAtual)
            .catch(function(e) {
                console.error(e);
                btnAdicionar.disabled = false;
                btnAdicionar.textContent = "+ Adicionar ao plano";
                erro.textContent = "Não foi possível salvar. Tente novamente.";
            });

    });

    return formulario;

}


// =====================================================
// ABA 4 — ARQUIVOS (RADIOGRAFIAS, FOTOS, PDFs)
// =====================================================

const PASTA_STORAGE = "prontuario";
const TAMANHO_MAXIMO = 10 * 1024 * 1024;
const TIPOS_ACEITOS = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

function nomeSeguro(nome) {

    return nome
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-zA-Z0-9._-]+/g, "_")
        .slice(-80);

}

function tamanhoLegivel(bytes) {

    if (!bytes) {
        return "";
    }

    if (bytes < 1024 * 1024) {
        return Math.max(1, Math.round(bytes / 1024)) + " KB";
    }

    return (bytes / (1024 * 1024)).toFixed(1).replace(".", ",") + " MB";

}

function carregarArquivos(numero) {

    supabaseClient
        .from("arquivos_paciente")
        .select("*")
        .eq("paciente_id", pacienteAtual.id)
        .order("criado_em", { ascending: false })
        .then(resultado)
        .then(function(arquivos) {

            if (arquivos.length === 0) {
                return { arquivos: arquivos, links: {} };
            }

            // Links temporários (1 hora), porque a pasta é privada
            return supabaseClient.storage
                .from(PASTA_STORAGE)
                .createSignedUrls(
                    arquivos.map(function(a) { return a.caminho; }),
                    3600
                )
                .then(function(resposta) {

                    const links = {};

                    (resposta.data || []).forEach(function(item) {
                        if (item && item.signedUrl) {
                            links[item.path] = item.signedUrl;
                        }
                    });

                    return { arquivos: arquivos, links: links };

                });

        })
        .then(function(dados) {
            if (aindaValido(numero)) {
                desenharArquivos(dados.arquivos, dados.links);
            }
        })
        .catch(function(erro) {
            if (aindaValido(numero)) {
                falhou(prontuarioConteudo, erro);
            }
        });

}

function desenharArquivos(arquivos, links) {

    limpar(prontuarioConteudo);
    prontuarioConteudo.appendChild(criarFormEnvio());

    const grade = criarElemento("div", "grade-arquivos");

    if (arquivos.length === 0) {
        prontuarioConteudo.appendChild(
            criarElemento("div", "aviso-lista", "Nenhum arquivo enviado ainda.")
        );
        return;
    }

    arquivos.forEach(function(arquivo) {

        const link = links[arquivo.caminho];
        const ehImagem = (arquivo.tipo || "").indexOf("image/") === 0;

        const cartao = criarElemento("div", "cartao-arquivo");

        const previa = criarElemento(link ? "a" : "div", "previa-arquivo");

        if (link) {
            previa.href = link;
            previa.target = "_blank";
            previa.rel = "noopener";
            previa.title = "Abrir " + arquivo.nome_arquivo;
        }

        if (ehImagem && link) {
            const imagem = document.createElement("img");
            imagem.src = link;
            imagem.alt = arquivo.descricao || arquivo.nome_arquivo;
            imagem.loading = "lazy";
            previa.appendChild(imagem);
        } else {
            previa.appendChild(criarElemento("span", "icone-arquivo", ehImagem ? "🖼" : "PDF"));
        }

        cartao.appendChild(previa);

        const info = criarElemento("div", "info-arquivo");
        info.appendChild(criarElemento("strong", null, arquivo.descricao || arquivo.nome_arquivo));
        info.appendChild(
            criarElemento(
                "span",
                null,
                dataBrasileira(arquivo.criado_em.slice(0, 10)) +
                    (arquivo.tamanho ? " · " + tamanhoLegivel(arquivo.tamanho) : "")
            )
        );
        cartao.appendChild(info);

        cartao.appendChild(
            criarBotao("btn-icone btn-apagar-arquivo", "🗑", function() {

                if (!window.confirm("Excluir \"" + (arquivo.descricao || arquivo.nome_arquivo) + "\"? Não dá para desfazer.")) {
                    return;
                }

                supabaseClient.storage
                    .from(PASTA_STORAGE)
                    .remove([arquivo.caminho])
                    .then(resultado)
                    .then(function() {
                        return supabaseClient
                            .from("arquivos_paciente")
                            .delete()
                            .eq("id", arquivo.id)
                            .then(resultado);
                    })
                    .then(recarregarAbaAtual)
                    .catch(function(e) {
                        console.error(e);
                        window.alert("Não foi possível excluir. Tente novamente.");
                    });

            })
        );

        grade.appendChild(cartao);

    });

    prontuarioConteudo.appendChild(grade);

}

function criarFormEnvio() {

    const formulario = criarElemento("form", "form-prontuario form-envio");

    const seletorArquivo = document.createElement("input");
    seletorArquivo.type = "file";
    seletorArquivo.multiple = true;
    seletorArquivo.accept = TIPOS_ACEITOS.join(",");
    seletorArquivo.id = "seletor-arquivos";
    seletorArquivo.className = "seletor-arquivos";

    const rotulo = criarElemento("label", "area-soltar");
    rotulo.htmlFor = "seletor-arquivos";
    rotulo.appendChild(criarElemento("strong", null, "Escolher radiografias, fotos ou PDFs"));
    rotulo.appendChild(criarElemento("span", null, "JPG, PNG, WEBP ou PDF · até 10 MB cada"));

    const escolhidos = criarElemento("span", "arquivos-escolhidos");

    seletorArquivo.addEventListener("change", function() {
        const nomes = Array.from(seletorArquivo.files).map(function(f) { return f.name; });
        escolhidos.textContent = nomes.length ? nomes.join(", ") : "";
    });

    formulario.appendChild(seletorArquivo);
    formulario.appendChild(rotulo);
    formulario.appendChild(escolhidos);

    const descricao = criarCampo("Descrição (opcional)", "text", "", {
        maximo: 300, placeholder: "Ex.: Radiografia panorâmica — antes do tratamento"
    });
    formulario.appendChild(descricao.campo);

    const botoes = criarElemento("div", "botoes-form");
    const btnEnviar = criarElemento("button", "btn btn-principal", "Enviar arquivos");
    btnEnviar.type = "submit";
    botoes.appendChild(btnEnviar);
    formulario.appendChild(botoes);

    const erro = criarElemento("p", "mensagem-erro");
    formulario.appendChild(erro);

    formulario.addEventListener("submit", function(evento) {

        evento.preventDefault();
        erro.textContent = "";

        const arquivos = Array.from(seletorArquivo.files);

        if (arquivos.length === 0) {
            erro.textContent = "Escolha pelo menos um arquivo.";
            return;
        }

        const invalido = arquivos.find(function(f) {
            return TIPOS_ACEITOS.indexOf(f.type) === -1 || f.size > TAMANHO_MAXIMO;
        });

        if (invalido) {
            erro.textContent =
                "\"" + invalido.name + "\" não pode ser enviado: use JPG, PNG, WEBP ou PDF de até 10 MB.";
            return;
        }

        btnEnviar.disabled = true;

        const textoDescricao = descricao.entrada.value.trim() || null;
        let enviados = 0;

        // Envia um de cada vez
        arquivos.reduce(function(fila, arquivo) {

            return fila.then(function() {

                btnEnviar.textContent =
                    "Enviando " + (enviados + 1) + " de " + arquivos.length + "...";

                const caminho =
                    pacienteAtual.id + "/" + Date.now() + "-" +
                    Math.random().toString(36).slice(2, 8) + "-" + nomeSeguro(arquivo.name);

                return supabaseClient.storage
                    .from(PASTA_STORAGE)
                    .upload(caminho, arquivo, { contentType: arquivo.type })
                    .then(resultado)
                    .then(function() {

                        return supabaseClient
                            .from("arquivos_paciente")
                            .insert({
                                paciente_id: pacienteAtual.id,
                                caminho: caminho,
                                nome_arquivo: arquivo.name.slice(-200),
                                tipo: arquivo.type,
                                tamanho: arquivo.size,
                                descricao: textoDescricao
                            })
                            .then(function(resposta) {

                                if (resposta.error) {
                                    // Não deixa arquivo "solto" no Storage
                                    supabaseClient.storage.from(PASTA_STORAGE).remove([caminho]);
                                    throw resposta.error;
                                }

                                enviados++;

                            });

                    });

            });

        }, Promise.resolve())
            .then(recarregarAbaAtual)
            .catch(function(e) {

                console.error(e);
                btnEnviar.disabled = false;
                btnEnviar.textContent = "Enviar arquivos";
                erro.textContent =
                    (enviados ? enviados + " arquivo(s) enviado(s), mas " : "") +
                    "não foi possível enviar. Tente novamente.";

            });

    });

    return formulario;

}
