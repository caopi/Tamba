# 🎣 Tamba

Diário de pescarias no estilo "Pokédex de peixes". Registre suas capturas — espécie,
peso, tamanho, local e foto — e acompanhe quais peixes do catálogo ainda faltam.

Projeto semestral do IFSP.

## Stack

- **Frontend:** React 19 + Vite + TypeScript + React Router
- **Backend:** Node.js + Express (JavaScript, ESM)
- **Banco:** MySQL 8 com `mysql2` — SQL cru, sem ORM
- **Auth:** JWT (token de 7 dias) com senhas em bcrypt

## Pré-requisitos

- Node.js 22 (22.9 ou mais novo: os scripts usam `--env-file-if-exists`)
- MySQL 8 rodando localmente

---

## Configuração

### 1. Banco de dados

Uma vez por máquina, **como root**, rode o
[`backend/database/setup.sql`](backend/database/setup.sql) (antes, troque a senha
dentro dele):

```bash
mysql -u root -p < backend/database/setup.sql
```

Ou abra o arquivo no MySQL Workbench conectado como root e execute. Ele cria o
banco `tamba`, o usuário `tamba` e libera a criação de triggers
(`log_bin_trust_function_creators`, necessária para a migration 007). Dali em
diante o projeto só usa o usuário `tamba` — **a senha do root nunca vai no `.env`**.

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env
```

Abra o `backend/.env` e preencha:

| Variável | Para que serve |
| --- | --- |
| `DATABASE_URL` | Conexão com o MySQL. Formato: `mysql://tamba:senha-do-setup.sql@localhost:3306/tamba` |
| `JWT_SECRET` | Segredo que assina os tokens. **Troque por um valor aleatório.** |
| `JWT_EXPIRES_IN` | Validade do token. Padrão `7d`. |
| `PORT` | Porta da API. Padrão `3333`. |
| `CORS_ORIGIN` | Endereço do frontend. Padrão `http://localhost:5173`. |
| `FRONTEND_URL` | Para onde o link de confirmação de e-mail redireciona. Sem ela, o link responde JSON. |
| `EMAIL_VERIFICATION_URL` | Endereço do link que vai no e-mail (a rota `/auth/verify-email` da API). |
| `REPORT_HIDE_THRESHOLD` | Quantas denúncias de usuários distintos ocultam uma captura. Padrão `3`. |
| `ADMIN_EMAIL` | Conta que o `npm run seed` promove a admin (ver "Primeiro admin" abaixo). |
| `REQUIRE_EMAIL_VERIFICATION` | `true` liga a confirmação de e-mail no cadastro (RGN-01). Padrão `false`: o cadastro já entra logado. |
| `UPLOADS_PUBLIC_URL` | Endereço público das fotos enviadas. **Obrigatória** (a API não sobe sem ela); em desenvolvimento, `http://localhost:3333/uploads` (a própria API), como no `.env.example`. |
| `TRUST_PROXY` | Número de proxies na frente da API, para o limite de requisições. Local: deixe sem (vale 0). Em produção, ver DEPLOY.md, seção 7. |
| `UPLOADS_DIR` | Pasta onde as fotos enviadas são gravadas. Opcional no desenvolvimento (padrão `backend/uploads/`); obrigatória com `NODE_ENV=production`. |
| `PUBLIC_API_URL` | Endereço público da própria API, sem `/api`. Base das fotos do catálogo (`/assets/...`). **Obrigatória** (a API não sobe sem ela); em desenvolvimento, `http://localhost:3333`. |
| `SEED_DEV_USERS` | `true` faz o `npm run seed` criar as contas de desenvolvimento (ver abaixo). Ignorado com `NODE_ENV=production`. |

Para gerar um `JWT_SECRET` decente:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Depois crie as tabelas e popule o catálogo de espécies:

```bash
npm run migrate    # roda os .sql de database/migrations em ordem
npm run seed       # insere as 35 espécies (30 com foto) e 3 pesqueiros de exemplo
```

Os dois comandos podem ser rodados quantas vezes você quiser: o `migrate` pula
o que já foi aplicado, e o `seed` só preenche o que está vazio — nunca duplica
espécie nem desfaz uma edição feita pelo admin no app.

#### Contas de desenvolvimento

