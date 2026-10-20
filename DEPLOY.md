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
| Fotos enviadas | arquivos das capturas, avatares e fotos de espécie enviadas pelo admin | disco local: `backend/uploads/` no desenvolvimento, um **volume do Railway** em produção (seção 1.1) |
| Frontend | site estático gerado por `npm run build` (`frontend/dist/`) | — |

As fotos do catálogo (`backend/assets/`) estão no git e a própria API as
serve em `/assets`: não precisam de armazenamento externo.

---

## 1. Mudanças de código antes do deploy

Duas mudanças eram **obrigatórias** (sem elas o deploy não funciona ou perde
dados), e as duas já foram feitas: 1.1 e 1.2. A 1.3 é decisão a tomar antes
do lançamento; a 1.4 também já foi feita (migration 018). O limite de
requisições está na seção 7.

### 1.1 Fotos enviadas num volume persistente (feito)

**Por quê.** No desenvolvimento as fotos vão para `backend/uploads/`, no
disco do servidor. Em hospedagem esse disco é apagado a cada deploy: as fotos
sumiriam.

**Decisão: volume do Railway + o driver de disco local que já existe**, em
vez de escrever um driver S3. O volume é um disco persistente montado no
container da API; o `localDriver` grava nele como grava no
`backend/uploads/`, e a própria API serve os arquivos em `/uploads`. Nada
de cliente S3 novo para escrever e testar, nem credencial de bucket.

**Como ficou no código.** A pasta vem de `UPLOADS_DIR`
(`lib/storage.js`). Sem ela, `backend/uploads/` (desenvolvimento); com
`NODE_ENV=production`, ela é **obrigatória** — sem a variável, as fotos iriam
para o disco do container em silêncio e sumiriam no deploy seguinte. Na
subida, a API cria a pasta se faltar e confere que aceita escrita, e
escreve no log onde estão as fotos ("Fotos enviadas em ..."). No Railway:
volume montado em `/data` e `UPLOADS_DIR=/data/uploads` (seção 5).

**O que trocamos por essa simplicidade** (conferido na documentação do
Railway em 20/10/2026; reveja se algo mudar de escala):

| Limite | O que significa |
| --- | --- |
| **Uma instância só** | O Railway não permite réplicas num serviço com volume. A API não escala na horizontal; o limite de requisições em memória (seção 7) vale para o todo justamente por isso. |
| **Uma região só** | O volume fica na região do serviço; a API não pode ir para outra região sem levar (copiar) o volume. |
| **Sem CDN** | Toda foto passa pelo Node da API, e o tráfego conta como saída (US$ 0,05/GB). Os arquivos já saem com `Cache-Control` de um ano (`immutable`), então o navegador não baixa de novo. |
| **Indisponibilidade curta a cada deploy** | Dois deploys não podem montar o mesmo volume ao mesmo tempo: o antigo para antes de o novo subir, mesmo com health check. Alguns segundos fora do ar por deploy. |
| **5 GB no plano Hobby** | ~15 mil fotos de ~300 KB (o frontend comprime para 1600 px). O volume só cresce: nada apaga as fotos órfãs (ver "Problemas conhecidos" na ARQUITETURA). |

**Se um dia sair do volume** (escala, CDN, várias instâncias), a 1.4 já deixou
o caminho curto: o banco guarda só a chave, então é copiar os arquivos para o
bucket, trocar `UPLOADS_PUBLIC_URL` e escrever um driver S3 com os mesmos
dois métodos do `localDriver`, sem tocar no banco:

| Método | Quem usa | O que precisa fazer |
| --- | --- | --- |
| `save({ buffer, extension, ownerId })` | upload de foto (`upload.service.js`) e miniatura da foto de espécie (`species.service.js`) | Validar `ownerId` com o regex `UUID` do arquivo, gerar o nome com `randomBytes(16).toString("hex")` + `.` + `extension`, gravar no bucket com a chave `<ownerId>/<nome>` e devolver essa chave. Enviar `ContentType` certo e `Cache-Control: public, max-age=31536000, immutable`. |
| `read(chave)` | gera a miniatura quando o admin troca a foto de uma espécie | Conferir o formato da chave (como o `localDriver` faz) e baixar o objeto do bucket, devolvendo um `Buffer`. |

O resto não depende do driver: `publicUrl` monta `UPLOADS_PUBLIC_URL/<chave>`
e `ownedKey` confere o dono (seção 1.4). Credenciais do bucket só no
ambiente do servidor, com permissão só naquele bucket.

> **`UPLOADS_PUBLIC_URL` pode mudar** (seção 1.4): o banco guarda só a
> chave. Ela é **obrigatória**: a API não sobe sem ela, nem com um valor que
> não seja um endereço `http(s)` completo. Com o volume, ela é
> `https://<domínio da API>/uploads`.
>
> **Não copie o banco de desenvolvimento** para produção: as chaves dele
> apontam para arquivos que só existem no disco da máquina de
> desenvolvimento, e ele tem contas de teste. Produção começa com um banco
> novo (seção 4).

