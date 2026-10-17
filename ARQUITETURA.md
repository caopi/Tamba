# Tamba — arquitetura e convenções

Diário de pescarias no formato "Pokédex de peixes": o usuário registra as capturas
(espécie, peso, tamanho, local, foto) e acompanha quais espécies do catálogo ainda
faltam. Projeto de faculdade (IFSP), de um semestre, tocado por **um dev sozinho**.

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
│   │   └── seed.js        Catálogo de espécies + pesqueiros de exemplo
│   └── src/
│       ├── server.js      Sobe o HTTP (só isso)
│       ├── app.js         Monta o Express: cors, json, rotas, erros
│       ├── routes/        Só declaram caminho → controller
│       ├── controllers/   Traduzem HTTP ↔ service (req → argumentos, retorno → res)
│       ├── services/      Regras de negócio (RGN-xx) + validação Zod
│       ├── models/        Acesso ao banco: SQL cru via mysql2
│       ├── middlewares/   requireAuth, requireAdmin, errorHandler
│       └── lib/           db.js (pool, transação), jwt.js, mailer.js, authz.js, asyncHandler.js
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
  pela collation, não diferencia maiúscula. `is_active` nasce FALSE e só vira TRUE
  ao confirmar o e-mail — as contas criadas antes da migration 003 foram ativadas
  por ela (ver o comentário lá). `role` é `user` ou `admin`. `measurement_unit` é
  só preferência de exibição; `share_exact_location` controla o RGN-13.
- **fish_species** — catálogo da Dex. O seed popula; depois disso só **admin**
  cria e edita (RGN-16). `name` é UNIQUE: é a chave do upsert do seed.
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
- **fishing_spots** — `google_place_id` fica nulo até integrarmos o Google Places.
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
- **catch_photos** — 1..10 fotos por captura, ordenadas por `position`.
  **`catches.photo_url` é legado:** espelha a foto de posição 0 enquanto o
  frontend antigo lê só ela, e o model mantém as duas em sincronia
  (`replacePhotos`). Vai sair numa migration própria depois que o frontend
  passar a usar `photos`.
- **follows / likes / user_favorite_species** — chave primária composta pelo
  par: é ela que impede duplicata (RGN-15). "Não seguir a si mesmo" é trigger
  (migration 007), porque o MySQL não aceita CHECK em coluna com FK CASCADE.
- **reports** — UNIQUE (`reporter_id`, `catch_id`): cada linha é um usuário
  distinto, então o RGN-14 é só um COUNT.
- **notifications** — `user_id` recebe, `actor_id` fez a ação; `catch_id` é
  nulo para `follow`.

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
| RGN-01 | `auth.service` — `signupSchema`, `signup`, `verifyEmail` | E-mail válido e único; conta só ativa após confirmar o e-mail (link de 24h, reenviável) |
| RGN-02 | `auth.service` — `signupSchema`, `signup`; `user.service.updateMe` | Apelido único (sem diferenciar maiúscula) |
| RGN-03 | `auth.service` — `signupSchema` | Senha com no mínimo 8 caracteres |
| RGN-04 | `auth.service.login` | Só usuário ativo entra (403 `EMAIL_NOT_VERIFIED`) |
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
- **Foto é só uma URL de texto.** Não há upload de arquivo. A estratégia real
  (Cloudinary, S3, disco local) fica para quando a tela de captura estiver madura.
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
- **Primeiro admin pelo `.env`.** O `npm run seed` promove a conta de
  `ADMIN_EMAIL`, se ela já existir (não cria conta). Não há rota para virar admin.
- **Seed nunca sobrescreve.** O upsert usa `COALESCE(coluna, novo.coluna)`: só
  preenche o que está NULL. Corrigir um dado no `seed.js` não altera espécie que
  já está no banco — isso se faz pela rota de admin.

## Comandos

```bash
# o banco é o MySQL local na porta 3306 (ver README)

cd backend
npm run dev                       # API em http://localhost:3333
npm run migrate                   # aplica os .sql novos de database/migrations
npm run seed                      # popula o catálogo (idempotente)

cd frontend
npm run dev                       # http://localhost:5173
npm run build                     # typecheck + build
```

Para mudar o schema: crie um `.sql` novo e numerado em `database/migrations/` e
rode `npm run migrate`. Nunca edite uma migration já aplicada.