Com `SEED_DEV_USERS=true` (já vem assim no `.env.example`), o `npm run seed`
cria estas contas, já ativas:

| E-mail | Apelido | Papel |
| --- | --- | --- |
| `admin@tamba.local` | `admin` | admin |
| `ana@tamba.local` | `ana` | usuário |
| `bruno@tamba.local` | `bruno` | usuário |
| `carla@tamba.local` | `carla` | usuário |

Senha de todas: **`admin123`**.

> ⚠️ **São credenciais descartáveis, só para testar na sua máquina.** A senha
> está escrita aqui no README de propósito — não use essas contas para nada
> real. O seed se recusa a criá-las com `NODE_ENV=production`, e reseta senha,
> papel e ativação delas a cada execução. Para não criá-las, use
> `SEED_DEV_USERS=false`.

#### Confirmação de e-mail

Por padrão (`REQUIRE_EMAIL_VERIFICATION=false`) o cadastro já entra logado, sem
confirmação — é o modo de desenvolvimento. Para testar o fluxo completo do
RGN-01, coloque `REQUIRE_EMAIL_VERIFICATION=true` no `backend/.env` e reinicie
a API: a conta nasce inativa, o link de confirmação aparece no terminal da API
e o login só funciona depois de abrir o link.

#### Primeiro admin

Para desenvolver, a conta `admin@tamba.local` acima já basta. Para promover uma
**conta de verdade**, use o `ADMIN_EMAIL` do `.env` — não existe rota para virar
admin. **A ordem importa**, porque o seed só promove uma conta que já existe —
ele não cria conta:

1. Suba o backend e o frontend e **cadastre-se pelo app** com o e-mail que será
   admin.
2. Se a confirmação estiver ligada, confirme o e-mail (o link aparece no
   terminal da API).
3. Coloque esse e-mail em `ADMIN_EMAIL` no `backend/.env`.
4. Rode `npm run seed` de novo. Deve aparecer `... promovido a admin.`

Se aparecer `AVISO: ADMIN_EMAIL=..., mas nenhuma conta usa esse e-mail`, o
passo 1 não foi feito (ou o e-mail está digitado diferente). A API reconhece o
papel novo na hora; se a tela não mostrar as opções de admin, recarregue a página.

### 3. Frontend

```bash
cd frontend
npm install
cp .env.example .env
```

O `frontend/.env` só precisa de `VITE_API_URL` — já vem como
`http://localhost:3333/api`.

---

## Rodando

São **dois terminais**, um para cada servidor:

```bash
# terminal 1
cd backend && npm run dev      # API em http://localhost:3333/api

# terminal 2
cd frontend && npm run dev     # app em http://localhost:5173
```

Abra <http://localhost:5173> e entre com `admin@tamba.local` / `admin123` (ou
crie uma conta) e registre a primeira captura.

Para conferir se a API subiu: <http://localhost:3333/api/health>

---

## Scripts

### Backend

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Sobe a API com reload automático |
| `npm start` | Sobe a API sem reload |
| `npm run migrate` | Aplica os `.sql` ainda não rodados de `database/migrations/` |
| `npm run seed` | Popula o catálogo (pode rodar várias vezes, não duplica) |
| `npm run thumbs` | Gera a miniatura (~400 px) de cada foto do catálogo em `assets/species/thumb/`, a que a grade da Dex usa (depois de trocar uma foto) |
| `npm run pixel` | Gera a versão pixel art (96 px) das fotos em `assets/species/pixel/` — experimento fora de uso, fora do git |
| `npm run credits` | Regera o `CREDITOS.md` a partir de `database/species-images.js` (depois de trocar uma foto do catálogo) |

### Frontend

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Checa os tipos e gera o build de produção |
| `npm run preview` | Serve o build gerado |
| `npm run lint` | Roda o oxlint |

---

## Banco de dados

O schema mora em `backend/database/migrations/`, como arquivos `.sql` numerados.
Não há ORM: os models em `backend/src/models/` fazem as queries direto com
`mysql2`, sempre com parâmetros (`?`), nunca concatenando string.

Para mudar o schema, **crie um arquivo novo** em vez de editar um já aplicado:

```
database/migrations/
├── 001_init.sql                  já aplicada — não editar
├── 002_catch_spot_name.sql       já aplicada — não editar
└── 003_o_que_voce_vai_mudar.sql  a próxima
```