### 1.2 `npm start` sem arquivo `.env` (feito)

**O que era.** Os scripts usavam `node --env-file=.env`. Em hospedagem, as
variáveis vêm do painel e não existe `.env`; nesse caso o Node **sai com
erro** ("not found") antes de subir a API.

**Como ficou.** `start`, `migrate` e `seed` usam
`--env-file-if-exists=.env`: sem o arquivo, o Node avisa ".env not found.
Continuing without it." e segue com as variáveis do ambiente. Com os dois, a
variável do ambiente vence a do arquivo. O `dev` continua com
`--env-file=.env` de propósito: na máquina de desenvolvimento, faltar o
`.env` é erro de instalação e deve parar logo.

**Versão do Node.** O `--env-file-if-exists` existe a partir do Node
**22.9**. O `backend/package.json` fixa `"engines": { "node": "22" }`: o
Railpack (o construtor do Railway) passa esse valor ao mise sem mexer, e
"22" quer dizer a mesma coisa para os dois lados — para o npm, qualquer 22.x;
para o mise, o 22.x mais novo. Sem `engines`, o Railpack usaria a LTS do dia
do build, que muda sozinha. Ao trocar de versão maior, troque aqui e teste
local antes. Confira no log do primeiro build qual versão o Railway instalou
(seção 5).

### 1.3 Confirmação de e-mail (decisão, não bloqueia)

O envio de e-mail só tem o driver de console (`backend/src/lib/mailer.js`):
o e-mail é impresso no log da API, ninguém o recebe. Portanto, em produção,
**mantenha `REQUIRE_EMAIL_VERIFICATION=false`** — com `true`, nenhuma conta
nova conseguiria entrar. Para ligar a confirmação, primeiro escreva um driver
SMTP com o mesmo `send({ to, subject, text })` (ex.: nodemailer) e coloque as
credenciais no ambiente.

### 1.4 Chave relativa das fotos no banco (feito)

**O que era.** Para cada foto enviada, o banco guardava o endereço
**completo**, com domínio (`http://localhost:3333/uploads/<id>/<nome>.jpg`).
Isso gravava o domínio dentro dos dados: trocar de bucket, de provedor, pôr
uma CDN ou trocar o domínio quebraria todas as linhas já gravadas — e, como a
conferência de dono comparava esse prefixo, as capturas antigas deixariam de
poder ser editadas.

**Como ficou.** O banco guarda só a **chave**, `<id do usuário>/<nome>.jpg`,
e a API monta `UPLOADS_PUBLIC_URL + "/" + chave` em toda resposta
(`publicUrl`, em `lib/storage.js`) — o mesmo caminho que as fotos do
catálogo (`/assets/...`) já faziam. Colunas: `catch_photos.url`,
`users.avatar_url`, `fish_species.image_url` e
`fish_species.image_thumb_url`. Trocar de bucket, de provedor ou pôr uma
CDN é trocar a variável de ambiente e copiar os arquivos, sem tocar no banco.

- **Os três formatos do banco**, que o `publicUrl` distingue: começa com
  `/` = foto do catálogo, relativa a `PUBLIC_API_URL`; começa com
  `http(s):` = link externo de antes do upload, passa intacto; o resto = chave
  de upload, relativa a `UPLOADS_PUBLIC_URL`.
- **Gravação.** `ownedKey(url, dono)` recebe a URL que veio do cliente,
  confere o dono (prefixo `UPLOADS_PUBLIC_URL/<dono>/` e formato do nome) e
  devolve a chave, ou recusa com `PHOTO_NOT_OWNED`. Os três serviços
  (`catch`, `user`, `species`) gravam essa chave. Na edição de captura, as
  fotos que ela já tinha voltam ao formato guardado por `storedRef`.
- **Frontend: nada muda, e isso é um contrato.** `POST /api/uploads` responde
  `201 { id, url }`: `id` é a chave e `url` é a URL pública completa
  (`UPLOADS_PUBLIC_URL/<id>`). O frontend manda essa `url` de volta como
  está em `photoUrls`, `avatarUrl` ou `imageUrl`, e toda resposta devolve
  URLs completas. Se esse formato mudar, o formulário de captura quebra.
- **Dados existentes.** A migration 018 tira o prefixo
  `http(s)://<host>/uploads/` das linhas que o driver local gerou, nos bancos
  de desenvolvimento. **Em produção não há o que converter**: o banco começa
  vazio. Links externos antigos e as fotos de antes da pasta por usuário
  continuam valendo.

**Testado** (20/10/2026): no banco de desenvolvimento, as 265 respostas
`GET` com foto ou avatar ficaram idênticas antes e depois da migration, e
as 70 URLs de imagem abrem; num banco **novo**, do zero (`migrate` + `seed`
com `NODE_ENV=production`), as 60 fotos e miniaturas do catálogo abrem, e o
upload, a captura (criar, reordenar, trocar, remover), o avatar (no
comentário, nas notificações, no perfil e no feed), a recusa de foto alheia e
a foto de espécie com miniatura funcionam de ponta a ponta.

---

