// ===============================
// BOTÕES "SAIBA MAIS"
// ===============================

const botoesSaibaMais =
    document.querySelectorAll(".btn-saiba-mais");

botoesSaibaMais.forEach(function(botao) {

    botao.addEventListener("click", function() {

        const detalhes =
            botao.parentElement.querySelector(".detalhes-servico");

        if (detalhes.style.display === "block") {

            detalhes.style.display = "none";
            botao.textContent = "Saiba mais";

        } else {

            detalhes.style.display = "block";
            botao.textContent = "Mostrar menos";

        }

    });

});


// ===============================
// SELEÇÃO DOS HORÁRIOS
// ===============================

const horarios =
    document.querySelectorAll(".dia button");

horarios.forEach(function(horario) {

    horario.addEventListener("click", function() {

        const diaSelecionado =
            horario.closest(".dia");

        const dias =
            document.querySelectorAll(
                ".dias-calendario .dia"
            );

        const indice =
            Array.from(dias).indexOf(
                diaSelecionado
            );


        const cabecalhos =
            document.querySelectorAll(
                ".cabecalho-calendario div"
            );


        if (!cabecalhos[indice]) {
            return;
        }


        const data =
            cabecalhos[indice]
                .querySelector("span")
                .textContent
                .trim();


        const hora =
            horario.textContent.trim();


        // Guarda os dados escolhidos
        localStorage.setItem(
            "dataAgendamento",
            data
        );

        localStorage.setItem(
            "horarioAgendamento",
            hora
        );


        // Vai para a página de confirmação
        window.location.href =
            "paginas/ConfirmarAgendamento.html?data=" + encodeURIComponent(data) + "&horario=" +encodeURIComponent(hora);

    });

});


// ===============================
// ÁREA DO PACIENTE
// ===============================


// Minhas consultas

const btnConsultas =
    document.getElementById("btn-consultas");

const infoConsultas =
    document.getElementById("info-consultas");

if (btnConsultas && infoConsultas) {

    btnConsultas.addEventListener(
        "click",
        function() {

            infoConsultas.classList.toggle(
                "mostrar"
            );

            if (
                infoConsultas.classList.contains(
                    "mostrar"
                )
            ) {

                btnConsultas.textContent =
                    "Fechar";

            } else {

                btnConsultas.textContent =
                    "Acessar";

            }

        }
    );

}


// Prontuário

const btnProntuario =
    document.getElementById("btn-prontuario");

const infoProntuario =
    document.getElementById("info-prontuario");

if (btnProntuario && infoProntuario) {

    btnProntuario.addEventListener(
        "click",
        function() {

            infoProntuario.classList.toggle(
                "mostrar"
            );

            if (
                infoProntuario.classList.contains(
                    "mostrar"
                )
            ) {

                btnProntuario.textContent =
                    "Fechar";

            } else {

                btnProntuario.textContent =
                    "Acessar";

            }

        }
    );

}


// Plano de tratamento

const btnPlano =
    document.getElementById("btn-plano");

const infoPlano =
    document.getElementById("info-plano");

if (btnPlano && infoPlano) {

    btnPlano.addEventListener(
        "click",
        function() {

            infoPlano.classList.toggle(
                "mostrar"
            );

            if (
                infoPlano.classList.contains(
                    "mostrar"
                )
            ) {

                btnPlano.textContent =
                    "Fechar";

            } else {

                btnPlano.textContent =
                    "Acessar";

            }

        }
    );

}


// Orçamentos

const btnOrcamentos =
    document.getElementById("btn-orcamentos");

const infoOrcamentos =
    document.getElementById("info-orcamentos");

if (btnOrcamentos && infoOrcamentos) {

    btnOrcamentos.addEventListener(
        "click",
        function() {

            infoOrcamentos.classList.toggle(
                "mostrar"
            );

            if (
                infoOrcamentos.classList.contains(
                    "mostrar"
                )
            ) {

                btnOrcamentos.textContent =
                    "Fechar";

            } else {

                btnOrcamentos.textContent =
                    "Acessar";

            }

        }
    );

}


// ===============================
// NAVEGAÇÃO DO CALENDÁRIO
// ===============================

const btnAnterior =
    document.getElementById("btn-anterior");

const btnProxima =
    document.getElementById("btn-proxima");

const cabecalhosCalendario =
    document.querySelectorAll(
        ".cabecalho-calendario div"
    );


// Semana inicial
let semanaAtual = 0;

