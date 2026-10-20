# Deploy do Tamba

Roteiro para o primeiro deploy em produção. Foi escrito para ser seguido só
com este arquivo, na ordem: primeiro as mudanças de código que ainda faltam
(seção 1), depois a infraestrutura (seções 2 a 6) e por fim a conferência
(seção 9). Para a estrutura do código, ver [ARQUITETURA.md](ARQUITETURA.md);
para rodar localmente, o [README.md](README.md).

O que vai para o ar são quatro peças:

| Peça | O que é | Onde mora hoje |
| --- | --- | --- |
| API | Node + Express (`backend/`), sobe com `npm start` | — |
| Banco | MySQL 8 | — |
| Fotos enviadas | arquivos das capturas, avatares e fotos de espécie enviadas pelo admin | disco local, `backend/uploads/` (só serve para desenvolvimento) |
| Frontend | site estático gerado por `npm run build` (`frontend/dist/`) | — |

As fotos do catálogo (`backend/assets/`) estão no git e a própria API as
serve em `/assets`: não precisam de armazenamento externo.

---

## 1. Mudanças de código antes do deploy

Duas mudanças são **obrigatórias** (sem elas o deploy não funciona ou perde
dados). A terceira, limite de requisições, está na seção 7.

### 1.1 Driver de armazenamento de objetos para os uploads (obrigatório)

**Por quê.** Hoje as fotos enviadas vão para `backend/uploads/`, no disco do
servidor. Em hospedagem de aplicação esse disco é apagado a cada deploy, não
é compartilhado entre instâncias e não tem backup: as fotos sumiriam.

**Onde.** `backend/src/lib/storage.js`. O resto do código só conhece as
funções exportadas; basta escrever um driver novo nesse arquivo e trocar a
linha `const driver = localDriver;`. Serve qualquer serviço compatível com S3
(Cloudflare R2, AWS S3, Backblaze B2...), por exemplo com o pacote
`@aws-sdk/client-s3`.

**O contrato que o driver novo precisa cumprir** (são os quatro métodos do
`localDriver`, e todos são usados):

| Método | Quem usa | O que precisa fazer |
| --- | --- | --- |
| `save({ buffer, extension, ownerId })` | upload de foto (`upload.service.js`) e miniatura da foto de espécie (`species.service.js`) | Validar `ownerId` com o regex `UUID` do arquivo, gerar o nome com `randomBytes(16).toString("hex")` + `.` + `extension`, gravar no bucket com a chave `<ownerId>/<nome>` e devolver essa chave. Enviar `ContentType` certo (`image/jpeg`, `image/png` ou `image/webp`) e `Cache-Control: public, max-age=31536000, immutable` (o nome é aleatório e nunca muda). |
| `getUrl(id)` | depois do `save` | Devolver `` `${URL_PUBLICA}/${id}` `` — igual ao local. |
| `belongsTo(url, ownerId)` | captura, avatar e foto de espécie: impede anexar a foto de outra pessoa copiando a URL do feed | Pode ficar **idêntico** ao do `localDriver`: só compara o prefixo `UPLOADS_PUBLIC_URL/<ownerId>/` e o formato do nome. |
| `readUrl(url, ownerId)` | gera a miniatura quando o admin troca a foto de uma espécie | Conferir `belongsTo`, tirar o prefixo `UPLOADS_PUBLIC_URL/` da URL para obter a chave e baixar o objeto do bucket (`GetObject`), devolvendo um `Buffer`. |

Mantenha o formato de chave `<ownerId>/<32 hex>.<ext>`: é dele que o
`belongsTo` depende.

**Credenciais.** Ficam só no ambiente do servidor, nunca no git. Os nomes
abaixo são sugestão (ainda não existem no código); se mudar, atualize a
tabela da seção 2 e o `backend/.env.example`:

```
S3_ENDPOINT="https://<id da conta>.r2.cloudflarestorage.com"   # R2; na AWS, omita
S3_REGION="auto"                                              # R2 usa "auto"
S3_BUCKET="tamba-uploads"
S3_ACCESS_KEY_ID="..."
S3_SECRET_ACCESS_KEY="..."
```

A chave de acesso precisa só de leitura e escrita **nesse bucket**.

**Acesso público.** O navegador abre as fotos direto do bucket, então ele
precisa de leitura pública (no R2: domínio próprio ligado ao bucket; o
endereço `*.r2.dev` é limitado e não é para produção). `UPLOADS_PUBLIC_URL`
aponta para esse endereço, por exemplo `https://fotos.exemplo.com.br`.

> **Atenção: `UPLOADS_PUBLIC_URL` não pode mudar depois do lançamento.** O
> banco guarda a URL **absoluta** de cada foto enviada
> (`https://fotos.exemplo.com.br/<id>/<nome>.jpg`), e o `belongsTo` compara
> esse prefixo. Trocar o domínio depois quebra todas as fotos antigas e
> impede de editar capturas antigas. Escolha o domínio definitivo antes.
>
> Pelo mesmo motivo, **não copie o banco de desenvolvimento** para produção:
> as fotos dele apontam para `http://localhost:3333/uploads/...`. Produção
> começa com um banco novo (seção 4).

**Como testar antes do deploy.** Rode a API local com o driver novo e as
variáveis do bucket, envie uma foto numa captura, confira que ela abre pela
URL pública e, logado como admin, troque a foto de uma espécie (isso
exercita `readUrl`).

### 1.2 `npm start` sem arquivo `.env` (obrigatório)

**Por quê.** Os scripts usam `node --env-file=.env`. Em hospedagem, as
variáveis vêm do painel e não existe `.env`; nesse caso o Node **sai com
erro** ("not found") antes de subir a API.

**O que mudar** em `backend/package.json`: trocar `--env-file=.env` por
`--env-file-if-exists=.env` nos scripts `start`, `migrate` e `seed` (pode
trocar no `dev` também). Exige Node **22.9 ou mais novo**: fixe a versão do
Node no host (por exemplo, `"engines": { "node": ">=22.9" }` no
`package.json` do backend, ou a configuração equivalente do provedor).

### 1.3 Confirmação de e-mail (decisão, não bloqueia)

O envio de e-mail só tem o driver de console (`backend/src/lib/mailer.js`):
o e-mail é impresso no log da API, ninguém o recebe. Portanto, em produção,
**mantenha `REQUIRE_EMAIL_VERIFICATION=false`** — com `true`, nenhuma conta
nova conseguiria entrar. Para ligar a confirmação, primeiro escreva um driver
SMTP com o mesmo `send({ to, subject, text })` (ex.: nodemailer) e coloque as
credenciais no ambiente.

---

## 2. Variáveis de ambiente

### 2.1 API (`backend/`)

Configure no painel do host (em produção não há `.env`). Referência
comentada: `backend/.env.example`.

