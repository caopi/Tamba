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

- Node.js 20 ou superior (testado no 22)
- MySQL 8 rodando localmente

---

## Configuração

### 1. Banco de dados

Crie o banco e um usuário só para o projeto:

```sql
CREATE DATABASE tamba CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE USER 'tamba'@'localhost' IDENTIFIED BY 'troque-essa-senha';
GRANT ALL PRIVILEGES ON tamba.* TO 'tamba'@'localhost';
FLUSH PRIVILEGES;
```

Rode no MySQL Workbench ou pelo terminal (`mysql -u root -p`). Usar um usuário
dedicado em vez do `root` evita colocar a senha do root no `.env`.

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env
```

Abra o `backend/.env` e preencha:

| Variável | Para que serve |
| --- | --- |
| `DATABASE_URL` | Conexão com o MySQL. Formato: `mysql://usuario:senha@localhost:3306/tamba` |
| `JWT_SECRET` | Segredo que assina os tokens. **Troque por um valor aleatório.** |
| `JWT_EXPIRES_IN` | Validade do token. Padrão `7d`. |
| `PORT` | Porta da API. Padrão `3333`. |
| `CORS_ORIGIN` | Endereço do frontend. Padrão `http://localhost:5173`. |

Para gerar um `JWT_SECRET` decente:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Depois crie as tabelas e popule o catálogo de espécies:

```bash
npm run migrate    # roda os .sql de database/migrations em ordem
npm run seed       # insere as 34 espécies e 3 pesqueiros de exemplo
```

Os dois comandos podem ser rodados quantas vezes você quiser: o `migrate` pula
o que já foi aplicado e o `seed` atualiza em vez de duplicar.

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

Abra <http://localhost:5173>, crie uma conta e registre a primeira captura.

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
| `users` | Contas. Guarda só o hash bcrypt da senha. |
| `fish_species` | Catálogo fixo (a Dex). `name` é UNIQUE — é a chave do upsert do seed. |
| `fishing_spots` | Pesqueiros. `google_place_id` fica nulo até integrar o Google Places. |
| `catches` | Capturas. FK para as três tabelas acima. `spot_name` guarda o local digitado à mão. |

Ao apagar: usuário leva junto as capturas dele (`CASCADE`), pesqueiro só
desassocia (`SET NULL`), e espécie usada por alguma captura não pode ser apagada
(`RESTRICT`).

---

## Endpoints da API

Base: `http://localhost:3333/api`. As rotas privadas exigem o header
`Authorization: Bearer <token>`.

| Método | Rota | Acesso | Descrição |
| --- | --- | --- | --- |
| `GET` | `/health` | público | Checagem rápida |
| `POST` | `/auth/signup` | público | Cria conta e já devolve o token |
| `POST` | `/auth/login` | público | Faz login e devolve o token |
| `GET` | `/auth/me` | privado | Dados do usuário logado |
| `GET` | `/species` | público | Catálogo completo de espécies |
| `GET` | `/species/:id` | público | Uma espécie |
| `GET` | `/spots` | público | Lista de pesqueiros |
| `GET` | `/catches` | privado | Capturas do usuário logado |
| `GET` | `/catches/:id` | privado | Uma captura |
| `POST` | `/catches` | privado | Registra uma captura |
| `PUT` | `/catches/:id` | privado | Edita uma captura |
| `DELETE` | `/catches/:id` | privado | Apaga uma captura |

Exemplo de corpo para `POST /catches`:

```json
{
  "speciesId": "uuid-da-especie",
  "spotId": "uuid-do-pesqueiro-ou-null",
  "spotName": "Pesqueiro Recanto Azul",
  "weight": 3.4,
  "length": 52,
  "photoUrl": "https://exemplo.com/foto.jpg",
  "caughtAt": "2026-09-01T08:30:00.000Z"
}
```

`weight` é em **kg** e `length` em **cm**. `spotId`, `spotName` e `photoUrl` são
opcionais. Enquanto o Google Places não entra, o formulário manda o local como
texto livre em `spotName` e deixa `spotId` nulo.

---

## Telas

| Rota | Tela |
| --- | --- |
| `/login` | Login e cadastro |
| `/` | Fish Dex — catálogo com contador de progresso; clicar num peixe abre a ficha |
| `/registrar` | Formulário de nova captura |
| `/perfil` | Perfil, estatísticas e histórico ordenável por data ou peso |

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


