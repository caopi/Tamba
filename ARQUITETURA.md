# Tamba — arquitetura e convenções

Diário de pescarias no formato "Pokédex de peixes": o usuário registra as capturas
(espécie, peso, tamanho, local, foto) e acompanha quais espécies do catálogo ainda
faltam. Projeto de faculdade (IFSP), de um semestre, feito por um grupo de **seis
pessoas**; a implementação é do Lucas.

> **Regra geral:** simplicidade acima de tudo. Não é código de produção. Antes de
> introduzir uma biblioteca, um padrão novo ou uma camada de abstração, verifique
> se o problema não se resolve com o que já está aqui.

## Stack

| Camada  | Tecnologia |
| ------- | ---------- |
| Frontend | React 19 + Vite + **TypeScript** + React Router 7 |
| Backend  | Node.js + Express 4 em **JavaScript puro (ESM)** |
| Banco    | MySQL 8 acessado com `mysql2` — **SQL cru, sem ORM** |
| Auth     | JWT (access token único, 7 dias) + bcryptjs |
| Validação| Zod (só no backend) |
| Estilo   | CSS puro, um arquivo por página/componente |

**Frontend é TypeScript, backend é JavaScript.** Foi uma decisão consciente:
tipos ajudam nas telas, e o backend fica sem build step. Não "padronize" os dois.

## Estrutura

```
Tamba/
├── backend/
│   ├── database/
│   │   ├── migrations/    Arquivos .sql numerados — fonte da verdade do banco
│   │   ├── migrate.js     Roda os .sql em ordem, controla schema_migrations
│   │   ├── setup.sql      Preparação do MySQL (banco, usuário, grant), roda como root
│   │   ├── pesqueiros/    CSV de origem dos pesqueiros + LEIA-ME da conferência
│   │   └── seed.js        Catálogo de espécies + carga inicial de pesqueiros
│   ├── uploads/           Fotos enviadas (driver local do storage). Fora do git
│   └── src/
│       ├── server.js      Sobe o HTTP (só isso)
│       ├── app.js         Monta o Express: cors, json, rotas, erros
│       ├── routes/        Só declaram caminho → controller
│       ├── controllers/   Traduzem HTTP ↔ service (req → argumentos, retorno → res)
│       ├── services/      Regras de negócio (RGN-xx) + validação Zod
│       ├── models/        Acesso ao banco: SQL cru via mysql2
│       ├── middlewares/   requireAuth, requireAdmin, errorHandler, rateLimit
│       └── lib/           db.js (pool, transação), jwt.js, mailer.js, storage.js, authz.js, asyncHandler.js
└── frontend/src/
    ├── api/               Cliente HTTP: client.ts + um arquivo por recurso
    ├── context/           AuthContext (usuário logado + token)
    ├── components/        Layout, ProtectedRoute
    ├── pages/             Uma pasta-irmã .tsx + .css por tela
    ├── styles/global.css  Variáveis de cor e reset
    └── types.ts           Tipos espelhando as respostas da API
```

## Modelo de dados

`User 1:N Catch`, `FishSpecies 1:N Catch`, `FishingSpot 1:N Catch`, `Catch 1:N CatchPhoto`.
Parte social: `follows`, `likes`, `comments`, `reports`, `notifications` e
`user_favorite_species`.

- **users** — `password_hash` e o token de confirmação nunca saem da API (o
  `mapUser`/`mapPublicUser` do model escolhe os campos). `nickname` é UNIQUE e,
  pela collation, não diferencia maiúscula. `is_active` FALSE tem dois
  significados, separados pelo token de confirmação: **com** token pendente é
  cadastro esperando confirmar o e-mail; **sem** token é conta desativada por um
  admin (desativar apaga o token — ver Decisões). As contas criadas antes da
  migration 003 foram ativadas por ela (ver o comentário lá). `role` é `user` ou
  `admin`. `measurement_unit` é só preferência de exibição (`kg` = métrico,
  `lb` = imperial); `share_exact_location` controla o RGN-13; `notify_likes`,
  `notify_comments` e `notify_follows` são as preferências de notificação
  (migration 012); `feed_order` (`engagement`, o padrão, ou `recent`) é a
  ordem do feed escolhida nas Configurações (migration 017).