// Controla se o usuário pediu pra ver
// todos os horários extras manualmente
// (botão "Ver mais horários")
let mostrarTodosHorarios = false;


// ===============================
// ATUALIZAR CALENDÁRIO
// ===============================

function atualizarCalendario() {

    const dataInicial = new Date();
        dataInicial.setHours(0, 0, 0, 0);

        // Volta para a segunda-feira da semana atual
        const diaSemana = dataInicial.getDay();
        const diasAteSegunda = (diaSemana + 6) % 7;

        dataInicial.setDate(
            dataInicial.getDate() - diasAteSegunda
        );

        // Aplica a navegação entre as semanas
        dataInicial.setDate(
            dataInicial.getDate() + (semanaAtual * 7)
        );



    const nomesDias = [
        "Segunda-feira",
        "Terça-feira",
        "Quarta-feira",
        "Quinta-feira",
        "Sexta-feira",
        "Sábado",
        "Domingo"
    ];


    cabecalhosCalendario.forEach(
        function(cabecalho, indice) {

            const data =
                new Date(dataInicial);

            data.setDate(
                dataInicial.getDate() +
                indice
            );


            const dia =
                String(
                    data.getDate()
                ).padStart(2, "0");


            const mes =
                String(
                    data.getMonth() + 1
                ).padStart(2, "0");


            cabecalho
                .querySelector("strong")
                .textContent =
                nomesDias[indice];


            cabecalho
                .querySelector("span")
                .textContent =
                dia + "." + mes;

        }
    );


    // Desabilita a seta esquerda
    // somente na primeira semana

    btnAnterior.disabled =
        semanaAtual === 0;


    // ===============================
    // OCULTAR HORÁRIOS JÁ PASSADOS
    // ===============================

    const diasCalendario =
        document.querySelectorAll(
            ".dias-calendario .dia"
        );

    const agora =
        new Date();

    diasCalendario.forEach(
        function(diaColuna, indice) {

            const cabecalho =
                cabecalhosCalendario[indice];

            if (!cabecalho) {
                return;
            }

            const dataTexto =
                cabecalho
                    .querySelector("span")
                    .textContent
                    .trim();

            const partesData =
                dataTexto.split(".");

            const dia =
                parseInt(partesData[0]);

            const mes =
                parseInt(partesData[1]) - 1;

            const botoes =
                diaColuna.querySelectorAll(
                    "button"
                );

            botoes.forEach(
                function(botao) {

                    const horario =
                        botao.textContent.trim();

                    const partesHora =
                        horario.split(":");

                    if (partesHora.length !== 2) {
                        return;
                    }

                    const hora =
                        parseInt(partesHora[0]);

                    const minuto =
                        parseInt(partesHora[1]);

                    const dataHorario = new Date(dataInicial);

                        dataHorario.setDate(
                            dataInicial.getDate() + indice
                        );

                        dataHorario.setHours(
                            hora,
                            minuto,
                            0,
                            0
                        );

                    const ocupado =
                        horariosOcupados.has(
                            chaveHorario(dataHorario)
                        );

                    if (dataHorario <= agora || ocupado) {

                        botao.style.display =
                            "none";

                    } else {

                        botao.style.display =
                            "";

                    }

                }
            );


            // ===============================
            // REORGANIZA A COLUNA DEPOIS DE
            // ESCONDER OS HORÁRIOS PASSADOS
            // ===============================

            // Colunas de fim de semana já têm
            // "Fechado" fixo no HTML — não mexe nelas.
            // (:not(.sem-horario-dinamico) garante que a
            // nossa própria mensagem dinâmica não seja
            // confundida com o aviso fixo de fim de semana)

            if (diaColuna.querySelector(".sem-horario:not(.sem-horario-dinamico)")) {
                return;
            }

            const botoesPrincipais =
                Array.from(diaColuna.children).filter(
                    function(el) {
                        return el.tagName === "BUTTON";
                    }
                );

            const temPrincipalVisivel =
                botoesPrincipais.some(function(botao) {
                    return botao.style.display !== "none";
                });

            const containerExtras =
                diaColuna.querySelector(".horarios-extras");

            let temExtraVisivel = false;

            if (containerExtras) {

                temExtraVisivel =
                    Array.from(
                        containerExtras.querySelectorAll("button")
                    ).some(function(botao) {
                        return botao.style.display !== "none";
                    });

                // Se não sobrou nenhum horário "principal",
                // mas ainda existe horário nos "extras",
                // essa coluna PRECISA estar aberta

                const precisaAbrirSozinha =
                    !temPrincipalVisivel && temExtraVisivel;

                if (precisaAbrirSozinha) {

                    containerExtras.classList.add("sempre-aberto");
                    containerExtras.style.display = "flex";

                } else {

                    containerExtras.classList.remove("sempre-aberto");

                    // Se não precisa abrir sozinha, o estado dela
                    // depende só de o usuário ter clicado ou não
                    // em "Ver mais horários" — nunca fica com um
                    // estilo "esquecido" de uma semana anterior

                    containerExtras.style.display =
                        mostrarTodosHorarios ? "flex" : "none";

                }

            }


            // Remove uma mensagem antiga, se existir,
            // antes de decidir se precisa recriar

            const mensagemAntiga =
                diaColuna.querySelector(".sem-horario-dinamico");

            if (mensagemAntiga) {
                mensagemAntiga.remove();
            }


            // Se não sobrou horário nenhum (nem principal,
            // nem extra), mostra uma mensagem no lugar do branco

            if (!temPrincipalVisivel && !temExtraVisivel) {

                const mensagem =
                    document.createElement("span");

                mensagem.className =
                    "sem-horario sem-horario-dinamico";

                mensagem.textContent =
                    "Sem horários disponíveis";

                diaColuna.appendChild(mensagem);

            }

        }
    );


    // Busca no banco os horários já reservados
    // desta semana (só na primeira vez que ela aparece)
    carregarHorariosOcupados(dataInicial);

}