## 2. Variáveis de ambiente

### 2.1 API (`backend/`)

Configure no painel do host (em produção não há `.env`). Referência
comentada: `backend/.env.example`.

| Variável | Valor em produção | Observação |
| --- | --- | --- |
| `NODE_ENV` | `production` | Faz o seed recusar as contas de desenvolvimento. |
| `DATABASE_URL` | No Railway: `${{MySQL.MYSQL_URL}}` (referência, ver abaixo). Fora dele: `mysql://usuario:senha@host:3306/tamba` | Senha com `@ : # /` precisa ser codificada em URL (`@` vira `%40`). Se o provedor exigir TLS, acrescente `?ssl={"rejectUnauthorized":true}` (o `mysql2` lê o JSON da query string) e teste a conexão com `npm run migrate`. |
| `JWT_SECRET` | valor longo e aleatório | Gere com `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. A API não sobe sem ele. Trocar depois desloga todo mundo. |
| `JWT_EXPIRES_IN` | `7d` | Não há refresh token. |
| `PORT` | o que o host definir | Muitos hosts injetam `PORT` sozinhos; a API usa 3333 se faltar. |
| `CORS_ORIGIN` | `https://tamba.exemplo.com.br` | Endereço exato do frontend, sem barra no final. Valor que não seja só esquema e domínio (com barra, caminho ou maiúscula) **impede a API de subir**. Sem a variável, só `http://localhost:5173` é liberado — nunca `*`. Ver seção 3. |
| `PUBLIC_API_URL` | `https://api.exemplo.com.br` | Endereço público da API, **sem** `/api`. É a base das fotos do catálogo (`/assets/...`). **Obrigatória**: a API não sobe sem ela, nem com valor que não seja `http(s)`. |
| `UPLOADS_PUBLIC_URL` | `https://api.exemplo.com.br/uploads` | Endereço público das fotos enviadas. **Obrigatória**: a API não sobe sem ela. Pode mudar depois (o banco guarda só a chave; seção 1.4). |
| `FRONTEND_URL` | `https://tamba.exemplo.com.br` | Para onde o link de confirmação de e-mail redireciona. |
| `EMAIL_VERIFICATION_URL` | `https://api.exemplo.com.br/api/auth/verify-email` | Link que vai no e-mail de confirmação. |
| `REQUIRE_EMAIL_VERIFICATION` | `false` | Ver seção 1.3. |
| `SEED_DEV_USERS` | `false` | **Nunca** `true` em produção: cria contas com a senha pública `admin123`. |
| `ADMIN_EMAIL` | e-mail do primeiro admin | Usado só pelo seed. Ver seção 4.4. |
| `SIGNUP_LIMIT_PER_HOUR` | `20` | Cadastros por hora por IP (seção 7). Opcional; inteiro ≥ 1. |
| `TRUST_PROXY` | `1` | Número de proxies na frente da API, para o limite de requisições ver o IP do usuário. **Confira depois do deploy** (seção 7). |
| `REPORT_HIDE_THRESHOLD` | `3` | Quantas denúncias de pessoas diferentes ocultam uma captura. `1` é só para demonstração. |
| `UPLOADS_DIR` | `/data/uploads` | Pasta das fotos enviadas, dentro do volume montado em `/data`. **Obrigatória** com `NODE_ENV=production`. Ver seção 1.1. |

> **No Railway, `DATABASE_URL` da API é sempre `${{MySQL.MYSQL_URL}}`**, a
> URL da **rede privada** (`*.railway.internal`), digitada assim mesmo no
> painel: o Railway troca a referência pelo valor e a senha nunca é copiada à
> mão. **Nunca** o `MYSQL_PUBLIC_URL`: esse passa pelo proxy TCP público, é
> mais lento, é cobrado como tráfego de saída e só funciona enquanto o
> Public Networking do MySQL estiver ligado — que fica **desligado** (seção
> 4.2). `MySQL` é o nome do serviço do banco no projeto; se ele tiver outro
> nome, a referência muda junto.

### 2.2 Frontend (`frontend/`)

| Variável | Valor em produção | Observação |
| --- | --- | --- |
| `VITE_API_URL` | `https://api.exemplo.com.br/api` | **Com** `/api` no final. É gravada no JavaScript **na hora do build**: defina-a nas variáveis de build do host e gere o build de novo sempre que ela mudar. Sem ela, o site tenta falar com `http://localhost:3333/api`. |

---

## 3. CORS

- A API libera **uma única origem**, a de `CORS_ORIGIN`
  (`backend/src/app.js`). Sem a variável, libera só `http://localhost:5173`:
  o primeiro deploy, antes do passo 6, fica fechado para qualquer site, não
  aberto. CORS só vale para navegador — a API continua alcançável por
  `curl`; quem protege é o login e o limite de requisições (seção 7).
- Coloque o endereço exato do frontend: esquema, domínio e porta, se houver,
  sem barra no final (`https://tamba.exemplo.com.br`). Outro formato impede
  a API de subir.