O `npm run migrate` roda em ordem alfabética o que ainda não rodou, e anota o que
já foi aplicado na tabela `schema_migrations`. Depois de mudar uma tabela, lembre
de atualizar a função `map...()` do model correspondente, que é quem traduz
`snake_case` do banco para `camelCase` da API.

### Tabelas

| Tabela | Papel |
| --- | --- |
| `users` | Contas. Hash bcrypt da senha, apelido único, `role` (`user`/`admin`), ativação por e-mail. |
| `fish_species` | Catálogo (a Dex): raridade, faixas plausíveis de peso/tamanho, curiosidades. Só admin edita. |
| `fishing_spots` | Pesqueiros. `google_place_id` fica nulo até integrar o Google Places. |
| `catches` | Capturas — e também os posts do feed. `spot_name` é o local digitado à mão, `region` a cidade/estado. |
| `catch_photos` | Fotos da captura (1 a 10). |
| `follows`, `likes`, `user_favorite_species` | Pares únicos (seguir, curtir, favoritar). |
| `comments`, `reports`, `notifications` | Comentários, denúncias e notificações. |

Ao apagar: usuário leva junto tudo dele (`CASCADE`), captura leva fotos,
curtidas, comentários e denúncias, pesqueiro só desassocia (`SET NULL`), e
espécie usada por alguma captura não pode ser apagada (`RESTRICT`) — só
desativada.

