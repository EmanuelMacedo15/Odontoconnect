# OdontoConnect

Plataforma web para **gestão, atendimento e agendamento** em clínicas odontológicas, desenvolvida para o consultório da **Dra. Gabriela Valois** (Cirurgiã-Dentista · CRO-PE 17387 · Recife - PE).

> Mais do que agendar: conectar toda a experiência do paciente e da clínica.

**Site:** https://emanuelmacedo15.github.io/Odontoconnect/ (em breve: www.gabrielavalois.com.br)

---

## Funcionalidades

### Para o paciente (site)
- **Agendamento online** com calendário semanal: mostra só horários livres, esconde horários passados e já reservados.
- **Confirmação do agendamento**: tipo de visita, troca de data, dados do paciente com validação e envio para o WhatsApp da clínica.
- **Área do paciente** (e-mail + senha):
  - primeiro acesso com a senha provisória `0000`, com criação obrigatória de senha própria;
  - minhas consultas (próximas e histórico, com cancelamento de consultas futuras);
  - meu prontuário (situação dos dentes e procedimentos realizados);
  - plano de tratamento e orçamentos.

### Para a clínica (`/paginas/Painel.html`)
- **Login** da equipe (Supabase Auth).
- **Agendamentos** agrupados por dia, com resumo, filtros, confirmação, cancelamento e aviso ao paciente pelo WhatsApp.
- **Prontuário** de cada paciente:
  - consultas com anotações clínicas (procedimento, dentes, observações, próximo passo);
  - **odontograma** com os 32 dentes (numeração FDI);
  - **plano de tratamento** com valores e status;
  - **arquivos** (radiografias, fotos e PDFs) em armazenamento privado;
  - redefinição da senha do paciente.

---

## Tecnologias

- HTML, CSS e JavaScript (sem frameworks)
- [Supabase](https://supabase.com): banco PostgreSQL, autenticação da equipe e armazenamento de arquivos
- GitHub Pages (hospedagem)

## Segurança e privacidade (LGPD)

- **Row Level Security** em todas as tabelas: visitantes do site só conseguem *criar* agendamentos.
- Dados clínicos visíveis **somente** para usuários cadastrados na tabela `equipe_clinica`.
- A área do paciente acessa os dados apenas por funções do banco que devolvem **só** as informações daquele paciente; observações clínicas internas e arquivos não são expostos.
- Senhas dos pacientes guardadas com **bcrypt**; bloqueio de 15 minutos após 5 tentativas erradas.
- Arquivos do prontuário em pasta **privada**, acessados por links temporários.
- Todo texto digitado é exibido como texto puro (proteção contra injeção de código).

A chave do Supabase em `docs/supabase.js` é a **chave publicável**, feita para ficar no navegador; a proteção dos dados está nas regras do banco.

---

## Estrutura do repositório

```
docs/                       ← site publicado no GitHub Pages
├── index.html              página principal (agendamento, área do paciente)
├── estilo.css
├── script.js               calendário e agendamento
├── area-paciente.js        área do paciente
├── supabase.js             conexão com o Supabase
├── paginas/
│   ├── ConfirmarAgendamento.html / .css
│   ├── Painel.html / .css  painel da clínica
│   └── prontuario.js       prontuário do paciente
├── imagens/
└── documentos/             política de privacidade

supabase/                   ← scripts do banco (rodar no SQL Editor, nesta ordem)
├── criar-tabela-agendamentos.sql
├── painel-clinica.sql      (trocar o e-mail da equipe no final)
├── prontuario.sql
└── area-paciente.sql
```

## Como configurar

1. Crie um projeto no Supabase e coloque a URL e a chave publicável em `docs/supabase.js`.
2. Em **Authentication → Users**, crie o usuário da equipe (marque *Auto Confirm User*).
3. No **SQL Editor**, rode os scripts da pasta `supabase/` na ordem acima.
4. Publique a pasta `docs/` (GitHub Pages → *Deploy from a branch* → `main` / `docs`).

Para testar no computador, abra a pasta `docs/` com uma extensão como o **Live Server** do VS Code.

> No plano gratuito, o Supabase pausa projetos sem uso por cerca de 7 dias. Se o site parar de salvar agendamentos, reative o projeto no painel do Supabase.

---

Projeto Integrador · OdontoConnect