- `https://tamba.exemplo.com.br` e `https://www.tamba.exemplo.com.br` são
  origens diferentes. Escolha uma e redirecione a outra para ela no host do
  frontend. Se precisar de mais de uma (por exemplo, URLs de preview), mude o
  `app.js` para aceitar uma lista, como `CORS_ORIGIN.split(",")`.
- O login usa token no cabeçalho `Authorization`, não cookie: não é preciso
  `credentials`.
- As imagens (catálogo e fotos enviadas, as duas servidas pela API) entram
  por `<img>`, que não depende de CORS.

---

## 4. Banco de dados (banco novo)

### 4.1 Requisitos do MySQL

- **MySQL 8.0.19 ou mais novo.** MariaDB não serve: o seed usa
  `INSERT ... AS novo ON DUPLICATE KEY UPDATE` e o banco usa a collation
  `utf8mb4_0900_ai_ci`, ambos exclusivos do MySQL 8.
- Suporte a **chaves estrangeiras** e **CHECK constraints** (obrigatório).
- **Permissão para criar trigger** (desejável, não obrigatório). A migration
  007 cria dois triggers; com binary log ligado (padrão do MySQL 8), isso
  exige privilégio SUPER ou `log_bin_trust_function_creators = 1`. Se não
  houver nenhum dos dois, siga a seção 4.5: o app funciona sem os triggers.

**Confira tudo de uma vez com `npm run check-db`** (`database/check.js`),
apontando o `DATABASE_URL` para o banco novo. Só lê: mostra versão, usuário,
plugin de autenticação, TLS, binary log, SUPER e se o banco está vazio, e diz
se a 007 deve passar ou cair na seção 4.5. Não imprime a senha.

### 4.2 No Railway: o banco já vem pronto (MySQL 8.4)

O Railway cria o banco e o usuário sozinho, a partir da imagem oficial
`mysql`. Em 20/10/2026 o serviço subiu com **MySQL 8.4.11** — atende o
requisito de 8.0.19+. Três diferenças em relação à máquina local, para
ninguém refazer a investigação:

1. **`setup.sql` não se aplica.** Ele foi feito para a máquina local: cria
   o banco `tamba` e o usuário `tamba@localhost`, e roda
   `SET PERSIST log_bin_trust_function_creators` como root. No Railway o
   banco e o usuário já existem (o nome do banco e o usuário estão nas
   variáveis do serviço MySQL, aba **Variables**: `MYSQLDATABASE`,
   `MYSQLUSER`); não rode o `setup.sql` lá. As tabelas declaram a própria
   collation (`utf8mb4_0900_ai_ci`), então o padrão do banco não importa.
2. **Triggers da 007.** No 8.4 o binary log continua ligado por padrão, e
   `log_bin_trust_function_creators` está **obsoleta (deprecated), mas ainda
   existe** e ainda vale para trigger. Não há painel de parâmetros no Railway
   para ligá-la, e o `SET PERSIST` do `setup.sql` não é o caminho. Então
   depende do usuário do `DATABASE_URL`: com SUPER (root tem), a 007 passa
   direto; sem SUPER, falha com o erro 1419 e segue-se a seção 4.5. O
   `npm run check-db` diz qual dos dois antes de rodar.

   **O que aconteceu no Railway (20/10/2026): a 007 passou direto**, sem o
   procedimento da seção 4.5. O `check-db` mostrou binary log **desligado**
   nessa instância (ao contrário do padrão do MySQL 8.4) e usuário com SUPER
   — qualquer um dos dois bastaria. Os dois triggers existem em produção.
   Não planeje em torno do pulo da 007 no Railway; a seção 4.5 fica para
   outro provedor.