As regras de negócio (RGN-01 a RGN-17) e onde cada uma está no código ficam na
tabela de [ARQUITETURA.md](ARQUITETURA.md#regras-de-negócio).

---

## Endpoints da API

Base: `http://localhost:3333/api`. As rotas privadas exigem o header
`Authorization: Bearer <token>`; as de admin exigem também `role = 'admin'`.

Erros vêm sempre como `{ "error": "mensagem" }`. Quando a tela precisa reagir
a um caso específico, vem também um `code` (ex.: `OUT_OF_RANGE`,
`EMAIL_NOT_VERIFIED`). Erro de validação vem com `details` por campo.

### Conta

| Método | Rota | Acesso | Descrição |
| --- | --- | --- | --- |
| `GET` | `/health` | público | Checagem rápida |
| `POST` | `/auth/signup` | público | Cria a conta. Padrão: já ativa, devolve `{ user, token }`. Com `REQUIRE_EMAIL_VERIFICATION=true`: inativa, manda o link e `token` vem `null` |
| `GET` | `/auth/verify-email?token=` | público | Link do e-mail. Redireciona para `FRONTEND_URL/verificacao?status=ok\|expired\|invalid` |
| `POST` | `/auth/resend-verification` | público | Gera um link novo. `{ "email" }` |
| `POST` | `/auth/login` | público | Devolve `{ user, token }`. Conta não confirmada: 403 `EMAIL_NOT_VERIFIED` |
| `GET` | `/auth/me` | privado | Dados do usuário logado |
| `PATCH` | `/users/me` | privado | Nome, apelido, avatar (foto enviada pelo próprio usuário), `measurementUnit` (`kg` = métrico, `lb` = imperial), `shareExactLocation`, `notifyLikes`/`notifyComments`/`notifyFollows` |

Com `REQUIRE_EMAIL_VERIFICATION=true` e sem SMTP configurado, o e-mail de confirmação é **impresso no terminal da API**
— copie o link de lá.

### Capturas e feed

| Método | Rota | Acesso | Descrição |
| --- | --- | --- | --- |
| `GET` | `/feed?scope=following\|all&order=recent\|engagement&cursor=&limit=` | privado | Feed. Padrão: só de quem você segue, mais recentes primeiro. `all` = Descobrir; `engagement` = curtidas + comentários. Devolve `{ items, nextCursor }`; repasse o `nextCursor` como `cursor` para a próxima página |
| `GET` | `/catches` | privado | Seu histórico (inclui as ocultas pela moderação, com `isHidden`) |
| `GET` | `/catches/:id` | privado | Uma captura |
| `POST` | `/uploads` | privado | Envia **uma** foto (multipart, campo `photo`; JPEG, PNG ou WebP, até 8 MB). Devolve `{ id, url }` |
| `POST` | `/catches` | privado | Registra uma captura |
| `PUT` | `/catches/:id` | privado | Edita (só o autor) |
| `DELETE` | `/catches/:id` | privado | Apaga (só o autor) |
| `POST` / `DELETE` | `/catches/:id/like` | privado | Curte / descurte. Idempotente; devolve `{ liked, likeCount }` |
| `GET` / `POST` | `/catches/:id/comments` | privado | Lista / cria comentário (`{ "body" }`) |
| `DELETE` | `/comments/:id` | privado | Apaga o próprio comentário |
| `POST` | `/catches/:id/reports` | privado | Denuncia (`{ "reason" }`) |

Exemplo de corpo para `POST /catches`:

```json
{
  "speciesId": "uuid-da-especie",
  "spotId": "uuid-do-pesqueiro-ou-null",
  "spotName": "Pesqueiro Recanto Azul",
  "region": "Salto, SP",
  "weight": 3.4,
  "length": 52,
  "photoUrls": ["http://localhost:3333/uploads/9f2c…e1.jpg"],
  "notes": "Nublado, massa de milho, vara de 2,10 m",
  "latitude": -23.2,
  "longitude": -47.29,
  "caughtAt": "2026-09-01T08:30:00.000Z",
  "confirmOutOfRange": false
}
```

`weight` é sempre em **kg** e `length` em **cm** (a unidade do perfil é só de
exibição). `photoUrls` precisa de pelo menos uma foto (até 10), na ordem de exibição — a
primeira é a capa. Cada URL tem de ter vindo do `POST /uploads` **feito pelo
próprio autor**: link externo ou foto de outra pessoa voltam 422
`PHOTO_NOT_OWNED`. Se escolher um `spotId`, a `region`
vem do pesqueiro. Peso ou tamanho fora da faixa da espécie volta 422
`OUT_OF_RANGE`; reenviando com `"confirmOutOfRange": true`, a captura entra
sinalizada para revisão.

### Pessoas, Dex e notificações

| Método | Rota | Acesso | Descrição |
| --- | --- | --- | --- |
| `GET` | `/users/search?q=` | privado | Busca por nome ou apelido (mínimo 2 letras) |
| `GET` | `/users/suggestions` | privado | Sugestões de quem seguir: os mais seguidos que têm captura |
| `GET` | `/users/:id` | privado | Perfil público, com seguidores e estatísticas |
| `GET` | `/users/:id/catches` | privado | Capturas visíveis do usuário |
| `GET` | `/users/:id/followers` · `/following` | privado | Quem segue / quem é seguido |
| `POST` / `DELETE` | `/users/:id/follow` | privado | Segue / deixa de seguir. Idempotente; devolve `{ following, followers }` |
| `GET` | `/dex` | privado | Sua Dex: `{ total, captured, species[] }` |
| `GET` | `/dex/stats` | privado | Suas estatísticas |
| `GET` | `/favorites` | privado | Espécies favoritas |
| `POST` / `DELETE` | `/favorites/:speciesId` | privado | Favorita / desfavorita. Idempotente |
| `GET` | `/notifications?unreadOnly=&cursor=&limit=` | privado | `{ items, unreadCount, nextCursor }`, mais recentes primeiro. Cada item traz o ator, a espécie da captura e se ela foi ocultada |
| `GET` | `/notifications/unread-count` | privado | `{ unreadCount }` — o número na aba de Notificações |
| `PATCH` | `/notifications/:id/read` | privado | Marca uma como lida |
| `POST` | `/notifications/read-all` | privado | Marca todas como lidas |
| `GET` | `/species` · `/species/:id` | público | Catálogo ativo / uma espécie, com `imageUrl` (sempre completa) e `imageCredit`, `imageLicense`, `imageSourceUrl` |
| `GET` | `/spots` | público | Lista de pesqueiros |

### Admin

| Método | Rota | Descrição |
| --- | --- | --- |
| `GET` | `/admin/species` | Catálogo incluindo as desativadas |
| `POST` | `/admin/species` | Cadastra espécie (`rarity` obrigatória) |
| `PUT` | `/admin/species/:id` | Edita espécie |
| `PATCH` | `/admin/species/:id/active` | Ativa/desativa (`{ "isActive": false }`) |
| `DELETE` | `/admin/species/:id` | Apaga — só se não tiver capturas; senão 409 |
| `GET` | `/admin/reports` | Denúncias pendentes, agrupadas por captura |
| `POST` | `/admin/catches/:id/review` | Decide: `{ "hide": true }` mantém oculta, `false` libera |
| `GET` | `/admin/catches/:id/reports` | Denúncias de uma captura: `{ isHidden, pendingCount, reports[] }` |
| `PATCH` | `/admin/users/:id/active` | Desativa/reativa uma conta (`{ "isActive": false }`). Não vale para a própria conta |
| `GET` | `/feed?scope=reported` | Capturas com denúncia pendente, ocultas ou não |

Não há área de admin no app: essas ações aparecem dentro das telas normais
(post, perfil público, Dex) só para quem tem `role = 'admin'`.

---

## Telas

| Rota | Tela |
| --- | --- |
| `/login` | Login e cadastro (com apelido). Conta não confirmada recebe aviso e opção de reenviar o link |
| `/confirme-email` | Depois do cadastro: "confirme seu e-mail", com reenvio do link |
| `/verificacao` | Destino do link do e-mail: confirmado, expirado ou inválido (com reenvio) |
| `/` | Fish Dex — grade com foto, nome científico, raridade, contador X/Y e espécies arquivadas; as ainda não capturadas aparecem "na sombra". Clicar abre a ficha (foto com crédito, faixa plausível, curiosidades, recorde pessoal), sempre completa |
| `/registrar` | Nova captura. Medida fora da faixa da espécie abre uma confirmação antes de salvar |
| `/perfil` | Estatísticas e histórico ordenável; capturas ocultas pela moderação aparecem "em análise". Abre pela foto (ou @apelido) no topo e leva a Configurações, Créditos e Sair |
| `/feed` | Feed: abas Seguindo / Descobrir / Pessoas (busca, `?aba=pessoas`) e, para admin, Denunciadas; ordem por data ou engajamento, rolagem infinita, "Atualizar". Sem ninguém seguido, sugere perfis |
| `/capturas/:id` | Detalhe da captura: todas as fotos, observações, localização (coordenada só se o autor compartilha) e comentários. É o link do "Compartilhar" |
| `/u/:id` | Perfil público de outro usuário, com seguir e as capturas dele |
| `/configuracoes` | Perfil (nome, apelido, foto), unidades, privacidade da localização e notificações. Abre pelo Perfil |
| `/notificacoes` | Quem curtiu, comentou ou começou a seguir; clicar abre a captura ou o perfil. Abre pela aba Notificações, na barra de baixo, que mostra quantas não lidas há |
| `/creditos` | Créditos de todas as fotos do catálogo (autor, licença, origem, legenda). Pública, sem login; links na Dex e no Perfil |

As abas principais (Dex, Registrar Captura, Feed, Notificações) ficam na barra
de baixo; no topo, o título e o acesso ao perfil.

**Tema retrô (experimento).** Está ligado pela classe `tema-retro` no `<html>`
de `frontend/index.html`; para voltar ao visual normal, basta tirar a classe.
Tudo do tema mora em `frontend/src/styles/retro/`.

---

## Deploy

O roteiro do primeiro deploy em produção (o que falta no código, variáveis de
ambiente, banco, hospedagem e backups) está em [DEPLOY.md](DEPLOY.md).

---

## Problemas comuns

**`Can't reach database server at localhost:3306`** — o serviço do MySQL não está
no ar. No Windows, abra o "Serviços" (`services.msc`) e inicie o `MySQL80`.

**`P1000: Authentication failed`** — usuário ou senha errados na `DATABASE_URL`.
Se a senha tiver caracteres especiais (`@`, `:`, `#`), ela precisa ser codificada
em URL — por exemplo, `@` vira `%40`.

**`P1049` ou "Unknown database 'tamba'"** — falta criar o banco. Rode o
`CREATE DATABASE` do passo 1.

**Mudei uma tabela e o código não enxergou** — schema é SQL, não tem geração de
código: crie um `.sql` novo em `database/migrations/`, rode `npm run migrate` e
atualize o `map...()` do model correspondente.

**`JWT_SECRET não definido no .env`** — falta copiar o `.env.example` para `.env`
dentro de `backend/`.

**Erro de CORS no navegador** — o `CORS_ORIGIN` do backend precisa bater com a porta
onde o Vite subiu (ele usa outra porta se a 5173 estiver ocupada).


