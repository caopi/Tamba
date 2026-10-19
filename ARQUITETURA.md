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
│   ├── uploads/           Fotos enviadas (driver local do storage). Fora do git
│   └── src/
│       ├── server.js      Sobe o HTTP (só isso)
│       ├── app.js         Monta o Express: cors, json, rotas, erros
│       ├── routes/        Só declaram caminho → controller
│       ├── controllers/   Traduzem HTTP ↔ service (req → argumentos, retorno → res)
│       ├── services/      Regras de negócio (RGN-xx) + validação Zod
│       ├── models/        Acesso ao banco: SQL cru via mysql2
│       ├── middlewares/   requireAuth, requireAdmin, errorHandler
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
  (migration 012).
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
- **catch_photos** — 1..10 fotos por captura, ordenadas por `position`; a de
  posição 0 é a capa. `url` aponta para o armazenamento do `lib/storage.js` — a
  API só aceita foto enviada por `POST /api/uploads` (REQ-15), não link externo.
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
  (REQ-28). Ordem cronológica ou por engajamento (REQ-35), em que a nota é
  curtidas + 2 × comentários (comentar dá mais trabalho que curtir), sem janela
  de tempo — com o volume do projeto, isso basta. Paginação com um `cursor`
  opaco: no cronológico é a data do último item (post novo no topo não
  repete item na página seguinte); no engajamento é um offset, porque a ordem
  muda a cada curtida e não há cursor estável.
- **Sugestões de quem seguir (REQ-36).** Os mais seguidos, desempatando por
  quem postou mais recentemente, e só quem tem pelo menos uma captura visível —
  seguir um perfil vazio não resolveria o feed vazio. Ficam no estado vazio do
  feed e na tela de busca de pessoas.
- **Fotos em disco local — escolha deliberada de desenvolvimento.** O upload
  (`POST /api/uploads`, multer) grava em `backend/uploads/` e a própria API
  serve os arquivos em `/uploads`. Assim ninguém do grupo precisa de conta ou
  credencial em serviço externo. Fica atrás de `lib/storage.js` (`save` /
  `getUrl` / `belongsTo`), no mesmo padrão do mailer: trocar de destino é
  escrever outro driver nesse arquivo. Cada usuário tem a sua pasta
  (`uploads/<id do usuário>/`), e a captura só aceita foto cuja URL esteja na
  pasta do próprio autor — ninguém anexa a foto de outra pessoa copiando a URL
  do feed (`PHOTO_NOT_OWNED`). Na edição, as fotos que a captura já tinha
  continuam aceitas, para dar para reordenar ou remover as antigas. **Em produção isso não serve**: o disco
  do servidor some a cada novo deploy, não é compartilhado entre instâncias e
  não tem backup. Produção precisaria de um armazenamento de objetos (S3,
  Cloudinary ou equivalente), de preferência atrás de uma CDN, com as
  credenciais no ambiente do servidor — e de `UPLOADS_PUBLIC_URL` apontando
  para lá.
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
  - **Fotos da equipe.** Seis espécies usam foto da própria equipe ("Equipe
    Tamba", todos os direitos reservados — não são CC). Os originais ficam
    fora do git (pasta `peixes/`, só local) porque tinham pessoas no quadro e
    podiam carregar o GPS do pesqueiro (RGN-13). No repositório só entra o
    recorte no peixe, regravado a partir dos pixels, sem nenhum metadado; o
    recorte mais largo que 3:2 é completado com uma cópia desfocada dele
    mesmo, para o card não cortar cabeça e cauda.
  - **Duas origens, um caminho.** A espécie que o admin cadastra pelo app
    ganha foto por upload comum. No banco, `image_url` é um caminho relativo
    à API (`/assets/species/tambaqui.webp`) ou a URL absoluta do upload; o
    `storage.publicUrl` resolve os dois com `new URL(ref, PUBLIC_API_URL)`, e
    é chamado só onde as linhas viram resposta (models de espécie e de
    captura). Da API para fora existe uma URL só. Na escrita
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
  tema, e nenhum componente tem estilo retrô no próprio CSS. Paleta em
  variáveis `--retro-*` (rampa de azul-escuro), que também redefinem as
  variáveis globais (`--agua`, `--texto`...). Fonte pixel (Press Start 2P nos
  títulos, Silkscreen em rótulos, botões, números e na barra de abas); texto
  corrido, descrições e campos continuam sans-serif, porque fonte pixel
  pequena reprova no RNF-13. Sem canto arredondado, borda grossa e chanfro
  com sombra interna dura; a barra de abas vira um HUD. O conteúdo fica
  sempre num painel sólido, nunca direto sobre a cena (CC0, crédito em
  `/creditos`). Contraste conferido em todas as telas: mínimo 5,5:1.
  - **16 bits no feed.** O tema é 8 bits (blocos chapados, borda de 3–4 px,
    chanfro de 3 px); os cards do feed já são 16 bits: rampa com tons
    intermediários, borda de 2 px, chanfro de 1 px e sombreado pontilhado
    (xadrez de 2×2 px entre dois tons vizinhos) no lugar do degrau seco.
- **Miniaturas na grade da Dex.** A grade nunca baixa a foto inteira: cada
  foto tem uma miniatura de ~400 px, cor cheia, WebP (`lib/pixel.js`, com o
  sharp) — nítida no card e leve (~370 KB a grade toda, contra ~2,1 MB das
  fotos inteiras). As do repositório saem de `npm run thumbs`
  (`assets/species/thumb/`, versionadas); a da foto que o admin envia é gerada
  ao salvar a espécie (se a imagem estiver corrompida, a espécie é salva sem
  miniatura e o card usa a inteira). A ficha abre a foto inteira. O gerador
  da versão pixel art (96 px, 48 cores), do experimento anterior, continua
  no código: `npm run pixel` gera de novo, se a ideia voltar.
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
  No topo ficam só o título, centralizado, e o perfil (a foto, ou o @apelido
  de quem não tem foto). Configurações, Créditos e Sair saíram do topo e estão no Perfil. A
  busca de pessoas virou a aba "Pessoas" do Feed, ao lado de Seguindo,
  Descobrir e (admin) Denunciadas; a aba fica na URL (`?aba=pessoas`), e o
  endereço antigo `/pessoas` redireciona para lá. As abas do Feed dividem a
  linha em partes iguais e cabem em 375 px sem rolagem lateral.

- **App instalável (PWA), sem modo offline.** No celular, o site se instala
  como app: `public/manifest.webmanifest` (nome, `display: standalone`, cor
  do tema = o azul das barras, `#1d2b73`), ícones de 192 e 512 px, um
  *maskable* com margem para o recorte do Android e o `apple-touch-icon` do
  iOS. **Não há service worker:** o Chrome não exige mais um para oferecer a
  instalação, e cache offline está fora do escopo (ver DIVERGENCIAS.md). O
  ícone é um peixe em pixel art descrito como grade de caracteres em
  `backend/database/icons.js`; `npm run icons` gera os PNGs e o
  `favicon.svg` em `frontend/public/` (versionados). No iPhone instalado a
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
npm run icons                     # regera os ícones do app instalável (frontend/public)

cd frontend
npm run dev                       # http://localhost:5173
npm run build                     # typecheck + build
```

Para mudar o schema: crie um `.sql` novo e numerado em `database/migrations/` e
rode `npm run migrate`. Nunca edite uma migration já aplicada.