| Variável | Valor em produção | Observação |
| --- | --- | --- |
| `NODE_ENV` | `production` | Faz o seed recusar as contas de desenvolvimento. |
| `DATABASE_URL` | `mysql://usuario:senha@host:3306/tamba` | Senha com `@ : # /` precisa ser codificada em URL (`@` vira `%40`). Se o provedor exigir TLS, acrescente `?ssl={"rejectUnauthorized":true}` (o `mysql2` lê o JSON da query string) e teste a conexão com `npm run migrate`. |
| `JWT_SECRET` | valor longo e aleatório | Gere com `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. A API não sobe sem ele. Trocar depois desloga todo mundo. |
| `JWT_EXPIRES_IN` | `7d` | Não há refresh token. |
| `PORT` | o que o host definir | Muitos hosts injetam `PORT` sozinhos; a API usa 3333 se faltar. |
| `CORS_ORIGIN` | `https://tamba.exemplo.com.br` | Endereço exato do frontend, sem barra no final. Ver seção 3. |
| `PUBLIC_API_URL` | `https://api.exemplo.com.br` | Endereço público da API, **sem** `/api`. É a base das fotos do catálogo (`/assets/...`). |
| `UPLOADS_PUBLIC_URL` | `https://fotos.exemplo.com.br` | Endereço público do bucket. **Definitivo**: ver o aviso da seção 1.1. |
| `FRONTEND_URL` | `https://tamba.exemplo.com.br` | Para onde o link de confirmação de e-mail redireciona. |
| `EMAIL_VERIFICATION_URL` | `https://api.exemplo.com.br/api/auth/verify-email` | Link que vai no e-mail de confirmação. |
| `REQUIRE_EMAIL_VERIFICATION` | `false` | Ver seção 1.3. |
| `SEED_DEV_USERS` | `false` | **Nunca** `true` em produção: cria contas com a senha pública `admin123`. |
| `ADMIN_EMAIL` | e-mail do primeiro admin | Usado só pelo seed. Ver seção 4.4. |
| `REPORT_HIDE_THRESHOLD` | `3` | Quantas denúncias de pessoas diferentes ocultam uma captura. `1` é só para demonstração. |
| `S3_*` | credenciais do bucket | Criadas na seção 1.1. |

### 2.2 Frontend (`frontend/`)

| Variável | Valor em produção | Observação |
| --- | --- | --- |
| `VITE_API_URL` | `https://api.exemplo.com.br/api` | **Com** `/api` no final. É gravada no JavaScript **na hora do build**: defina-a nas variáveis de build do host e gere o build de novo sempre que ela mudar. Sem ela, o site tenta falar com `http://localhost:3333/api`. |

---

## 3. CORS

- A API libera **uma única origem**, a de `CORS_ORIGIN`
  (`backend/src/app.js`). Coloque o endereço exato do frontend: esquema,
  domínio e porta, se houver, sem barra no final
  (`https://tamba.exemplo.com.br`).
- `https://tamba.exemplo.com.br` e `https://www.tamba.exemplo.com.br` são
  origens diferentes. Escolha uma e redirecione a outra para ela no host do
  frontend. Se precisar de mais de uma (por exemplo, URLs de preview), mude o
  `app.js` para aceitar uma lista, como `CORS_ORIGIN.split(",")`.
- O login usa token no cabeçalho `Authorization`, não cookie: não é preciso
  `credentials`.
- As imagens (catálogo e bucket) entram por `<img>`, que não depende de
  CORS. O bucket não precisa de regra de CORS.

---

## 4. Banco de dados (banco novo)

### 4.1 Requisitos do MySQL

- **MySQL 8.0.19 ou mais novo.** MariaDB não serve: o seed usa
  `INSERT ... AS novo ON DUPLICATE KEY UPDATE` e o banco usa a collation
  `utf8mb4_0900_ai_ci`, ambos exclusivos do MySQL 8.
- Suporte a **chaves estrangeiras**, **CHECK constraints** e **triggers**.
  Alguns MySQL gerenciados não aceitam trigger: confirme antes de contratar.
- **`log_bin_trust_function_creators = 1`.** A migration 007 cria triggers;
  com binary log ligado (padrão do MySQL 8), sem essa opção o migrate falha
  com o erro 1419. Em MySQL gerenciado, isso se liga no painel do provedor
  (grupo de parâmetros ou equivalente), porque o `SET PERSIST` de
  `setup.sql` exige privilégio de root.

### 4.2 Criar o banco e o usuário

`backend/database/setup.sql` foi feito para a máquina local: cria o usuário
`'tamba'@'localhost'` e usa `SET PERSIST`. Em produção, faça o equivalente
pelo painel do provedor ou como administrador do banco:

```sql
CREATE DATABASE tamba CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE USER 'tamba'@'%' IDENTIFIED BY '<senha forte>';
GRANT ALL PRIVILEGES ON tamba.* TO 'tamba'@'%';
```

