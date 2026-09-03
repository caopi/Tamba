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
│   │   └── seed.js        Catálogo de espécies + pesqueiros de exemplo
│   └── src/
│       ├── server.js      Sobe o HTTP (só isso)
│       ├── app.js         Monta o Express: cors, json, rotas, erros
│       ├── routes/        Só declaram caminho → controller
│       ├── controllers/   Validação (Zod) + regra; chamam os models
│       ├── models/        Acesso ao banco: SQL cru via mysql2
│       ├── middlewares/   requireAuth, errorHandler
│       └── lib/           db.js (pool), jwt.js, asyncHandler.js
└── frontend/src/
    ├── api/               Cliente HTTP: client.ts + um arquivo por recurso
    ├── context/           AuthContext (usuário logado + token)
    ├── components/        Layout, ProtectedRoute
    ├── pages/             Uma pasta-irmã .tsx + .css por tela
    ├── styles/global.css  Variáveis de cor e reset
    └── types.ts           Tipos espelhando as respostas da API
```

## Modelo de dados

`User 1:N Catch`, `FishSpecies 1:N Catch`, `FishingSpot 1:N Catch`.

- **users** — `password_hash` nunca sai da API (existe um `select publicUser` no controller).
- **fish_species** — catálogo **fixo**, populado pelo seed. O usuário não cria espécie.
  `name` é UNIQUE: é a chave do upsert do seed. `recommended_baits` é uma string
  simples separada por vírgula ('massa, milho, minhoca'), de propósito — não vale
  uma tabela só para isso.
- **fishing_spots** — `google_place_id` fica nulo até integrarmos o Google Places.
- **catches** — registro central. `spot_id` e `photo_url` são opcionais.
  `weight` em **kg**, `length` em **cm**.

Deleção: apagar usuário apaga as capturas (`Cascade`); apagar pesqueiro só zera o
`spotId` (`SetNull`); espécie usada por alguma captura não pode ser apagada (`Restrict`).

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

**Controllers.** Sempre embrulhados em `asyncHandler`. Validam a entrada com um
schema Zod no topo do arquivo e lançam `httpError(status, msg)` para os casos de
erro — o `errorHandler` converte tudo em JSON. Nunca use `try/catch` só para
responder 500.

**Autorização.** Toda query de captura filtra por `userId: req.userId`. Para editar
e apagar use `updateMany`/`deleteMany` com o `userId` no `where` e cheque o `count`:
isso garante que ninguém mexa no dado de outro usuário. Não pule esse padrão.

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

## Fora do escopo (ainda)

Feed de posts e sistema de amigos/contas conectadas — é o objetivo final do projeto,
mas **não existe modelo nem endpoint** para isso ainda. Ao implementar, provavelmente
entram as entidades `Follow` e `Post`.

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