- **fish_species** — catálogo da Dex. O seed popula; depois disso só **admin**
  cria e edita (RGN-16). `name` é UNIQUE: é a chave do upsert do seed.
  Foto: `image_url` + `image_credit`, `image_license`, `image_source_url`
  (migration 013; ver "Fotos do catálogo" em Decisões). `model_url` é
  reservada para um modelo 3D, ideia adiada: fica NULL e nenhum código a usa.
  `image_thumb_url` (migrations 014 e 015) é a miniatura da foto (~400 px)
  que a grade da Dex usa; a ficha abre a foto inteira.
  `recommended_baits` é uma string simples separada por vírgula ('massa, milho,
  minhoca'), de propósito — não vale uma tabela só para isso. `rarity` é
  obrigatória: `VARCHAR NOT NULL` + CHECK com os quatro valores, e não ENUM —
  o ENUM grava o primeiro valor quando a coluna é omitida (ver migration 009).
  O critério — frequência de estocagem em pesqueiro — está no topo do
  `seed.js`. Correção de dado que precisa chegar a todos os bancos vira
  migration de dados (ex.: 010), porque o seed não sobrescreve. Faixas plausíveis
  (`min/max_weight` em kg, `min/max_length` em cm) são opcionais: faixa nula
  nunca sinaliza captura; as do seed são largas de propósito (o porquê também
  está no `seed.js`). Espécie nunca é apagada se tiver captura, só desativada
  (`is_active`, RGN-17).
- **fishing_spots** — `name` + `location` ("Cidade, UF", que vira a
  `region` da captura). UNIQUE (`name`, `location`), não só no nome: dois
  pesqueiros de cidades diferentes podem ter o mesmo nome (migration 019).
  `is_active` (019) existe para esconder pesqueiro que fechou sem apagar —
  as capturas apontam para ele —, mas por enquanto nada o lê nem grava.
  `google_place_id` fica nulo até integrarmos o Google Places; os links de
  Maps (CID) do CSV de origem **não** são Place ID e nunca vão para o banco.
  **Não é catálogo como `fish_species`: é dado de produção**, como capturas
  e usuários. O seed só faz a carga inicial (upsert pela chave única, sem
  tocar em pesqueiro existente); com a tela de admin de pesqueiros (prevista)
  eles passam a ser cadastrados, editados e desativados pelo app, e a fonte da
  verdade é o banco de produção, não o repositório. **Ninguém deve supor que
  a lista do `seed.js` está completa.** Mudar nome ou cidade no seed cria
  outro pesqueiro, não renomeia. A origem da carga inicial (busca assistida
  por IA) e o que foi conferido de cada linha estão em
  `database/pesqueiros/LEIA-ME.md`; só o conferido entra no seed.
- **catches** — registro central, e **é também o post do feed**: curtida,
  comentário e denúncia apontam direto para a captura, não existe tabela de posts.
  `weight` em **kg**, `length` em **cm**. `spot_name` é o local digitado à mão no
  formulário: até o Google Places entrar, o usuário só escreve o nome do lugar, e
  gravar isso na captura evita encher `fishing_spots` de linha órfã a cada erro de
  digitação. As duas colunas convivem — a tela mostra o `spot` do catálogo quando
  existe e cai no `spot_name` quando não. `region` (cidade/estado) vem do
  `location` do pesqueiro do catálogo ou é digitada, e é o que os outros veem
  quando o autor não compartilha `latitude`/`longitude`. `is_flagged_for_review`
  marca medida fora da faixa da espécie (RGN-08); `is_hidden` é a moderação (RGN-14).
- **catch_photos** — 1..10 fotos por captura, ordenadas por `position`; a de
  posição 0 é a capa. `url` guarda a **chave** do arquivo no armazenamento do
  `lib/storage.js` (`<id do usuário>/<nome>.jpg`), não a URL — a API monta o
  endereço na resposta (ver "Fotos em disco local" em Decisões). A API só
  aceita foto enviada por `POST /api/uploads` (REQ-15), não link externo.
  O mesmo vale para `users.avatar_url` e para a foto de espécie enviada pelo admin.
  É a única fonte das fotos: a antiga coluna `catches.photo_url` foi removida
  na migration 011. Capturas antigas podem ter `url` externa, de antes do
  upload; elas continuam valendo.
- **follows / likes / user_favorite_species** — chave primária composta pelo
  par: é ela que impede duplicata (RGN-15). "Não seguir a si mesmo" é trigger
  (migration 007), porque o MySQL não aceita CHECK em coluna com FK CASCADE.
- **reports** — UNIQUE (`reporter_id`, `catch_id`): cada linha é um usuário
  distinto, então o RGN-14 é só um COUNT.
- **notifications** — `user_id` recebe, `actor_id` fez a ação; `catch_id` é
  nulo para `follow`. Curtida e follow geram um aviso por par (descurtir e
  curtir de novo não repete); comentário gera um por comentário.

Deleção: apagar usuário apaga tudo dele — capturas, follows, curtidas,
comentários, denúncias, notificações (`CASCADE`); apagar captura leva fotos,
curtidas, comentários, denúncias e notificações dela; apagar pesqueiro só zera o
`spot_id` (`SET NULL`); espécie usada por alguma captura não pode ser apagada
(`RESTRICT`).

## Regras de negócio

Cada RGN do documento de requisitos aparece com o ID num comentário no código.
Para achar: `grep -rn "RGN-08" backend/`.

| Regra | Onde | O quê |
| --- | --- | --- |
| RGN-01 | `auth.service` — `signupSchema`, `signup`, `verifyEmail`, `EXIGIR_CONFIRMACAO` | E-mail válido e único; conta só ativa após confirmar o e-mail (link de 24h, reenviável). **A metade da confirmação é ligada por configuração**: vale com `REQUIRE_EMAIL_VERIFICATION=true` no `.env` (desligada por padrão no desenvolvimento). E-mail válido e único vale sempre |
| RGN-02 | `auth.service` — `signupSchema`, `signup`; `user.service.updateMe` | Apelido único (sem diferenciar maiúscula) |
| RGN-03 | `auth.service` — `signupSchema` | Senha com no mínimo 8 caracteres |
| RGN-04 | `auth.service.login`; `requireAuth` | Só usuário ativo entra: conta pendente leva 403 `EMAIL_NOT_VERIFIED` (ou se ativa, com a confirmação desligada); conta desativada por admin leva 403 `ACCOUNT_DISABLED` sempre |
| RGN-05 | `auth.service.login` | Credencial inválida barra a entrada (401) |
| RGN-06 | `user.service.updateMe` | Só o próprio usuário autenticado edita seus dados — o id sai do token |
| RGN-07 | `catch.service` — `createSchema`, `createCatch`, `updateCatch` | Espécie, ao menos uma foto, data não futura |
| RGN-08 | `catch.service` — `createSchema`, `avaliarFaixa` | Peso/tamanho > 0; fora da faixa só com `confirmOutOfRange`, e fica sinalizada |
| RGN-09 | `catch.service` — `updateCatch`, `deleteCatch` | Só o autor edita/apaga; estatísticas e Dex se recalculam sozinhas (ver Decisões) |
| RGN-10 | `dex.service`; `species.model.findDexForUser` | Espécie conta como capturada a partir da primeira captura não oculta |
| RGN-11 | `species.service` — `createSpecies`, `updateSpecies`; whitelist de `species.model` | Raridade só é gravada pelas rotas de admin; `rarity` no corpo de qualquer outra rota é descartado pelo Zod |
| RGN-12 | `catch.service.findVisibleCatch`; `catch.model.findFeed` | Feed e capturas de terceiros: só autor ativo e captura não oculta |
| RGN-13 | `catch.service.toCatchResponse` | Coordenada só sai para terceiros com `share_exact_location`; senão só `region` |
| RGN-14 | `report.service.reportCatch` | N denúncias pendentes de usuários distintos ocultam a captura (`REPORT_HIDE_THRESHOLD`, padrão 3) |
| RGN-15 | PK de `follows`/`likes`; trigger da migration 007; `social.service` | Não seguir a si mesmo; uma curtida por usuário por captura |
| RGN-16 | `species.service` — `createSpecies`, `updateSpecies` | Só admin cria/edita espécie |
| RGN-17 | `species.service.deleteSpecies`; FK `fk_catches_species` | Espécie com captura só é desativada, nunca apagada |

## Casos de uso

Onde cada caso de uso do documento está no app. Os de admin não têm área
própria: aparecem dentro das telas normais, só para quem tem `role = 'admin'`,
e a API recusa (403) para os demais de qualquer jeito.

| Caso de uso | Tela | API |
| --- | --- | --- |
| UC002 (lado admin) — desativar/reativar conta | Perfil público (`/u/:id`): faixa "🛡 Conta ativa / desativada" | `PATCH /admin/users/:id/active` → `user.service.setUserActive` |
| UC005 — feed | `/feed`: Seguindo, Descobrir, ordem, rolagem infinita | `GET /feed` → `catch.service.getFeed` |
| UC006 — interagir com captura | Post (`CatchCard`) e detalhe (`/capturas/:id`) | `/catches/:id/like`, `/comments`, `/reports` → `social.service`, `report.service` |
| UC007 — perfil e configurações | `/configuracoes`, aberta pelo Perfil (avatar no topo) | `PATCH /users/me` → `user.service.updateMe` |
| UC008 — seguir | Post, perfil público, aba "Pessoas" do Feed (`/feed?aba=pessoas`) | `/users/:id/follow`, `/users/search`, `/users/suggestions` |
| UC009 — notificações (REQ-43) | Aba "Notificações" na barra de baixo, com o número de não lidas no ícone; `/notificacoes`: quem fez o quê, marcar uma ou todas como lidas, rolagem infinita | `GET /notifications`, `GET /notifications/unread-count`, `PATCH /notifications/:id/read`, `POST /notifications/read-all` → `notification.service` |
| UC010 — catálogo de espécies | Dex (`/`): "+ Nova espécie"; ficha da espécie: "Editar espécie", "Desativar/Reativar" | `/admin/species` → `species.service` |
| UC011 — moderação | Post: "🛡 Moderar" (denúncias, ocultar/reexibir); feed: aba "🛡 Denunciadas" | `GET /admin/catches/:id/reports`, `POST /admin/catches/:id/review`, `GET /feed?scope=reported` → `report.service` |

## Convenções

**Nomes.** No banco, colunas em `snake_case` e tabelas no plural; no código
JS/TS, `camelCase`. Quem traduz são as funções `mapX()` no topo de cada model —
a API **sempre** fala `camelCase`. Ao adicionar coluna, atualize o `map` junto.

**SQL.** Toda query passa por `query()`/`queryOne()` de `src/lib/db.js`, que usa
prepared statement. **Nunca** monte SQL concatenando valor — use `?` e passe os
valores em `params`. Quando precisar montar a query dinamicamente (é o caso do
`UPDATE` de captura), o que varia é só o **nome da coluna**, e ele sai de uma
whitelist no código, nunca do corpo da request.

**Migrations.** São arquivos `.sql` numerados em `database/migrations/`, rodados
em ordem por `npm run migrate` e registrados em `schema_migrations`. Uma migration
já aplicada é **imutável**: para mudar o schema, crie `002_...sql`, `003_...sql`.

**Fusos.** O pool força `SET time_zone = '+00:00'` em toda conexão. Sem isso, o
`DEFAULT CURRENT_TIMESTAMP` das colunas `created_at` gravaria horário local (UTC-3)
e a API devolveria essa hora rotulada como UTC. Datas são sempre UTC no banco.

**affectedRows.** No MySQL, um `UPDATE` que grava o mesmo valor devolve
`affectedRows = 0`. Por isso o controller confere se a captura existe **antes** de
atualizar, em vez de usar o retorno do UPDATE para decidir 404.

**Collation.** `utf8mb4_0900_ai_ci` é *case- e accent-insensitive*: o UNIQUE de
e-mail já ignora maiúsculas, e `Traíra`/`Traira` colidiriam no UNIQUE de
`fish_species.name`.

**Idioma.** Código, nomes de campo e rotas em **inglês** (`catches`, `weight`).
Comentários, mensagens de erro e textos de tela em **português**.

**Rotas.** Tudo sob `/api`. Um arquivo de rota por recurso, registrado em
`routes/index.js`. Rota só liga caminho a controller — sem lógica.

**Controllers.** Sempre embrulhados em `asyncHandler`. São finos: pegam o que
importa da request (`req.userId`, `req.params`, `req.body`, `req.query`), chamam
**um** service e devolvem o resultado. Não validam nem decidem nada.

**Services.** Moram aqui as regras de negócio e a validação. Cada service tem os
schemas Zod no topo do arquivo e lança `httpError(status, msg)` para os casos de
erro — o `errorHandler` converte tudo em JSON. Uma regra, uma camada: o RGN-xx
fica num lugar só, com o ID em comentário. Quando o frontend precisa reagir a um
erro específico, vai um `code` no terceiro argumento:
`httpError(422, msg, { code: "OUT_OF_RANGE" })`. O `z.object` **descarta**
campo que não está no schema — é isso que garante, por exemplo, que `rarity` no
corpo de uma captura seja ignorado (RGN-11). Não use `.passthrough()` nem
espalhe `req.body` direto num model. Nunca use `try/catch` só para
responder 500. Operação que grava em mais de uma tabela usa `withTransaction`
(de `lib/db.js`) e passa o `conn` para cada função do model.

**Autorização.** Toda query que altera dado do usuário leva o `user_id` dele no
`WHERE` (ex.: `DELETE FROM catches WHERE id = ? AND user_id = ?`) e confere o
`affectedRows` — isso garante que ninguém mexa no dado de outro. Não pule esse
padrão. O id vem sempre de `req.userId` (posto pelo `requireAuth` a partir do
token), nunca do corpo da request. Rotas de admin passam pelo `requireAdmin` e
o service confere de novo com `assertAdmin(actor)`.

**Duplicata.** Para tabelas de par (follow, curtida, favorito) não confira antes
de inserir: insira e trate o `ER_DUP_ENTRY` com `isDuplicateKey`. Conferir antes
abre uma janela entre a conferência e o INSERT.

**Frontend.** Nenhum componente chama `fetch` direto — sempre pelos módulos de
`src/api/`, que já injetam o token e tratam erro. Estado de tela com `useState` +
`useEffect`; não há biblioteca de data fetching e não precisa ter.

## Decisões já tomadas (não refazer sem conversar)

- **JWT sem refresh token.** Um access token de 7 dias no `localStorage`. Não há
  tabela de sessões nem rota `/auth/refresh`. Suficiente para o escopo acadêmico.
- **CSS puro.** Sem Tailwind, sem styled-components.
- **Sem testes automatizados** por enquanto.
- **Sem ORM.** O Prisma foi removido em 03/09/2026 a pedido do Lucas, que já sabe
  SQL e não quis a camada de abstração em cima. Não reintroduza ORM nem query
  builder sem pedido explícito.
- **MySQL 8**, usando a instalação local da máquina (porta 3306). O projeto
  começou em PostgreSQL e foi migrado — se achar SQL ou doc falando em Postgres,
  é resquício, corrija.
- **Sem Docker.** Todas as máquinas onde o projeto roda já têm MySQL instalado,
  então não há `docker-compose.yml`. Não reintroduza sem pedido explícito.
- **Estatísticas e Dex calculadas na leitura, nunca armazenadas.** Não há
  contador nem tabela de progresso: cada consulta faz o COUNT na hora. É mais
  simples, não existe cache para invalidar, e o recálculo que o RGN-09 exige ao
  apagar uma captura sai de graça. No volume do projeto, o custo é irrelevante.
- **Captura é o post.** Não existe tabela de posts; o feed lista capturas.
- **Feed padrão = quem o usuário segue** (REQ-26). `scope=all` é o "Descobrir"
  (REQ-28).
- **Seguir, curtir e favoritar são idempotentes.** São botões de liga/desliga:
  `POST` garante que existe, `DELETE` garante que não existe, os dois devolvem o
  estado final. A PK continua barrando duplicata no banco (RGN-15).
- **E-mail só no console.** `lib/mailer.js` tem um driver que imprime o e-mail no
  terminal da API. Não há credencial SMTP no repositório; para enviar de verdade,
  troca-se só o driver nesse arquivo.
- **Confirmação de e-mail atrás de flag.** `REQUIRE_EMAIL_VERIFICATION`
  (padrão `false`): desligada, o cadastro já entra logado e o login não barra
  conta pendente — e ativa a conta, porque hoje `is_active` só significa
  "e-mail confirmado". Ligada, vale o fluxo completo do RGN-01. Rota de
  confirmação, reenvio e colunas de token existem e funcionam nos dois modos.
  Essa ativação no login só vale para conta com token pendente: conta
  desativada por admin não tem token e continua fora.
- **Desativação em vez de banimento — simplificação deliberada.** O admin
  desativa uma conta (`is_active = FALSE`) e pode reativá-la; não há motivo,
  prazo, histórico nem status de moderação. Sem coluna nova: desativar apaga o
  token de confirmação, e "inativa sem token" passa a significar "desativada
  por admin". O efeito vem do que já existia: some do feed e da busca (RGN-12),
  toda request é recusada no `requireAuth`, e nem o login (com a confirmação
  desligada) nem o reenvio do link a reativam. O admin não desativa a si mesmo.
- **Sem área de admin.** As ações de admin (UC002, UC010, UC011) aparecem como
  controles dentro das telas normais, só para admin — ver "Casos de uso". Para
  achar o que foi denunciado, inclusive o que já sumiu do feed por denúncias, o
  admin tem uma aba "🛡 Denunciadas" no próprio feed. O admin também enxerga
  captura oculta e perfil de conta desativada (para poder reverter), e a Dex
  dele lista as espécies desativadas.
- **Unidades.** A API e o banco falam sempre kg e cm; a preferência do usuário
  (`kg` = métrico, `lb` = libras e polegadas) só muda o que a tela mostra e o
  que se digita — `src/units.ts` converte nos dois sentidos, e nenhuma tela tem
  "kg" fixo. Exceção: o formulário de espécie do admin edita o catálogo em
  kg/cm, para não acumular erro de arredondamento — com a unidade escrita
  dentro de cada campo e um aviso quando a preferência do admin é libras.
- **Preferências de notificação no ponto de criação.** `notification.model.create`
  é o único lugar que grava notificação, e só grava se o destinatário quer
  aquele tipo (`INSERT ... SELECT` com a coluna da preferência). Ninguém é
  notificado da própria ação: curtir/comentar a própria captura não chama o
  `create`, e seguir a si mesmo já é barrado (RGN-15).
- **Notificação nunca leva a uma tela que não abre.** Aviso de quem foi
  desativado sai da lista e do número do sino (filtro na leitura, não
  `DELETE`: reativar a conta traz os avisos de volta), porque o perfil dele dá
  404. Captura apagada leva os avisos junto (`CASCADE`). Captura **ocultada**
  por denúncias continua com os avisos: curtida e comentário só avisam o autor
  da captura, e o autor sempre abre a própria captura oculta (com o selo "em
  análise", que a tela de notificações também mostra).
- **Sino sem tempo real.** A barra de abas pergunta o número de não lidas a cada
  minuto, ao trocar de tela e ao voltar para a aba
  (`GET /notifications/unread-count`). Sem WebSocket: um minuto de atraso não
  faz diferença num diário de pesca. Paginação por cursor
  (`<createdAt>_<id>`; o id desempata avisos do mesmo milissegundo).
- **Sessão perdida é tratada num lugar só.** O token dura 7 dias e a conta
  pode ser desativada no meio do uso; nos dois casos a API responde 401. O
  `api()` de `src/api/client.ts` trata qualquer 401 de request que levava
  token: apaga o token e avisa o `AuthProvider`, que tira o usuário e faz o
  `ProtectedRoute` mandar para `/login` — com o aviso "Sua sessão terminou" e
  voltando, depois de entrar, para a tela em que a pessoa estava. Login e
  cadastro limpam o token antigo antes, para um 401 de senha errada não ser
  confundido com sessão perdida.
- **Contas de desenvolvimento no seed.** Com `SEED_DEV_USERS=true` (e nunca
  com `NODE_ENV=production`), o seed cria `admin@tamba.local` e três usuários
  comuns, senha `admin123`. São descartáveis e só existem para testar local.
- **Primeiro admin pelo `.env`.** O `npm run seed` promove a conta de
  `ADMIN_EMAIL`, se ela já existir (não cria conta). Não há rota para virar admin.
- **Seed nunca sobrescreve.** O upsert usa `COALESCE(coluna, novo.coluna)`: só
  preenche o que está NULL. Corrigir um dado no `seed.js` não altera espécie que
  já está no banco — isso se faz pela rota de admin.
- **Feed.** Padrão "Seguindo" (REQ-26), "Descobrir" com `scope=all`
  (REQ-28). Ordem por engajamento (padrão) ou cronológica (REQ-35): a
  escolha é preferência da conta, nas Configurações (`users.feed_order`), e
  não um seletor no feed; também não há botão "Atualizar" — o feed busca de
  novo ao abrir a tela e ao trocar de aba (as duas coisas estão no
  DIVERGENCIAS.md). Ações do post só com ícone, cada uma com nome acessível
  completo (`aria-label`, "Curtir (2 curtidas)", "Denunciar captura"...) e o
  mesmo texto no `title`; os números de curtidas e comentários ficam à
  vista. No engajamento a nota é
  curtidas + 2 × comentários (comentar dá mais trabalho que curtir), sem janela
  de tempo — com o volume do projeto, isso basta. Paginação com um `cursor`
  opaco: no cronológico é a data do último item (post novo no topo não
  repete item na página seguinte); no engajamento é um offset, porque a ordem
  muda a cada curtida e não há cursor estável.
- **Sugestões de quem seguir (REQ-36).** Os mais seguidos, desempatando por
  quem postou mais recentemente, e só quem tem pelo menos uma captura visível —
  seguir um perfil vazio não resolveria o feed vazio. Ficam no estado vazio do
  feed e na tela de busca de pessoas.
- **Edição de captura.** `/capturas/:id/editar` reaproveita o formulário de
  Registrar Captura, preenchido (espécie, peso, comprimento, data, pesqueiro,
  local, região, observações, coordenada e fotos — as que já estavam no
  servidor entram na lista sem arquivo local). Salvar manda `PUT` com tudo;
  a API confere o autor (RGN-09) e refaz o RGN-08 com os valores finais:
  corrigir para dentro da faixa tira a sinalização; captura já sinalizada e
  salva sem mexer em espécie, peso nem comprimento não pede a confirmação de
  novo. Excluir mora embaixo da edição, separado e em vermelho, com
  confirmação; no histórico do Perfil, cada linha tem só "Editar".
- **Fotos em disco local — escolha deliberada de desenvolvimento.** O upload
  (`POST /api/uploads`, multer) grava em `backend/uploads/` e a própria API
  serve os arquivos em `/uploads`. Assim ninguém do grupo precisa de conta ou
  credencial em serviço externo. Fica atrás de `lib/storage.js` (`save` /
  `read`), no mesmo padrão do mailer: trocar de destino é escrever outro
  driver nesse arquivo. **O banco guarda a chave, não a URL** (migration
  018): `publicUrl` junta `UPLOADS_PUBLIC_URL` em toda resposta e `ownedKey`
  converte a URL que vem do cliente de volta em chave, conferindo o dono.
  Da API para fora só existem URLs completas — `POST /api/uploads` devolve
  `{ id, url }`, com `id` = chave e `url` = endereço completo, e é essa `url`
  que o frontend manda de volta. Trocar de domínio, de provedor ou pôr uma
  CDN é trocar a variável, sem mexer no banco. `UPLOADS_PUBLIC_URL` e
  `PUBLIC_API_URL` são obrigatórias, como o `JWT_SECRET`: sem elas (ou com
  valor que não seja `http(s)`), a API não sobe. Cada usuário tem a sua pasta
  (`uploads/<id do usuário>/`), e a captura só aceita foto cuja URL esteja na
  pasta do próprio autor — ninguém anexa a foto de outra pessoa copiando a URL
  do feed (`PHOTO_NOT_OWNED`). Na edição, as fotos que a captura já tinha
  continuam aceitas, para dar para reordenar ou remover as antigas. **Em produção, o mesmo driver grava
  num volume do Railway** (disco persistente montado no container), na pasta
  de `UPLOADS_DIR` — obrigatória com `NODE_ENV=production`, porque o disco
  do container some a cada deploy. Escolhido no lugar de um driver S3: zero
  código novo, ao custo de uma instância só, uma região só, sem CDN, alguns
  segundos fora do ar por deploy e 5 GB no plano Hobby (DEPLOY.md, 1.1). Se
  um dia precisar de bucket, a chave relativa no banco deixa a troca em
  copiar os arquivos e escrever o driver.
- **Migration pendente avisa, não derruba.** Na subida e no `/api/health`, a
  API compara os `.sql` de `database/migrations/` com `schema_migrations`
  (`lib/migrations.js`). Pendente vira faixa `MIGRATIONS PENDENTES` no log e
  `"status": "degraded"` no health — que responde sempre 200. Não recusa
  subir de propósito: com o volume, o deploy antigo já parou, e recusar
  deixaria o site fora do ar por um erro de configuração (DEPLOY.md, 4.6).
- **Validação do upload pelo conteúdo.** O tipo do arquivo é decidido pelos
  primeiros bytes (JPEG, PNG ou WebP), nunca pelo MIME nem pela extensão que o
  cliente manda. O nome do arquivo é gerado no servidor (32 hex aleatórios); o
  nome original nunca entra no caminho. Máximo de 8 MB por foto.
- **Compressão no aparelho (RNF-09).** O frontend redimensiona para 1600 px e
  reencoda em JPEG antes de enviar (`src/imageCompression.ts`). Isso também
  descarta o EXIF, inclusive o GPS que o celular grava na foto.
- **Fotos do catálogo: dado versionado, não upload.** As fotos das espécies do
  seed ficam em `backend/assets/species/` (WebP, até ~190 KB cada, 2,1 MB no
  total), **dentro do git**, servidas pela API em `/assets`. É o oposto das
  fotos de usuário: `uploads/` fica fora do git e existe numa máquina só, e
  quem clonasse o projeto veria só 🐟. O autor, a licença, a origem e o que
  foi alterado de cada foto estão em `database/species-images.js`, que o seed
  lê e o `npm run credits` transforma no `CREDITOS.md` da raiz. Legenda
  opcional (`image_caption`, "Na foto: ...") nas entradas de gênero, quando a
  foto mostra uma espécie do gênero e não a entrada inteira.
  - **Fotos da equipe.** Oito espécies usam foto da própria equipe ("Equipe
    Tamba", todos os direitos reservados — não são CC). Os originais ficam
    fora do git (pasta `peixes/`, só local) porque tinham pessoas no quadro e
    podiam carregar o GPS do pesqueiro (RGN-13). No repositório só entra o
    recorte no peixe, regravado a partir dos pixels, sem nenhum metadado; o
    recorte mais largo que 3:2 é completado com uma cópia desfocada dele
    mesmo, para o card não cortar cabeça e cauda. Na do bagre-africano ficam
    as mãos de quem segura (não dá para recortar sem cortar o peixe) e o
    texto impresso no saco plástico (telefone e site) foi borrado. A foto é a
    forma albina, rosada, de propósito: é a que aparece em pesqueiro (a
    curiosidade da espécie explica). Troca de foto de espécie que já está nos
    bancos vira migration de dados, para o crédito acompanhar (016, Traíra).
  - **Duas origens, um caminho.** A espécie que o admin cadastra pelo app
    ganha foto por upload comum. No banco, `image_url` é um caminho relativo
    à API (`/assets/species/tambaqui.webp`) ou a chave do upload
    (`<id do admin>/<nome>.jpg`); o `storage.publicUrl` resolve os dois — o
    que começa com `/` ganha `PUBLIC_API_URL`, a chave ganha
    `UPLOADS_PUBLIC_URL` —, e é chamado só onde as linhas viram resposta. Da API para fora existe uma URL só. Na escrita
    (`species.service`), a regra também é uma só: a foto atual passa, null
    tira a foto e o crédito, e foto nova tem de ser upload do próprio admin,
    com autor e licença — link externo é recusado.
  - **Crédito anda com a foto.** O seed só preenche o crédito se a espécie
    ainda não tem foto: a foto que um admin trocou nunca ganha o crédito da
    Wikimedia. Consequência do "seed só preenche o vazio": se o admin
    *remover* a foto de uma espécie do seed, o próximo `npm run seed` devolve
    a do repositório (com o crédito certo).
  - **Escolha das fotos.** Pelo nome científico (categoria do Commons ou
    observação "research grade" do iNaturalist), nunca pelo nome popular;
    domínio público/CC0 primeiro, depois CC BY; nada de CC BY-SA nem desenho.
    Ficaram sem foto, de propósito: três híbridos (Patinga, Pincachara,
    Cachapira), o Piauçu e o Trairão, cujo nome cobre um grupo de espécies
    quase idênticas sem registro brasileiro sólido (ver o `CREDITOS.md`).
  - **Padronização no CSS.** As fontes variam em ângulo, fundo e proporção;
    `<SpeciesImage>` normaliza: moldura 3:2 fixa, `object-fit: cover`, mesmo
    fundo e a mesma vinheta. Nas fotos de estúdio muito largas (fundo liso), o
    fundo foi estendido até 3:2 no processamento, para o `cover` não cortar
    cabeça e cauda. Espécie não capturada: só **na grade da Dex**, como
    indicador de progresso, a "sombra" sai da própria foto por filtro CSS
    (cinza, escura, contraste alto, desfoque leve); nome e nome científico
    continuam visíveis — é um guia de referência, não jogo de adivinhar. Nas
    fotos de fundo liso vira uma silhueta de verdade; nas com cenário, um
    quadro escuro em que a forma mal aparece. **A ficha da espécie nunca é
    bloqueada:** habitat, iscas e faixa plausível são justamente o que se
    quer saber antes de pescar.
  - **Crédito visível.** Na ficha da espécie, logo abaixo da foto ("Foto:
    autor · licença · origem", e a legenda), e na tela `/creditos`, pública,
    que reúne todas — inclusive as enviadas pelo app.
- **Tema retrô (8/16 bits) — experimento reversível.** Fica inteiro em
  `frontend/src/styles/retro/` (`retro.css` + a cena de fundo) e só vale com
  a classe `tema-retro` no `<html>` do `index.html`: tirar a classe desliga o
  tema, e nenhum componente tem estilo retrô no próprio CSS. Duas rampas: a
  moldura (barras, botões, selos, bordas, foco) em madeira, `--madeira-*` —
  marrom é complementar ao azul da cena, então a interface se descola do
  fundo, e moldura de madeira é convenção de RPG de 16 bits —, e o conteúdo
  (painel, cartões, texto) na rampa azul clara `--retro-*`, para leitura. As
  variáveis globais (`--agua`, `--texto`...) são redefinidas a partir delas.
  O amarelo é o de ativo e de foco. Fonte pixel (Press Start 2P nos
  títulos, Silkscreen em rótulos, botões, números e na barra de abas); texto
  corrido, descrições e campos continuam sans-serif, porque fonte pixel
  pequena reprova no RNF-13. Sem canto arredondado nem sombra difusa; as
  barras de cima e de baixo (um HUD) e o painel são 8 bits, o resto é 16
  bits (abaixo). O conteúdo fica
  sempre num painel sólido, nunca direto sobre a cena. Contraste conferido em
  todas as telas, nas duas larguras, medido nos pixels renderizados (texto
  escondido, cada trecho comparado com todo pixel atrás dele): mínimo
  5,52:1. Ícone sobre fundo: o contorno precisa passar de 3:1.
  - **Cena de fundo.** "Parallax Backgrounds: Dock", de Admurin (itch.io;
    termos copiados em `styles/retro/parallax/LICENCA.md`, crédito em
    `/creditos`): nove camadas PNG de 384 × 216. Pixel art só fica nítida
    ampliada por inteiro, e o CSS não arredonda isso de forma confiável:
    `styles/retro/cena.ts` calcula o menor fator inteiro que cobre a tela
    (×4 no celular, ×5 em 1280 × 900) e o deslocamento em pixel inteiro, e
    põe em `--cena-k/-x/-y`. Parada, as nove camadas ficam empilhadas numa
    camada `position: fixed` (não `background-attachment: fixed`: o iOS
    ignora esse valor e o Chrome repinta o fundo a cada quadro de rolagem).
  - **Parallax (`CenaAnimada`).** Interruptor de uma linha no `<html>`, como
    o do tema: `cena-movel`. Com ele, no Dex e no Feed, cada camada vira um
    elemento e as que emendam sem costura derivam uma volta (384 px da cena)
    por ciclo, um pixel da cena por vez (`steps(384)`), nunca meio — do fundo
    do lago, 2 min por ciclo, às nuvens, 15 min. Paradas de propósito: o céu
    (igual em toda a largura) e as duas fileiras de árvores do fundo, que não
    emendam (uma árvore cortada, um degrau de 9 px). Conferido: a volta
    inteira de cada camada é idêntica, pixel a pixel, ao início, e a cena
    móvel em repouso é idêntica à parada. Cada elemento é só a faixa de
    linhas em que a camada tem desenho, para não pôr nove telas transparentes
    na GPU. Medido: nenhum layout nem recálculo de estilo a mais com a cena
    andando.
  - **Efeitos.** Raios de luz, bolhas e peixes, nas margens ao lado do painel
    (no celular o painel cobre quase tudo), em pixels da cena: linha d'água
    na linha 91, água aberta até a 178. `cena-efeitos-parados` no `<html>` os
    congela. Os peixes são cinco tambaquis (a tira de 8 quadros de
    `sprites/tambaqui.png`): cada um uma janela do tamanho de um quadro, com
    a tira dentro andando um quadro por vez (a cauda) e a janela
    atravessando a água (o nado), em escala inteira do sprite (1×, 2×, 3×),
    cada um numa profundidade, velocidade e sentido — os que vão para a
    esquerda espelhados, os mais fundos menores e mais apagados. Entram e
    saem desbotando, já na tela (0 → cheio nos primeiros 15% da travessia e
    de volta nos últimos 15%), o que também disfarça o que sobra de
    diferença entre os quadros. Custo medido: nenhum layout; a cauda põe
    ~35–40 ms de recálculo de estilo a cada 5 s (≈1,5% do processamento
    principal), o resto da cena fica na GPU. A cena se mexe no Dex, Feed,
    Registrar Captura, Notificações e no login (que fica fora do Layout e
    monta a própria CenaAnimada); nas outras telas (Configurações,
    Perfil, edição...) e, com `prefers-reduced-motion`, em qualquer uma,
    nada se mexe: só a cena parada.
  - **Painel translúcido (experimento).** `painel-translucido` no `<html>`
    deixa o painel a 88% de opacidade. É o limite: com o painel sobre preto
    puro (mais escuro que qualquer pixel da cena), o texto mais fraco ainda
    dá 5,68:1; a 85% cairia para 5,29:1. Medido também no laço inteiro da
    cena (7.200 s, 60 momentos): mínimo 5,86:1.
  - **8 e 16 bits.** Só as barras de cima e de baixo e o painel são 8 bits
    (borda de 3–4 px quase preta, chanfro de 3 px): é a identidade de
    console. Todo o resto — cards da Dex e do feed, ficha da espécie,
    notificações, formulários, botões e campos — é 16 bits: rampa com tons
    intermediários, borda de 2 px num tom da rampa, chanfro de 1 px, botão
    em dois tons e sombreado pontilhado (xadrez de 2×2 px entre dois tons
    vizinhos) no lugar do degrau seco. Os tokens ficam no topo do
    `retro.css` (`--chanfro`/`--borda-retro` e os `*-16`). Onde há
    pontilhado, o `background-color` é o tom mais escuro dele: o contraste
    é medido contra o pior caso.
  - **Cantos em degrau.** Todo botão (e o grupo de abas do Feed e a ordem
    da Dex) tem cantos "arredondados" de pixel art: `clip-path: polygon()`
    com dois degraus de 2 px por canto (`--degraus`), nunca
    `border-radius`, que daria curva com antialias. Como o `clip-path` corta
    a borda, a moldura é a cor de fundo do botão em volta de um miolo de dois
    tons uma unidade menor, com um quadrado de 2 px em cada canto de dentro
    fechando o degrau (`--moldura-degrau`, definida no próprio elemento: as
    `--b-*` de cada variante só existem nele). Foco = moldura amarela (o
    `outline` ficaria fora do recorte). Link com cara de botão usa a classe
    `botao`. Os botões das ações do post são de madeira clara: os ícones do
    feed têm contorno escuro, que sumiria no marrom.
  - **Combobox da espécie (Registrar Captura).** Era um `<input list>` com
    `<datalist>`, mas a lista do datalist é desenhada pelo navegador (escura,
    de sistema) e nenhum CSS a alcança. Virou um combobox com busca feito com
    o `useCombobox` do **Downshift** — a única dependência de interface do
    frontend (+12,7 KB gzip): papéis ARIA, `aria-activedescendant`, setas,
    Enter, Esc (fecha; de novo, limpa), Tab (escolhe a destacada) e clique
    vêm dele; marcação e estilo são nossos. O texto do campo é do Downshift
    (controlá-lo de fora perde letras ao digitar rápido). A busca vale para
    o nome popular e o científico, mas a lista mostra só o popular (uma linha
    por opção: no celular cabem 7 em vez de 5); o científico aparece na dica,
    depois de escolher. O campo é igual aos vizinhos; no tema, só a lista tem
    a moldura em degrau dos botões, em madeira, e a opção ativa fica amarela,
    com os nomes na sans-serif. Sem o tema, a lista é neutra (branca, fio
    fino) — não volta a ser a do navegador.
  - **Menos intensidade fora da Dex.** A Dex (cartas, itens bloqueados) é a
    única tela "de jogo" e fica com a moldura pesada; nas outras o Layout
    marca `data-tela="outra"`, e painel e cartões ganham fio de 1 px, sem
    chanfro nem pontilhado, e mais respiro. Mesma paleta, fontes, ícones e
    botões: um app só, com intensidade menor.
  - **Ícones e sprites.** `<Icone>` põe no HTML a versão padrão (emoji ou
    SVG de traço) e um span vazio para a pixel; sem o tema, o span não tem
    tamanho e some. Os sprites coloridos (`styles/retro/sprites/`, `npm run
    sprites`, todos gerados por IA e declarados em `/creditos`): ícones da
    barra e do topo, do feed, o cadeado e o tambaqui (no lugar da foto que
    falta). O script separa o desenho do cinza do fundo, reduz por fator
    inteiro com pixel só opaco ou transparente e cor média só do desenho (sem
    halo; confere as bordas) e, na animação, prende a cabeça no lugar — da
    folha de 25 quadros do tambaqui, só 8 (0–7) têm a cabeça consistente
    (≤ 5% de mudança por quadro). Sobre as barras escuras, os sprites ganham
    um contorno de 1 px em madeira clara (sombras sem desfoque); o de
    localização, de pergaminho claro, ganha um contorno escuro nos botões de
    madeira clara. Ícone com borda abaixo de 3:1 contra o fundo ganha
    contorno. Os dois ícones sem sprite (denunciar e editar) são da Streamline
    "Pixel - Free" (CC BY 4.0), redesenhados por `npm run pixel-icons` na
    grade real deles (21 × 21); só esses dois originais ficam no
    repositório.
  - **Avatar sem foto.** Uma cor por conta, de uma paleta fechada de oito
    tons fundos, escolhida por hash (FNV-1a) do id: a mesma em qualquer
    aparelho. Letra branca, mínimo 7,29:1.
- **Miniaturas na grade da Dex.** A grade nunca baixa a foto inteira: cada
  foto tem uma miniatura de ~400 px, cor cheia, WebP (`lib/pixel.js`, com o
  sharp) — nítida no card e leve (~370 KB a grade toda, contra ~2,1 MB das
  fotos inteiras). As do repositório saem de `npm run thumbs`
  (`assets/species/thumb/`, versionadas); a da foto que o admin envia é gerada
  ao salvar a espécie (se a imagem estiver corrompida, a espécie é salva sem
  miniatura e o card usa a inteira). A ficha abre a foto inteira. O gerador
  da versão pixel art (96 px, 48 cores), do experimento anterior, continua
  no código: `npm run pixel` gera de novo, se a ideia voltar.
- **Grade da Dex.** Ordenada por raridade (da mais rara à comum) e, dentro
  dela, por nome; "A–Z" deixa só alfabética (fica na URL, `?ordem=nome`). A
  espécie pescada ganha a cor da raridade na borda e no pé do card, a mesma do
  selo: incomum verde, raro rosa, muito raro ouro velho (escuro, longe do
  amarelo de ativo; o foco do card é outro desenho, um anel amarelo com fio
  escuro por fora). Comum e bloqueadas, neutras. A barra de progresso é a
  de console da referência — corpo retangular de cantos retos e, em cada
  ponta, uma tampa reta da altura do miolo, num degrau só em ângulo reto —,
  verde em blocos de 4 px, e vira ouro, com um brilho que passa, em 100% (sem
  o brilho com `prefers-reduced-motion`); tudo em pixel inteiro, até a ponta:
  a largura da barra é arredondada para múltiplo de 4 e o miolo também, para
  o preenchido fechar a 100% sem fresta (e o respiro lateral do painel no
  celular é em px, não rem, para nada começar em meio pixel). O muito raro é
  ouro vivo, separado do amarelo de ativo pelo tratamento: borda de ouro
  escuro com chanfro claro e médio por dentro e pé em xadrez de dois ouros
  (metal), e selo em dois tons. O admin tem "Ver Dex completa" no
  Perfil: uma prévia (`?previa=completa`) com toda espécie como pescada, só
  na tela — nada é gravado e o RGN-10 não muda.
- **Navegação de app.** As abas principais ficam numa barra embaixo — Dex |
  Registrar Captura | Feed | Notificações (com o número de não lidas no
  ícone) —, ícone sobre o rótulo, como em app de celular:
  rodapé encaixado, na largura toda da tela em qualquer tamanho, separado do
  conteúdo por um fio (sem sombra); na tela larga só os itens ficam
  centralizados. A ativa tem um traço curto em cima e a cor de destaque. O
  padding de baixo usa `env(safe-area-inset-bottom)` (com `viewport-fit=cover`
  no `index.html`, senão vale 0 no iPhone), e o conteúdo reserva embaixo a
  altura da barra (`--altura-abas`) para o fim do feed e da Dex não ficar
  escondido.
  No tema retrô, as abas não têm caixa (fio fino entre elas), ícone e rótulo
  ficam centralizados, e no celular o rótulo visível de Registrar Captura é
  só "Registrar" (o nome acessível é o inteiro).
  No topo ficam só o título, centralizado (no tema, com o tambaqui ao lado —
  é o logo: 2× no topo, 3× em cima do nome no login, sempre múltiplo inteiro
  do sprite),
  e o perfil (a foto, ou o @apelido de quem não tem foto). Configurações (em
  destaque, como botão), Créditos e Sair saíram do topo e estão no Perfil. A
  busca de pessoas virou a aba "Pessoas" do Feed, ao lado de Seguindo,
  Descobrir e (admin) Denunciadas; a aba fica na URL (`?aba=pessoas`), e o
  endereço antigo `/pessoas` redireciona para lá. As abas do Feed dividem a
  linha em partes iguais e cabem em 375 px sem rolagem lateral.

- **App instalável (PWA), sem modo offline.** No celular, o site se instala
  como app: `public/manifest.webmanifest` (nome, `display: standalone`, cor
  do tema = a madeira escura das barras, `#3d2414`), ícones de 192 e 512 px, um
  *maskable* com margem para o recorte do Android e o `apple-touch-icon` do
  iOS. **Não há service worker:** o Chrome não exige mais um para oferecer a
  instalação, e cache offline está fora do escopo (ver DIVERGENCIAS.md). O
  favicon e os ícones do app saem do mesmo tambaqui do topo
  (`sprites/barra-dex.png`), com o contorno claro de 1 pixel:
  `backend/database/icons.js` (`npm run icons`, depois do `npm run sprites`)
  faz o `favicon.svg` com um retângulo por pixel do desenho (nítido em
  qualquer tamanho) e os PNGs ampliados por fator inteiro sobre a madeira
  escura das barras — o maskable com margem para o círculo de 80% que o
  Android garante (versionados em `frontend/public/`). No iPhone instalado a
  página vai por baixo da barra de status (`black-translucent`): o topo e as
  telas fora do Layout (login, créditos) somam `env(safe-area-inset-top)`,
  e a barra de abas já somava o de baixo; com o celular deitado, os lados
  respeitam o entalhe. A cor do tema está fixa no manifesto e no
  `index.html`: se o tema retrô sair, troque as duas pelo `--agua`.
  Instalar exige HTTPS (ou `localhost`).

## Problemas conhecidos

- **Fotos órfãs.** Cada foto sobe assim que o usuário a escolhe, antes de a
  captura ser salva. Se ele desistir do formulário, ou remover a foto da
  lista, o arquivo fica em `backend/uploads/` sem nenhuma captura apontando
  para ele. O mesmo acontece ao **apagar uma captura** ou **trocar as fotos**
  dela: as linhas de `catch_photos` saem, os arquivos ficam. Hoje não há
  limpeza. **Adiado de propósito:** no disco local, arquivo órfão não custa
  nada agora, e o tempo vai para o que o documento de requisitos exige. O
  conserto certo, se sobrar tempo no fim, é uma tabela `uploads` (dono, data,
  se está em uso) e uma limpeza periódica dos arquivos sem uso há mais de um
  dia. (O dono da foto já é garantido sem essa tabela, pela pasta por usuário.)
- **Fotos de antes da pasta por usuário.** As poucas fotos enviadas antes
  dessa mudança ficaram na raiz de `uploads/`. Continuam aparecendo e podem
  ser mantidas ou removidas da captura dona delas, mas não podem ser usadas
  numa captura nova.

## Comandos

```bash
# o banco é o MySQL local na porta 3306 (ver README)

cd backend
npm run dev                       # API em http://localhost:3333
npm run migrate                   # aplica os .sql novos de database/migrations
npm run seed                      # popula o catálogo (idempotente)
npm run credits                   # regera o CREDITOS.md (fotos do catálogo)
npm run sprites                   # recorta os sprites do tema (originais em peixes/, só local)
npm run pixel-icons               # redesenha os ícones da Streamline usados
npm run icons                     # regera os ícones do app instalável (frontend/public)

cd frontend
npm run dev                       # http://localhost:5173
npm run build                     # typecheck + build
```

Para mudar o schema: crie um `.sql` novo e numerado em `database/migrations/` e
rode `npm run migrate`. Nunca edite uma migration já aplicada.