Restrinja o `'%'` ao endereço do servidor da API, se o provedor permitir.
Monte o `DATABASE_URL` com esse usuário.

### 4.3 Ordem: migrate, depois seed

Rode a partir de `backend/`, numa máquina com Node 22.9+ e as variáveis da
seção 2.1 (no shell do host ou localmente, apontando o `DATABASE_URL` para o
banco de produção):

```bash
npm ci
npm run migrate   # aplica as migrations 001 a 017, em ordem
npm run seed      # catálogo de espécies e pesqueiros de exemplo
```

- O **migrate** anota o que já rodou na tabela `schema_migrations` e só
  aplica o que falta. Rodar de novo é seguro; é o que se faz a cada deploy
  que trouxer migration nova, **antes** de subir a versão nova da API.
- O **seed** é idempotente: rodar de novo não duplica e não sobrescreve o que
  o admin editou pelo app.
- Com `NODE_ENV=production` e `SEED_DEV_USERS=false`, nenhuma conta de teste
  é criada. Confira no log que o aviso "CONTAS DE DESENVOLVIMENTO" **não**
  aparece.

### 4.4 Primeiro admin

O seed **não cria** a conta do admin; só promove uma conta que já existe. Não
há rota para virar admin. Ordem:

1. Com a API e o frontend no ar, cadastre-se pelo app com o e-mail do admin.
2. Defina `ADMIN_EMAIL` com esse e-mail.
3. Rode `npm run seed` **de novo**. Deve aparecer "`<e-mail>` promovido a
   admin."
4. Saia e entre de novo no app para o papel novo valer.

---

## 5. API: build e hospedagem

- Instale com `npm ci` **no próprio host** (Linux). Não copie `node_modules`
  do Windows: o `sharp`, usado para gerar a miniatura da foto de espécie,
  tem binário próprio por sistema, e o `npm ci` baixa o certo. Confira no log
  do build que o `sharp` instalou sem erro.
- Comando de início: `npm start` (com a mudança da seção 1.2).
- Teste de saúde: `GET /api/health` responde `{"status":"ok"}`. Use como
  health check do host.
- Sirva a API por **HTTPS**. O frontend vai estar em HTTPS, e o navegador
  bloqueia chamadas de uma página HTTPS para uma API HTTP.
- `backend/assets/` vai junto com o código (está no git) e é servido em
  `/assets`. Nada a fazer.

---

## 6. Frontend: build e hospedagem

```bash
cd frontend
npm ci
npm run build    # com VITE_API_URL definida; gera frontend/dist/
```

Publique o conteúdo de `frontend/dist/` num host de site estático.

- **HTTPS obrigatório.** Sem ele, o app não pode ser instalado no celular.
- **Na raiz do domínio** (`https://tamba.exemplo.com.br/`), não numa
  subpasta: o manifesto do app instalável usa `start_url` e `scope` `/`.
- **Reescrita de rotas para `index.html` (obrigatório).** O app é uma SPA: as
  rotas (`/feed`, `/perfil`, `/capturas/<id>`...) só existem no JavaScript. Sem
  a reescrita, o servidor procura um arquivo `/feed`, não acha, e dá **404 ao
  recarregar a página** ou ao abrir um link compartilhado. A regra é: todo
  caminho que não for um arquivo existente serve `/index.html` com status 200.
  Exemplos:

  - **Netlify**: arquivo `frontend/public/_redirects` com
    `/*  /index.html  200`
  - **Vercel**: `frontend/vercel.json` com
    `{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }`
  - **Cloudflare Pages**: já faz isso sozinho quando não há `404.html` no
    build (não há).
  - **nginx**: `location / { try_files $uri $uri/ /index.html; }`

  Teste: abra `https://tamba.exemplo.com.br/feed` direto na barra de
  endereço e recarregue. Tem que abrir o feed, não um 404.