// ===============================
// HORÁRIOS JÁ RESERVADOS (SUPABASE)
// ===============================

// Guarda "AAAA-MM-DD HH:MM" de cada horário reservado
const horariosOcupados = new Set();

// Semanas que já foram buscadas no banco
const semanasCarregadas = new Set();

function formatarDataISO(data) {

    return data.getFullYear() + "-" +
        String(data.getMonth() + 1).padStart(2, "0") + "-" +
        String(data.getDate()).padStart(2, "0");

}

function chaveHorario(data) {

    return formatarDataISO(data) + " " +
        String(data.getHours()).padStart(2, "0") + ":" +
        String(data.getMinutes()).padStart(2, "0");

}

function carregarHorariosOcupados(inicioSemana) {

    if (typeof supabaseClient === "undefined") {
        return;
    }

    const inicio = formatarDataISO(inicioSemana);

    if (semanasCarregadas.has(inicio)) {
        return;
    }

    semanasCarregadas.add(inicio);

    const fimSemana = new Date(inicioSemana);
    fimSemana.setDate(fimSemana.getDate() + 6);

    supabaseClient
        .rpc("horarios_ocupados", {
            inicio: inicio,
            fim: formatarDataISO(fimSemana)
        })
        .then(function(resposta) {

            if (resposta.error) {

                // Se der erro, a semana pode ser buscada de novo
                semanasCarregadas.delete(inicio);
                console.error("Erro ao buscar horários ocupados:", resposta.error);
                return;

            }

            if (!resposta.data || resposta.data.length === 0) {
                return;
            }

            resposta.data.forEach(function(item) {

                // O banco devolve o horário como "08:00:00"
                horariosOcupados.add(
                    item.data_consulta + " " + item.horario.slice(0, 5)
                );

            });

            // Redesenha para esconder os horários reservados
            atualizarCalendario();

        });

}


// ===============================
// SETA DIREITA
// ===============================

btnProxima.addEventListener(
    "click",
    function() {

        semanaAtual++;

        atualizarCalendario();

    }
);


// ===============================
// SETA ESQUERDA
// ===============================

btnAnterior.addEventListener(
    "click",
    function() {

        if (semanaAtual > 0) {

            semanaAtual--;

            atualizarCalendario();

        }

    }
);


// Inicia o calendário

atualizarCalendario();


// ===============================
// VER MAIS HORÁRIOS
// ===============================

const btnVerMais =
    document.getElementById("btn-ver-mais");


btnVerMais.addEventListener(
    "click",
    function() {

        mostrarTodosHorarios =
            !mostrarTodosHorarios;


        // Reaplica a exibição de todas as colunas
        // com a regra atualizada — assim nenhuma
        // coluna fica com estado "esquecido"

        atualizarCalendario();


        if (mostrarTodosHorarios) {

            btnVerMais.innerHTML =
                '<i class="fa-solid fa-minus"></i> Mostrar menos';

        } else {

            btnVerMais.innerHTML =
                '<i class="fa-solid fa-plus"></i> Ver mais horários';

        }

    }
);