3. **Autenticação.** No 8.4 o padrão é `caching_sha2_password`, que o
   `mysql2` suporta; o `mysql_native_password` vem **desligado** (só é
   removido no 9.0). Se a conexão falhar, leia o código do erro antes de
   trocar a senha: `ER_ACCESS_DENIED_ERROR` (1045, "Access denied for
   user") é usuário ou senha errados; "Unknown authentication plugin",
   "Client does not support authentication protocol" ou
   `ER_NOT_SUPPORTED_AUTH_MODE` é problema de plugin de autenticação.

**O que o Railway entrega** (conferido no primeiro deploy): banco
`railway`, usuário `root@%`. A API usa esse mesmo usuário pelo
`${{MySQL.MYSQL_URL}}`. Ter um usuário só com `ALL` em `railway.*` para a
API seria o mínimo privilégio; não foi feito — para o tamanho do projeto, o
banco não tem outro dado nem outro serviço a proteger.

**Qual endereço usar.** A API, rodando no próprio Railway, usa o
`MYSQL_URL` (rede privada; ver a seção 2.1). Para rodar `migrate`, `seed`
e `check-db` da sua máquina, use o `MYSQL_PUBLIC_URL`, que só existe com o
**Public Networking** ligado no serviço MySQL (Settings → Networking). Os
dois têm a senha: copie do painel direto para o shell, nunca para o
repositório nem para mensagem.

> **O Public Networking do MySQL é temporário.** Ligue só para rodar os
> comandos da sua máquina e **desligue logo depois** (Settings → Networking,
> remover o domínio público do TCP Proxy). A API não precisa dele, e um
> banco alcançável pela internet, com dados reais de usuários, é superfície
> de ataque à toa. O estado normal do banco em produção é **sem** acesso
> público.
>
> **Pelo proxy público, a conexão do primeiro deploy foi sem TLS.** A senha
> não trafega em claro (o `caching_sha2_password` troca a senha cifrada),
> mas o resto do tráfego sim. No primeiro deploy só passou schema e o
> catálogo; com dados reais de usuários no banco, é mais um motivo para as
> migrations rodarem pela rede privada (pre-deploy command, seção 4.6) em
> vez da máquina local.

**Fora do Railway**, num MySQL em que você é administrador, o equivalente
ao `setup.sql` é:

```sql
CREATE DATABASE tamba CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE USER 'tamba'@'%' IDENTIFIED BY '<senha forte>';
GRANT ALL PRIVILEGES ON tamba.* TO 'tamba'@'%';
```

### 4.3 Ordem: migrate, depois seed

Rode a partir de `backend/`, numa máquina com Node 22.9+ e as variáveis da
seção 2.1 (no shell do host ou localmente, apontando o `DATABASE_URL` para o
banco de produção):

```bash
npm ci
npm run migrate   # aplica as migrations 001 a 018, em ordem
npm run seed      # catálogo de espécies e pesqueiros de exemplo
```

> **Rodando da máquina de desenvolvimento:** os scripts leem o
> `backend/.env` se ele existir, e o de desenvolvimento tem
> `SEED_DEV_USERS=true`. Variável definida no shell vence a do arquivo, mas
> só as que você definir. Antes do `seed`, defina no shell, além do
> `DATABASE_URL`: `NODE_ENV=production`, `SEED_DEV_USERS=false` e
> `ADMIN_EMAIL` (vazio na primeira vez). Senão o seed cria as contas
> `admin@tamba.local` com a senha pública `admin123` no banco de produção.

Se o `migrate` parar na `007_follows_no_self_trigger.sql` com o erro 1419
(ou 1227, "access denied"), o provedor não deixa criar trigger: siga a
seção 4.5 e depois continue daqui.

- O **migrate** anota o que já rodou na tabela `schema_migrations` e só
  aplica o que falta. Rodar de novo é seguro. Depois do primeiro deploy,
  quem roda é o pre-deploy command do Railway, antes de cada versão nova da
  API (seção 4.6).
- O **seed** é idempotente: rodar de novo não duplica e não sobrescreve o que
  o admin editou pelo app.
- Com `NODE_ENV=production` e `SEED_DEV_USERS=false`, nenhuma conta de teste
  é criada. Confira no log que o aviso "CONTAS DE DESENVOLVIMENTO" **não**
  aparece.

**Para terminar (não pule):** feche o shell (ou `Remove-Item
Env:DATABASE_URL` no PowerShell) e **desligue o Public Networking** do
serviço MySQL no Railway. Confira que o `MYSQL_PUBLIC_URL` sumiu ou ficou
vazio na aba Variables.

### 4.4 Primeiro admin

O seed **não cria** a conta do admin; só promove uma conta que já existe. Não
há rota para virar admin. Ordem:

1. Com a API e o frontend no ar, cadastre-se pelo app com o e-mail do admin.
2. Defina `ADMIN_EMAIL` com esse e-mail.
3. Rode `npm run seed` **de novo**. Deve aparecer "`<e-mail>` promovido a
   admin."
4. Saia e entre de novo no app para o papel novo valer.

### 4.5 Sem os triggers da migration 007 (MySQL gerenciado)

> No Railway não foi preciso: a 007 passou direto (seção 4.2). Isto vale
> para um provedor que não dê SUPER com binary log ligado.

**O que os triggers fazem.** Barram no próprio banco que um usuário siga a
si mesmo (RGN-15), num `INSERT` ou `UPDATE` em `follows`. Seria um `CHECK`,
mas o MySQL não aceita `CHECK` em coluna com chave estrangeira `ON DELETE
CASCADE`, por isso trigger.

**O que se perde sem eles: só a segunda trava.** A regra continua valendo
pela camada de serviço, onde já é conferida hoje:
`backend/src/services/social.service.js`, função `follow`, recusa com erro
422 quando `followerId === followingId`. É o único caminho do código que
grava em `follows` (`socialModel` só faz `INSERT`, e só a partir dali), e
nenhum faz `UPDATE`. O que deixaria de ser barrado é um `INSERT` feito à mão
no banco ou por código novo que não passe por esse serviço.

**Como pular a 007 em produção.** A migration foi isolada num arquivo só
para isso: o primeiro comando dela já falha, então nada fica aplicado pela
metade.

1. Rode `npm run migrate`. Ele aplica 001 a 006 e para na 007 com erro.
2. Conecte no banco e marque a 007 como aplicada, sem rodá-la:

   ```sql
   INSERT INTO schema_migrations (filename) VALUES ('007_follows_no_self_trigger.sql');
   ```

3. Rode `npm run migrate` de novo. Ele aplica 008 a 018.
4. Confira que nenhum trigger foi criado pela metade:
   `SHOW TRIGGERS LIKE 'follows';` deve voltar vazio.
5. Continue com o `npm run seed` (seção 4.3).

Nenhuma migration depois da 007 depende dos triggers.

**Como aplicar mais tarde**, se o provedor passar a permitir (ou se o banco
mudar para um que permita):

1. Garanta a permissão: rode a 007 com um usuário que tenha SUPER, ou ligue
   `log_bin_trust_function_creators = 1` (no Railway, acrescentando
   `--log-bin-trust-function-creators=ON` ao comando de início do serviço
   MySQL). Confira com `npm run check-db`.
2. Confira que não há nenhum "seguir a si mesmo" gravado (o trigger só barra
   linhas novas, não confere as que já existem):

   ```sql
   SELECT COUNT(*) FROM follows WHERE follower_id = following_id;  -- tem que dar 0
   ```

   Se der mais que 0, apague essas linhas antes.
3. Tire a marcação e rode o migrate. Ele aplica só a 007, porque as outras
   continuam anotadas:

   ```sql
   DELETE FROM schema_migrations WHERE filename = '007_follows_no_self_trigger.sql';
   ```

   ```bash
   npm run migrate
   ```

4. `SHOW TRIGGERS LIKE 'follows';` deve listar `trg_follows_no_self_insert` e
   `trg_follows_no_self_update`.

### 4.6 Migrations depois do primeiro deploy: pre-deploy command

**A regra: o próprio Railway roda o migrate antes de cada deploy da API.**
No serviço da API, **Settings → Deploy → Pre-deploy Command:
`npm run migrate`**. Ele roda depois do build e antes de a versão nova
subir, num container separado, **pela rede privada** e com as variáveis da
API — sem Public Networking, sem a conexão sem TLS do proxy público (seção
4.2) e sem depender de alguém lembrar. É isto que cobre o risco de alguém do
grupo fazer push de uma migration e a API nova subir contra o schema velho.

- **Se o migrate falhar, o deploy novo não acontece.** Veja o log do
  pre-deploy, corrija com uma migration nova (nunca editando a que já foi
  aplicada; ver ARQUITETURA, "Migrations") e faça push de novo. O migrate
  só anota em `schema_migrations` o arquivo que terminou; como DDL no MySQL
  não tem transação, uma migration que falhe no meio pode deixar parte
  aplicada — por isso cada migration faz uma coisa só (como a 007).
- **Sem migration nova, ele não faz nada** ("Nada a fazer, o banco já está
  atualizado.") e o deploy segue normalmente.

**Só o migrate; o seed continua manual.** O seed não volta a desativar nem
ativar nada (não mexe em `is_active`), mas **recria espécie que o admin
apagou** (espécie sem captura pode ser apagada) e **devolve a foto que o
admin tirou** (ARQUITETURA, "Crédito anda com a foto"). Rodar a cada deploy
desfaria essas escolhas, e não é preciso. O seed se roda à mão, da máquina
local, quando o catálogo do `seed.js` mudar ou para promover um admin
(seções 4.3 e 4.4) — com Public Networking ligado só durante o comando.

**Rollback.** Voltar para um deploy anterior no Railway roda (ou não) o
pre-deploy com o código antigo; nos dois casos ele não faz nada, porque as
migrations do código antigo já estão todas em `schema_migrations`. O
código antigo funciona com o schema novo **porque as migrations acrescentam**
(coluna nova com padrão, tabela nova, dado corrigido). **Isso é uma regra
para toda migration daqui em diante, não uma descrição do passado:** a 011
apagou `catches.photo_url` e a 008/009 mudaram o tipo de `rarity`. Em
produção isso não pesa — as 18 já estavam aplicadas antes do primeiro
deploy, então nenhum rollback cai em código mais velho que o schema.

**Se um dia precisar apagar ou renomear coluna**, em dois deploys: primeiro
o código para de usar a coluna (com a migration que acrescenta a nova, se
houver); só num deploy seguinte — quando não houver mais motivo para voltar ao
código que ainda usava a coluna — entra a migration que apaga. Se isso não for seguido, a
regra do rollback acima deixa de valer: voltar um deploy passa a exigir
reverter o schema à mão.

**Migration nova no PR:** diga na descrição do commit, para quem revisa saber
que o deploy vai mexer no banco de produção.

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

### 5.1 No Railway, passo a passo

No mesmo projeto do MySQL. Todos os campos estão no painel do serviço da
API; nada disso vai para o repositório.

1. **Criar o serviço.** No projeto: **+ New → GitHub Repo →
   `caopi/Tamba`** (na primeira vez, autorize o app do Railway no GitHub).
   O primeiro build pode falhar antes do passo 2: a raiz do repositório não
   tem `package.json`, e o Railpack não sabe o que construir.
2. **Pasta do backend.** **Settings → Source**:
   - **Root Directory:** `/backend` — o repositório tem `frontend/` e
     `backend/` lado a lado; o Railpack lê o `backend/package.json`
     (`engines`, `npm ci`, `npm start`).
   - **Watch Paths:** `/backend/**` — commit só no frontend ou nos docs não
     refaz o deploy da API (e não derruba a API alguns segundos à toa; seção
     1.1).
3. **Domínio público.** **Settings → Networking → Generate Domain**. Aceite
   a porta que ele sugerir: a API escuta na `PORT` que o Railway injeta
   (não defina `PORT`). Isso cria o `RAILWAY_PUBLIC_DOMAIN` que as
   variáveis abaixo usam, então vem **antes** delas.
4. **Volume das fotos.** No canvas do projeto, **Ctrl+K → New Volume** (ou
   clique com o botão direito no canvas → **Volume**), escolha o serviço da
   API e ponha o **Mount Path** `/data`. Um serviço só tem um volume; o do
   MySQL é outro.
5. **Variáveis.** **Variables → Raw Editor**, cole e salve:

   ```
   NODE_ENV=production
   DATABASE_URL=${{MySQL.MYSQL_URL}}
   JWT_EXPIRES_IN=7d
   PUBLIC_API_URL=https://${{RAILWAY_PUBLIC_DOMAIN}}
   UPLOADS_PUBLIC_URL=https://${{RAILWAY_PUBLIC_DOMAIN}}/uploads
   UPLOADS_DIR=/data/uploads
   EMAIL_VERIFICATION_URL=https://${{RAILWAY_PUBLIC_DOMAIN}}/api/auth/verify-email
   REQUIRE_EMAIL_VERIFICATION=false
   SEED_DEV_USERS=false
   REPORT_HIDE_THRESHOLD=3
   TRUST_PROXY=1
   ```

   Depois, à parte, **+ New Variable** `JWT_SECRET`, com o valor gerado na
   sua máquina direto para a área de transferência (não aparece na tela nem
   fica no histórico):

   ```powershell
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" | Set-Clipboard
   ```

   O `JWT_SECRET` fica fora do bloco de propósito: sem ele a API **não
   sobe**, o que é melhor do que subir com um texto de exemplo esquecido no
   lugar do segredo.

   Ficam para o passo 6 (dependem do domínio da Vercel): `CORS_ORIGIN` e
   `FRONTEND_URL`. Até lá o CORS libera só `http://localhost:5173`, e o
   site ainda não existe mesmo. `ADMIN_EMAIL` não vai na API: só o seed usa,
   e o seed roda da máquina local (seção 4.4).
6. **Health check.** **Settings → Deploy → Healthcheck Path:**
   `/api/health`.
7. **Pre-deploy Command:** `npm run migrate` (só ele; o seed fica manual —
   ver seção 4.6).
8. **Deploy.** Aplique as mudanças pendentes (**Deploy**).

**Conferência do primeiro deploy:**

- [ ] Log do **build**: o Node instalado é 22.x (`engines`, seção 1.2) e o
      `sharp` instalou sem erro.
- [ ] Log do **deploy**: `Tamba API rodando ...` e `Fotos enviadas em
      /data/uploads`. Se em vez disso aparecer um erro de variável
      (`PUBLIC_API_URL inválido: "https://"`, por exemplo), a referência
      ao domínio veio vazia: confira o passo 3.
- [ ] `https://<domínio>/api/health` responde `{"status":"ok"}`.
- [ ] Em `https://<domínio>/api/species`, o `imageUrl` das espécies começa
      com `https://<domínio>/assets/` e abre a foto.
- [ ] Se o log disser que a pasta não aceita escrita (`EACCES`), acrescente
      `RAILWAY_RUN_UID=0` nas variáveis: o volume é montado como root.

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

## 7. Limite de requisições (feito)

`express-rate-limit`, em `backend/src/middlewares/rateLimit.js`, só nas
rotas que alguém de fora abusaria:

| Rota | Limite | Chave | Por quê |
| --- | --- | --- | --- |
| `POST /api/auth/login` | 10 **erradas** por 15 min | IP | Só a tentativa que falha conta: quem divide o IP não gasta o limite entrando com a senha certa. |
| `POST /api/auth/signup` | 20 por hora (`SIGNUP_LIMIT_PER_HOUR`) | IP | Não 5: numa apresentação, a turma se cadastra da mesma rede, atrás de um IP só. Para subir no dia, mude a variável no Railway: refaz o deploy (alguns segundos fora do ar, seção 1.1) e zera as contagens, sem mexer no código. |
| `POST /api/auth/resend-verification` | 3 por hora | IP | |
| `POST /api/uploads` | 30 por hora | id do usuário logado | Três capturas com 10 fotos. Vem depois do `requireAuth`. |

Ao estourar: status 429, `{ "error": "...", "code": "RATE_LIMITED" }` (o
mesmo formato das outras rotas), cabeçalho `RateLimit` padronizado, e uma
linha no log com a chave, o `req.ip` e o `X-Forwarded-For` cru. A
contagem é em memória: vale porque a API tem uma instância só (seção 1.1), e
reiniciar a API zera tudo.

**`trust proxy` (`TRUST_PROXY`).** Atrás do proxy do Railway, o Express vê
o IP do proxy, não o do usuário: sem ajuste, todo mundo dividiria um limite
só. `TRUST_PROXY` é o número de proxies entre a internet e a API; o
`app.js` passa para `app.set("trust proxy", N)`, e o Express usa o N-ésimo
endereço a partir do fim do `X-Forwarded-For`. Local, sem proxy, fica 0
(padrão): um `X-Forwarded-For` mandado pelo cliente é ignorado. No Railway,
**1**.

O Railway não publica quantos saltos há (as respostas da equipe no fórum
deles se contradizem, e há relato de Fastly na frente). Por isso o 1 é
**conferido depois do deploy**, não presumido:

1. Descubra seu IP público (abra `https://api.ipify.org`).
2. Erre a senha 11 vezes no login do site e confira a 11ª: "Muitas
   tentativas de login".
3. Nos logs da API no Railway, procure `Limite de requisições: POST
   /api/auth/login`. O `ip=` tem de ser **o seu IP**. Se for outro endereço
   (de proxy) e o seu aparecer **antes** dele no `x-forwarded-for=`, suba
   `TRUST_PROXY` para 2 e repita.
4. Forjando o cabeçalho, o IP não pode mudar:

   ```powershell
   1..11 | % { try { Invoke-RestMethod -Method Post -Uri https://<domínio da API>/api/auth/login -ContentType application/json -Headers @{ "X-Forwarded-For" = "203.0.113.$_" } -Body '{"email":"x@example.com","password":"errada"}' } catch { $_.Exception.Response.StatusCode.value__ } }
   ```

   A 11ª tem de dar 429, e o log tem de mostrar `ip=` com o seu IP, não
   `203.0.113.x`. Se cada tentativa ganhou um IP novo, o `TRUST_PROXY` está
   alto demais.
5. Do celular, pelo 4G (outro IP), o login continua funcionando enquanto o
   computador está bloqueado.

Espere 15 minutos (ou reinicie a API) para o seu IP sair do limite.

---

## 8. Backups

O que **não** precisa de backup: o código e as fotos do catálogo
(`backend/assets/`), que estão no git.

O que **precisa**:

No Railway, banco e fotos são **dois volumes** (o do serviço MySQL e o da
API), e cada serviço com volume tem uma aba **Backups**: agendamento diário
(guardado 6 dias), semanal (27 dias) ou mensal (89 dias), incremental,
cobrado como espaço de volume. Ligue pelo menos o **diário nos dois**.
Restaurar cria um volume novo a partir do backup e refaz o deploy do serviço;
o volume antigo fica guardado, desmontado.

1. **Banco.** O backup do volume do MySQL (acima). Fora do Railway, ou como
   cópia extra fora dele, agende um dump:

   ```bash
   mysqldump --single-transaction --routines --triggers \
     -h <host> -u tamba -p tamba | gzip > tamba-$(date +%F).sql.gz
   ```

   `--triggers` é necessário: sem ele, o dump perde os triggers da migration
   007 (no Railway eles foram aplicados; ver a seção 4.2). Guarde os dumps
   **fora** do servidor do banco.

2. **Fotos enviadas.** O backup do volume da API (acima). Os arquivos nunca
   são sobrescritos (nome aleatório, gravação única), então o maior risco é
   apagar por engano — ou perder o volume.

3. **Teste a restauração uma vez**, logo depois do primeiro backup:
   restaure o dump num banco vazio e abra o app apontando para ele. Backup
   que nunca foi restaurado não é garantia.

Os dois backups andam juntos: o banco guarda as chaves das fotos, o volume
da API guarda as fotos.

---

## 9. Conferência depois do deploy

- [ ] `https://api.exemplo.com.br/api/health` responde `{"status":"ok"}`.
- [ ] O site abre e a Dex mostra as fotos do catálogo (testa
      `PUBLIC_API_URL`).
- [ ] O console do navegador não mostra erro de CORS (testa `CORS_ORIGIN`).
- [ ] `/feed` aberto direto e recarregado não dá 404 (testa a reescrita).
- [ ] Cadastro e login funcionam.
- [ ] O log da API, na subida, diz "Fotos enviadas em /data/uploads" (testa
      `UPLOADS_DIR` e o volume).
- [ ] Uma captura com foto: a foto abre e a URL dela começa com
      `UPLOADS_PUBLIC_URL`.
- [ ] A foto continua lá depois de um novo deploy da API (testa o volume: sem
      ele, ela some aqui).
- [ ] O admin entra e vê a área de moderação; trocar a foto de uma espécie
      gera a miniatura.
- [ ] Não existe conta `admin@tamba.local` (testa `SEED_DEV_USERS=false`).
- [ ] No celular (Chrome no Android), o menu oferece "Instalar app" e o
      ícone instalado é o tambaqui.
- [ ] O primeiro backup rodou nos dois volumes (MySQL e API).