- **Cache.** Os arquivos em `dist/assets/` têm hash no nome e podem ter cache
  longo. O `index.html` e o `manifest.webmanifest` não: sirva-os com
  `Cache-Control: no-cache`, senão quem já abriu o site continua na versão
  antiga depois de um deploy.

---

## 7. Limite de requisições (fazer antes de divulgar)

Hoje a API **não limita** quantas requisições alguém pode fazer. Sem isso,
dá para testar senhas no login sem parar, criar contas em massa e encher o
bucket de uploads. Não impede o primeiro deploy, mas deve entrar antes de
divulgar o endereço.

Sugestão: o pacote `express-rate-limit`, aplicado só nas rotas sensíveis
(`backend/src/routes/`):

| Rota | Limite sugerido | Chave |
| --- | --- | --- |
| `POST /api/auth/login` | 10 por 15 min | IP |
| `POST /api/auth/signup` (cadastro) | 5 por hora | IP |
| `POST /api/auth/resend-verification` | 3 por hora | IP |
| `POST /api/uploads` | 30 por hora | id do usuário logado |

- Atrás do proxy do host, o Express vê o IP do proxy, não o do usuário: sem
  `app.set("trust proxy", 1)` em `app.js`, todo mundo divide o mesmo limite.
  Ajuste o número ao total de proxies na frente da API.
- Resposta ao estourar: status 429, no mesmo formato de erro das outras rotas
  (`{ error: "mensagem" }`, ver `middlewares/errorHandler.js`), para
  o frontend mostrar a mensagem.
- Com mais de uma instância da API, o limite em memória vale por instância.
  Para o tamanho do projeto, uma instância basta.

---

## 8. Backups

O que **não** precisa de backup: o código e as fotos do catálogo
(`backend/assets/`), que estão no git.

O que **precisa**:

1. **Banco.** Ligue o backup automático diário do provedor, se houver, com
   retenção de pelo menos 7 dias. Se não houver, agende um dump:

   ```bash
   mysqldump --single-transaction --routines --triggers \
     -h <host> -u tamba -p tamba | gzip > tamba-$(date +%F).sql.gz
   ```

   `--triggers` é necessário: sem ele, o dump perde os triggers da migration
   007. Guarde os dumps **fora** do servidor do banco (no próprio bucket, numa
   pasta privada separada, por exemplo).

2. **Bucket das fotos.** Ligue o versionamento de objetos ou uma cópia
   periódica para outro bucket. Os arquivos nunca são sobrescritos (nome
   aleatório, gravação única), então o maior risco é apagar por engano.

3. **Teste a restauração uma vez**, logo depois do primeiro backup:
   restaure o dump num banco vazio e abra o app apontando para ele. Backup
   que nunca foi restaurado não é garantia.

Os dois backups andam juntos: o banco guarda as URLs das fotos, o bucket
guarda as fotos.

---

## 9. Conferência depois do deploy

- [ ] `https://api.exemplo.com.br/api/health` responde `{"status":"ok"}`.
- [ ] O site abre e a Dex mostra as fotos do catálogo (testa
      `PUBLIC_API_URL`).
- [ ] O console do navegador não mostra erro de CORS (testa `CORS_ORIGIN`).
- [ ] `/feed` aberto direto e recarregado não dá 404 (testa a reescrita).
- [ ] Cadastro e login funcionam.
- [ ] Uma captura com foto: a foto abre e a URL dela começa com
      `UPLOADS_PUBLIC_URL` (testa o driver novo).
- [ ] A foto continua lá depois de um novo deploy da API.
- [ ] O admin entra e vê a área de moderação; trocar a foto de uma espécie
      gera a miniatura.
- [ ] Não existe conta `admin@tamba.local` (testa `SEED_DEV_USERS=false`).
- [ ] No celular (Chrome no Android), o menu oferece "Instalar app" e o
      ícone instalado é o tambaqui.
- [ ] O primeiro backup do banco rodou.
