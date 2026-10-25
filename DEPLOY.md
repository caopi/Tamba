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
| `VITE_API_URL` | `https://tamba-production-5fff.up.railway.app/api` | **Com** `/api` no final. É gravada no JavaScript **na hora do build**: defina-a nas variáveis de build do host e gere o build de novo sempre que ela mudar. Sem ela, o site tenta falar com `http://localhost:3333/api`. |

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

### 4.4 Primeiro admin (e qualquer seed depois do primeiro deploy)

O seed **não cria** a conta do admin; só promove uma conta que já existe. Não
há rota para virar admin. Ordem:

1. Com a API e o frontend no ar, cadastre-se pelo app com o e-mail do admin.
2. Rode o seed com `ADMIN_EMAIL` = esse e-mail (abaixo). Deve aparecer
   "`<e-mail>` promovido a admin."
3. Saia e entre de novo no app para o papel novo valer.

**Caminho padrão: `railway ssh`, de dentro do container da API.** O
container já tem `NODE_ENV=production`, `SEED_DEV_USERS=false` e o
`DATABASE_URL` da **rede privada**: nada passa pelo proxy público, e o
Public Networking do MySQL continua desligado. Foi assim que o primeiro admin
foi promovido (20/10/2026).

Preparação, uma vez por máquina (Railway CLI instalado, `railway login` e
`railway link` feitos **na pasta do repositório** — o vínculo é por pasta:
fora dela o CLI diz "No linked project found"):

1. **Chave SSH**, se a máquina não tiver (no Windows, `~/.ssh` pode nem
   existir):

   ```bash
   mkdir -p ~/.ssh
   ssh-keygen -t ed25519 -C "railway-tamba" -f ~/.ssh/id_ed25519
   ```

   Use uma **senha (passphrase)** na chave: sem ela, qualquer programa
   rodando com o seu usuário abre um shell em produção. Para pôr senha numa
   chave que já existe: `ssh-keygen -p -f ~/.ssh/id_ed25519`.
2. **Registrar a chave no Railway pelo comentário, não pelo caminho.** Com o
   caminho, o CLI responde "Key not found" (no Windows, ao menos):

   ```bash
   railway ssh keys add --key railway-tamba --name <nome da máquina>
   railway ssh keys list
   ```
3. **Aceitar a chave do servidor na primeira conexão.** Sem terminal (num
   script, ou com a entrada redirecionada), o SSH não consegue perguntar e
   falha com "Host key verification failed". O `railway ssh` liga em
   `ssh.railway.com`, cuja chave, vista em 20/10/2026, é:

   ```
   ssh.railway.com ED25519 SHA256:+S1xg92FrnHz6pY3bpkmh1OGtWQGNANXilPzlxA7B1g
   ```

   O Railway não publica essa impressão digital; ela fica registrada **aqui**
   para que uma troca seja percebida, não aceita em silêncio. Confira antes
   de aceitar:

   ```bash
   ssh-keyscan ssh.railway.com 2>/dev/null | ssh-keygen -lf -
   ```

   Se der o mesmo `SHA256:+S1xg...`, acrescente ao `known_hosts`:
   `ssh-keyscan ssh.railway.com 2>/dev/null >> ~/.ssh/known_hosts`. **Se der
   outro valor, pare** e confirme com o Railway antes (pode ser troca legítima
   da chave deles, ou alguém no meio do caminho). Depois disso, se a chave
   mudar, o SSH recusa conectar.

O seed, da pasta do repositório (pede a senha da chave):

```bash
railway ssh -- 'cd /app && ADMIN_EMAIL=<e-mail> npm run seed'
```

Sem `ADMIN_EMAIL`, o mesmo comando só reaplica o catálogo (depois de mudar o
catálogo, por exemplo). Para conferir antes, sem mexer em nada:
`railway ssh -- 'echo $NODE_ENV $SEED_DEV_USERS'` tem de mostrar
`production false`.

**No PowerShell**, as aspas aninhadas acima quebram (o `railway` do npm é um
`railway.ps1`, que engole o `--` e acrescenta outra camada de aspas; o
sintoma é ficar preso no prompt de continuação `>>`). Use o `railway.cmd`
com `--%` e um comando sem aspas nem `&&`:

```powershell
railway.cmd --% ssh -- printenv NODE_ENV SEED_DEV_USERS
railway.cmd --% ssh -- npm --prefix /app run seed
```

O primeiro tem de mostrar `production` e `false`; o segundo termina com
"Seed concluído: N espécies e M pesqueiros.". Com `ADMIN_EMAIL`, use a aba
Console (abaixo), que aceita a linha inteira. Rode o seed com o deploy da
API já **Active**: o SSH entra no container em uso, e um deploy no meio o
derruba.

Se o CLI disser que a sessão expirou, `railway login` de novo — o Railway
invalidou as sessões depois do incidente de outubro de 2026.

**Se o `railway ssh` não conectar**, nesta ordem:

1. **Aba Console** do serviço da API no painel: `cd /app && npm run seed`.
2. **Pre-deploy command temporário:** Settings → Deploy → Pre-deploy Command
   = `npm run migrate && npm run seed`, refaça o deploy, confira "Seed
   concluído" no log do pre-deploy e **volte na hora para `npm run
   migrate`**. Deixar o seed ali o faria rodar a cada deploy, devolvendo
   espécie e pesqueiro que o admin apagou pelo app (seção 4.6).
3. **Da máquina local, com Public Networking** — só se os dois acima
   falharem: o roteiro da seção 4.3 (PowerShell com o `MYSQL_PUBLIC_URL`
   mascarado, `NODE_ENV=production`, `SEED_DEV_USERS=false` e `ADMIN_EMAIL`
   definidos no shell), terminando com o Public Networking **desligado** de
   novo. Passa pelo proxy público sem TLS (seção 4.2), e é a única janela em
   que a senha do banco fica utilizável de fora: se houver suspeita de que
   ela vazou, troque-a antes (seção 4.7).

Em 21/10/2026 o `railway ssh` dava "Connection timed out" na porta 22: era a
indisponibilidade do próprio Railway, não bloqueio de rede — no dia seguinte
funcionou normalmente. Timeout ali, portanto, não é motivo para pular direto
para o Public Networking.

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
- **Onde ver a saída dele** (conferido em 20/10/2026): `railway deployment
  list` dá o id do deploy, e `railway logs <id>` mostra os dois containers
  em ordem — primeiro um `Starting Container` **sem** "Mounting volume",
  com o `> tamba-backend@1.0.0 migrate` e "Nada a fazer..." ou
  "aplicada: ...", que é o pre-deploy; depois "Mounting volume", outro
  `Starting Container` e o `npm start`. No painel, é a aba **Deploy Logs**
  do deploy (o visualizador às vezes abre no meio: role para cima ou **Load
  more**). Há relatos de o Railway não mostrar essa saída quando o
  pre-deploy falha, por isso a conferência abaixo não depende dela.

**Conferência obrigatória depois de todo deploy que trouxer migration:**
abra `https://tamba-production-5fff.up.railway.app/api/health` e confira
que a resposta é exatamente `{"status":"ok"}`. A API compara os `.sql` de
`database/migrations/` com `schema_migrations`; se alguma não foi
aplicada (o pre-deploy não rodou: campo apagado, configuração errada), a
resposta vem assim:

```json
{ "status": "degraded", "pendingMigrations": ["019_....sql"], "error": "Há migrations não aplicadas: ..." }
```

e o log de **toda** subida da API traz uma faixa `MIGRATIONS PENDENTES:` com
os nomes. Corrija rodando o migrate (confira o Pre-deploy Command e refaça o
deploy, ou rode da máquina local pelo roteiro da seção 4.3); o `/api/health`
volta a `ok` sozinho, sem reiniciar a API. `"degraded"` com `"error": "não
foi possível conferir..."` é outro problema: a API não alcança o banco.

**Por que só avisa e não recusa subir.** Com o volume, o Railway **para o
deploy antigo antes de subir o novo** (seção 1.1): se o novo recusasse subir,
não sobraria nada no ar até alguém com acesso ao Railway corrigir — e esse
alguém é uma pessoa. Um erro de configuração viraria site fora do ar. Só
avisando, o pior caso é algumas rotas darem 500 (as que usam o que a
migration criaria) e o resto do app continuar demonstrável; nada é gravado
errado, porque escrever numa coluna que falta falha em vez de gravar outra
coisa. O `/api/health` responde **sempre 200** pelo mesmo motivo: o health
check do Railway continua aprovando o deploy, e quem lê o `status` é gente.
O risco que sobra — o problema passar dias despercebido — é o que a
conferência obrigatória acima cobre. A falha **do** migrate no pre-deploy é
outra história: aí o deploy novo não acontece e o antigo segue no ar.

**Só o migrate; o seed continua manual.** O seed não volta a desativar nem
ativar nada (não mexe em `is_active`), mas **recria espécie que o admin
apagou** (espécie sem captura pode ser apagada) e **devolve a foto que o
admin tirou** (ARQUITETURA, "Crédito anda com a foto"). Rodar a cada deploy
desfaria essas escolhas, e não é preciso. O seed se roda à mão, da máquina
local, quando o catálogo (`species-catalog.js`, `species-images.js`) mudar ou para promover um admin
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

### 4.7 Trocar a senha do banco (rotação de credencial)

Quando: vazamento possível das variáveis do Railway (o incidente de outubro
de 2026 foi isso), ou troca periódica. A API entra como `root` pelo
`${{MySQL.MYSQL_URL}}` (seção 4.2), então é a senha do `root`.

**Por que não basta trocar a variável.** A imagem do MySQL só aplica
`MYSQL_ROOT_PASSWORD` quando o banco é criado pela primeira vez. Trocar a
variável depois **não muda a senha dentro do banco**: a API, no próximo
deploy, recebe a URL nova, o banco recusa ("Access denied") e o
`/api/health` fica `"degraded"`. A ordem é sempre: **senha no banco
primeiro, conferir, variável depois, deploy da API por último.**

**Antes de começar:**

- **Os dois backups da seção 8 feitos logo antes** — o dump (8.1) e o
  arquivo das fotos (8.2), conferidos pelo hash. Sem eles, não comece. Não
  há snapshot de volume (o plano Hobby não cria; seção 8), e para esta
  operação o dump é até a rede de segurança melhor: restaurado num serviço
  MySQL **novo**, ele chega com uma senha nova, em vez de trazer de volta a
  senha antiga, como um snapshot faria no meio da troca.
- **Evite gravações entre o dump e o fim** (faça num horário sem uso): o que
  for gravado depois do dump se perde se for preciso restaurá-lo.
- **Guarde a senha atual** até o fim (gerenciador de senhas, não um arquivo
  solto): depois do passo 6 ela some da variável, e é com ela que se
  descobre, no "Access denied", qual senha o banco tem. Apague-a quando o
  `/api/health` estiver `ok` com a nova.
- **Nada de Public Networking no banco atual.** Tudo abaixo é por dentro do
  Railway; ligar o acesso público é justamente a janela em que uma senha
  vazada ficaria utilizável. (A restauração da 8.4 A liga no serviço
  **novo**, de senha nova — outra coisa.)
- Faça isso **sozinho, sem deploy de código, migration ou seed na mesma
  sessão**: se algo quebrar, a causa é esta.

**Passo a passo:**

1. **Gere a senha nova** direto para a área de transferência. Hexadecimal de
   propósito: o `DATABASE_URL` exigiria codificar `@ : # /`, e hex não tem
   nenhum deles.

   ```powershell
   node -e "console.log(require('crypto').randomBytes(24).toString('hex'))" | Set-Clipboard
   ```

2. **Abra um shell no container do MySQL**, da pasta do repositório (forma
   que sobrevive às aspas do PowerShell; ver a seção 4.4):

   ```powershell
   railway.cmd --% ssh --service MySQL
   ```

   Se o `railway ssh` não conectar, use a aba **Console** do serviço MySQL
   no painel. O que importa é estar **dentro** do container.

3. **Entre no MySQL com a senha atual**, que o container já tem na variável
   (nada é colado):

   ```sh
   mysql -uroot -p"$MYSQL_ROOT_PASSWORD"
   ```

   Confira quais contas `root` existem (normalmente `%` e `localhost`):

   ```sql
   SELECT user, host FROM mysql.user WHERE user = 'root';
   ```

4. **Troque a senha de cada uma**, colando a nova no lugar de `<nova>`
   (o cliente `mysql` não grava no histórico linha com `IDENTIFIED`):

   ```sql
   ALTER USER 'root'@'%' IDENTIFIED BY '<nova>';
   ALTER USER 'root'@'localhost' IDENTIFIED BY '<nova>';
   ```

   A API continua no ar: a senha só é conferida ao abrir conexão, e as que
   já estão abertas seguem valendo.

5. **Confira a senha nova antes de mexer em qualquer variável.** Saia do
   `mysql` (`exit`) e entre de novo digitando a nova:

   ```sh
   mysql -uroot -p
   ```

   Se não entrar, **pare aqui**: a variável ainda tem a senha antiga, e com
   ela (`mysql -uroot -p"$MYSQL_ROOT_PASSWORD"`) dá para repetir o passo 4.

6. **Atualize a variável** no serviço **MySQL** → Variables:
   `MYSQL_ROOT_PASSWORD` = a nova. Antes de salvar, abra o **Raw Editor** e
   confira que `MYSQLPASSWORD`, `MYSQL_URL` e `MYSQL_PUBLIC_URL` são
   **referências** (`${{MYSQL_ROOT_PASSWORD}}`), não o texto da senha; se
   alguma tiver a senha escrita, troque também. O Railway deixa a mudança
   pendente até você clicar **Deploy**; aí o MySQL reinicia com a variável
   nova (o banco já existe, então ela não reaplica nada — serve só para as
   referências).

7. **Refaça o deploy da API** (Deployments → **Redeploy**): a referência
   `${{MySQL.MYSQL_URL}}` só é resolvida no deploy. Entre o passo 6 e este,
   a API pode perder as conexões e ficar fora do ar por alguns segundos.

8. **Confira:** `/api/health` responde `{"status":"ok"}` e o login funciona.

**Se der "Access denied" no passo 8:** a variável e o banco não batem. Entre
pelo shell do passo 2 e teste as duas senhas com `mysql -uroot -p`: a que
entrar é a que o banco tem; ponha essa na variável e refaça o deploy da API.

**Se nenhuma das duas entrar:** o banco atual ficou inacessível. Restaure o
dump num **serviço MySQL novo** (seção 8.4 A) e aponte a API para ele. As
fotos não são afetadas (estão no volume da API). O serviço antigo fica
parado até você ter certeza, e então pode ser apagado.

---

## 5. API: build e hospedagem

- Instale com `npm ci` **no próprio host** (Linux). Não copie `node_modules`
  do Windows: o `sharp`, usado para gerar a miniatura da foto de espécie,
  tem binário próprio por sistema, e o `npm ci` baixa o certo. Confira no log
  do build que o `sharp` instalou sem erro.
- Comando de início: `npm start` (com a mudança da seção 1.2).
- Teste de saúde: `GET /api/health` responde `{"status":"ok"}`. Use como
  health check do host. Responde **sempre 200**; `"status": "degraded"` no
  corpo indica migration pendente ou banco inacessível (seção 4.6).
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
  - **Vercel**: `frontend/vercel.json` (já no repositório; ver 6.1).
  - **Cloudflare Pages**: já faz isso sozinho quando não há `404.html` no
    build (não há).
  - **nginx**: `location / { try_files $uri $uri/ /index.html; }`

  Teste: abra `https://tamba.exemplo.com.br/feed` direto na barra de
  endereço e recarregue. Tem que abrir o feed, não um 404.

- **Cache.** Os arquivos em `dist/assets/` têm hash no nome e podem ter cache
  longo. O `index.html` e o `manifest.webmanifest` não: sirva-os com
  `Cache-Control: no-cache`, senão quem já abriu o site continua na versão
  antiga depois de um deploy.

### 6.1 Na Vercel, passo a passo

API em produção: `https://tamba-production-5fff.up.railway.app`.

1. **Importar.** Na Vercel: **Add New → Project → Import** o repositório
   `caopi/Tamba` (autorize o app da Vercel no GitHub na primeira vez).
2. **Configure Project:**

   | Campo | Valor |
   | --- | --- |
   | Root Directory | `frontend` (botão **Edit**) |
   | Framework Preset | **Vite** (a Vercel detecta sozinha depois do Root Directory) |
   | Build Command | `npm run build` (o padrão; roda `tsc -b` e `vite build`) |
   | Output Directory | `dist` (o padrão do Vite) |
   | Install Command | o padrão |

   O Node do build tem de ser 20.19+ ou 22.12+ (exigência do Vite 8); o
   padrão da Vercel atende. Se precisar trocar: **Settings → Build and
   Deployment → Node.js Version**.
3. **Environment Variables**, antes do primeiro deploy (é gravada no
   JavaScript **no build**; mudar depois exige refazer o deploy):

   | Nome | Valor |
   | --- | --- |
   | `VITE_API_URL` | `https://tamba-production-5fff.up.railway.app/api` |

   **Com `/api` no final, uma vez só, e sem barra depois.** O frontend só
   acrescenta o resto: `${VITE_API_URL}/auth/login`, `${VITE_API_URL}/uploads`
   (`src/api/`), nunca outro `/api` — então não há como virar `/api/api`. Sem
   o `/api`, toda chamada dá 404 (conferido: `/health` dá 404, `/api/health`
   dá 200). A barra no final (`/api/`) por acaso funciona (o Express aceita
   `/api//health`), mas não conte com isso.
4. **Deploy.** A Vercel dá o domínio de produção, `https://<projeto>.vercel.app`
   (em **Settings → Domains**). É **esse** que vai no CORS — não as URLs de
   preview de cada deploy (`<projeto>-<hash>-<conta>.vercel.app`), que são
   outras origens e ficam bloqueadas pelo CORS de propósito.
5. **De volta ao Railway**, no serviço da API, **Variables**:

   ```
   CORS_ORIGIN=https://<projeto>.vercel.app
   FRONTEND_URL=https://<projeto>.vercel.app
   ```

   Exatamente o domínio, **sem barra no final** e em minúsculas: outro
   formato no `CORS_ORIGIN` impede a API de subir (seção 3). Aplicar refaz o
   deploy da API (alguns segundos fora do ar).

**O `frontend/vercel.json`** faz duas coisas:

- **Reescrita da SPA:** todo caminho que não for arquivo existente serve
  `/index.html` (a Vercel confere o arquivo antes de reescrever), **menos
  `/assets/`**: arquivo de build que falta dá 404 de verdade, e não o
  `index.html` no lugar de um JavaScript.
- **Cache:** `/assets/*` (nome com hash) com um ano, `immutable`. O resto,
  `index.html` e `manifest.webmanifest` inclusive, fica no padrão da Vercel
  (`max-age=0, must-revalidate`): quem já abriu o site pega a versão nova
  no próximo acesso.

**Conferência:**

- [ ] `https://<projeto>.vercel.app/feed` aberto direto na barra de endereço
      e recarregado (F5) abre o app, não um 404 da Vercel.
- [ ] O console do navegador (F12) não mostra erro de CORS no login.
- [ ] Na aba Network, as chamadas vão para
      `https://tamba-production-5fff.up.railway.app/api/...` (uma `/api` só).

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

**O que existe: dois backups manuais.** O plano Hobby do Railway só deixa
ver, restaurar e apagar backups que já existem — criar backup, agendar e
recuperar para um ponto no tempo exigem o **Pro**. Então não há snapshot
nenhum, e o que temos é:

| | Dump do banco (8.1) | Arquivo das fotos (8.2) |
| --- | --- | --- |
| O que leva | Todas as tabelas (`mysqldump`) | `/data/uploads`, as fotos enviadas pelo app |
| Onde roda | Dentro do container do **MySQL** | Dentro do container da **API** |
| Restaura onde | Em qualquer MySQL 8.0.19+ | Em qualquer pasta de uploads (volume ou disco local) |

Os dois **são os únicos backups**, e os dois são **manuais**: não há
agendador e não vai haver num projeto de um semestre. Um backup que ninguém
roda não é backup, então eles têm hora marcada — **sempre os dois juntos**:

- **antes da troca de senha do banco** (seção 4.7);
- **antes de qualquer outra operação arriscada** (migration que apaga
  coluna, restauração, mexer nas variáveis ou no volume de um serviço);
- **uma vez na semana anterior à apresentação.**

Juntos porque um depende do outro: o banco guarda as chaves das fotos, o
volume guarda as fotos. Um dump sem as fotos restaura capturas sem imagem.

O que **não** precisa de backup: o código e as fotos do catálogo
(`backend/assets/`), que estão no git.

**O que o Pro daria** (registrado para quem decidir no futuro): snapshots
automáticos dos dois volumes, em agendamento diário (guardado 6 dias),
semanal (27) ou mensal (89), incrementais, cobrados como espaço de volume,
restaurados pela aba **Backups** de cada serviço (o Railway cria um volume
novo a partir do snapshot; o antigo fica desmontado). Não foi contratado:
para o tamanho do projeto, os dois passos manuais abaixo bastam. Mesmo com o
Pro, o dump continuaria valendo: um snapshot só volta **dentro** do Railway,
e um dump volta em qualquer lugar.

**Onde guardar — os dois arquivos, lado a lado.** O dump tem os **e-mails e
os hashes de senha** de todos os usuários, e as fotos são dos usuários:
**nunca** no repositório (o `.gitignore` barra `*.sql.gz`, `*.tar.gz`,
`*.b64` e `*.7z`, mas não conte só com isso), nem na pasta do projeto — que
está dentro do OneDrive, ou seja, sincronizada com um terceiro —, nem por
e-mail ou chat. Guarde **compactados com senha** (7-Zip, AES-256, nomes de
arquivo cifrados; a senha no gerenciador de senhas), **fora do Railway e
fora da pasta do projeto**: um HD externo ou pendrive, ou uma pasta de
nuvem pessoal — já cifrados. Guarde os três mais recentes de cada e apague
os mais antigos.

**A técnica de transporte, igual para os dois.** Tudo roda **dentro** dos
containers, pelo `railway ssh` — sem Public Networking. Para trazer o
arquivo: o terminal do SSH pode trocar `\n` por `\r\n` e o PowerShell 5.1
recodifica o que redireciona; qualquer um dos dois estraga um arquivo
binário em silêncio. Por isso ele sai em **base64** (o `certutil -decode`
ignora o `\r` a mais) e o **SHA-256 dos dois lados** prova que a cópia é
idêntica. O `cmd /c` grava os bytes como vieram. Os comandos rodam **da
pasta do repositório** (o vínculo do CLI é por pasta) e gravam **fora** dela,
em `%USERPROFILE%\tamba-backup`. Uma pasta temporária: dali os arquivos vão
cifrados para o destino e são apagados.

### 8.1 Dump do banco

1. **Shell no container do MySQL:**

   ```powershell
   railway.cmd --% ssh --service MySQL
   ```

   Lá dentro (o banco no Railway se chama `railway`, ver `MYSQLDATABASE`):

   ```sh
   mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --single-transaction --routines --triggers --set-gtid-purged=OFF --no-tablespaces railway | gzip > /tmp/tamba.sql.gz
   base64 /tmp/tamba.sql.gz > /tmp/tamba.b64
   sha256sum /tmp/tamba.sql.gz
   exit
   ```

   O aviso "Using a password on the command line interface can be
   insecure" é esperado: a senha não sai do container. **`--triggers` é
   obrigatório**: sem ele o dump perde os dois triggers da migration 007.
   **Anote o hash.**

2. **Traga para a máquina:**

   ```powershell
   New-Item -ItemType Directory -Force "$env:USERPROFILE\tamba-backup" | Out-Null
   cmd /c "railway ssh --service MySQL -- cat /tmp/tamba.b64 > %USERPROFILE%\tamba-backup\tamba.b64"
   certutil -decode "$env:USERPROFILE\tamba-backup\tamba.b64" "$env:USERPROFILE\tamba-backup\tamba-AAAA-MM-DD.sql.gz"
   (Get-FileHash "$env:USERPROFILE\tamba-backup\tamba-AAAA-MM-DD.sql.gz" -Algorithm SHA256).Hash.ToLower()
   ```

   O último comando tem de mostrar **o mesmo hash** do passo 1. Diferente:
   a cópia veio corrompida — repita o passo 2.

3. **Confira que é um dump completo** (o `mysqldump` só escreve "Dump
   completed" no fim quando termina bem):

   ```powershell
   node -e "const s=require('zlib').gunzipSync(require('fs').readFileSync(process.argv[1])).toString(); console.log(s.includes('-- Dump completed'), (s.match(/^CREATE TABLE/gm)||[]).length + ' tabelas', (s.match(/CREATE.*TRIGGER/g)||[]).length + ' triggers')" "$env:USERPROFILE\tamba-backup\tamba-AAAA-MM-DD.sql.gz"
   ```

   Esperado hoje (até a migration 019): `true 12 tabelas 2 triggers`.

4. **Apague no container:**

   ```powershell
   railway.cmd --% ssh --service MySQL -- rm -f /tmp/tamba.sql.gz /tmp/tamba.b64
   ```

Se o container não tiver `gzip` ("command not found"), troque o pipe por
`--result-file=/tmp/tamba.sql`, faça o base64 do `.sql` e, no passo 3, tire
o `gunzipSync`.

### 8.2 Arquivo das fotos

As fotos ficam no volume da **API** (`UPLOADS_DIR=/data/uploads`), então os
comandos vão no serviço da API (o padrão do `railway ssh` na pasta do
repositório). Os arquivos nunca são sobrescritos (nome aleatório, gravação
única), então arquivar com a API no ar é seguro: no máximo uma foto enviada
durante o `tar` fica para o próximo arquivo.

0. **Confira as ferramentas** do container da API (uma vez):

   ```powershell
   railway.cmd --% ssh -- which tar gzip base64 sha256sum
   ```

   Tem de mostrar os quatro caminhos. Se faltar algum, pare e veja a nota
   no fim desta seção.

1. **Shell no container da API:**

   ```powershell
   railway.cmd --% ssh
   ```

   Lá dentro:

   ```sh
   du -sh /data/uploads
   find /data/uploads -type f | wc -l
   tar -czf /tmp/fotos.tar.gz -C /data uploads
   base64 /tmp/fotos.tar.gz > /tmp/fotos.b64
   sha256sum /tmp/fotos.tar.gz
   exit
   ```

   **Anote** o tamanho, o número de arquivos e o hash. O base64 tem ~1/3 a
   mais que o `tar.gz` (foto já é comprimida, o gzip quase não reduz): com
   dezenas de MB, a cópia do passo 2 leva alguns minutos.

2. **Traga para a máquina:**

   ```powershell
   cmd /c "railway ssh -- cat /tmp/fotos.b64 > %USERPROFILE%\tamba-backup\fotos.b64"
   certutil -decode "$env:USERPROFILE\tamba-backup\fotos.b64" "$env:USERPROFILE\tamba-backup\fotos-AAAA-MM-DD.tar.gz"
   (Get-FileHash "$env:USERPROFILE\tamba-backup\fotos-AAAA-MM-DD.tar.gz" -Algorithm SHA256).Hash.ToLower()
   ```

   Mesmo hash do passo 1, ou repita.

3. **Confira o conteúdo** com o `tar` do próprio Windows (10 e 11 já vêm com
   ele): o número de arquivos tem de bater com o `find` do passo 1.

   ```powershell
   (tar -tzf "$env:USERPROFILE\tamba-backup\fotos-AAAA-MM-DD.tar.gz" | Where-Object { $_ -notmatch '/$' }).Count
   ```

4. **Apague no container:**

   ```powershell
   railway.cmd --% ssh -- rm -f /tmp/fotos.tar.gz /tmp/fotos.b64
   ```

**Se faltar ferramenta no container da API:** o caminho alternativo é baixar
as fotos pela própria API, que as serve publicamente em `UPLOADS_PUBLIC_URL`:
as chaves estão no dump (`catch_photos.url`, `users.avatar_url` e as fotos de
espécie enviadas pelo admin). Isso não está montado; avise antes de seguir.

### 8.3 Guardar

Com os dois arquivos conferidos em `%USERPROFILE%\tamba-backup`:

```powershell
cd "$env:USERPROFILE\tamba-backup"
& "C:\Program Files\7-Zip\7z.exe" a -p -mhe=on <destino>\tamba-AAAA-MM-DD.7z tamba-AAAA-MM-DD.sql.gz fotos-AAAA-MM-DD.tar.gz
Remove-Item tamba.b64, fotos.b64, tamba-AAAA-MM-DD.sql.gz, fotos-AAAA-MM-DD.tar.gz
```

O `-p` pede a senha (não fica no histórico); `-mhe=on` cifra também os nomes.
Um `.7z` por data, com o banco e as fotos do mesmo momento.

### 8.4 Restaurar

**O que foi conferido de verdade (22/10/2026):** o `mysqldump` com
exatamente essas opções, no banco local (MySQL 8.0), terminou sem erro com
as 12 tabelas, os 2 triggers da 007, o `schema_migrations` até a 019 e os
acentos intactos; o transporte foi simulado na máquina (um `.gz` em base64
com `\r\n` em toda linha voltou idêntico pelo `certutil`, e o `Get-FileHash`
em minúsculas sai no formato do `sha256sum`); a conferência do 8.1 passo 3
rodou no PowerShell 5.1. **No papel, ainda não feitos de verdade:** os dois
backups contra o Railway e as restaurações abaixo.

**A. Banco, a partir do dump.** Num MySQL **vazio** — o caminho mais seguro
é um **serviço MySQL novo** no projeto, não o atual:

1. No projeto do Railway: **+ New → Database → MySQL**. Ele nasce com banco
   `railway`, usuário `root` e uma senha nova, que nunca esteve nas
   variáveis antigas. O `root` do Railway tem SUPER, então os triggers
   entram (no MySQL 8.4 do Railway a 007 passou direto; seção 4.2). Fora do
   Railway, o usuário precisa de SUPER ou `log_bin_trust_function_creators
   = 1` (seção 4.5): sem isso a importação para no `CREATE TRIGGER` com o
   erro 1419.
2. Ligue o **Public Networking só no serviço novo**, importe da máquina e
   **desligue em seguida**. Isso não reabre a exposição da seção 4.7: a
   senha dele é nova. Descompacte o `.sql.gz` (7-Zip) e use o `source` do
   próprio cliente — no PowerShell não há `<`, e um pipe recodificaria o
   arquivo:

   ```powershell
   & "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -h <host público> -P <porta> -u root -p railway -e "source C:/caminho/tamba-AAAA-MM-DD.sql"
   ```

   (Host e porta do `MYSQL_PUBLIC_URL` do serviço novo; a senha, colada no
   prompt.)
3. Na API, `DATABASE_URL` = `${{<nome do serviço novo>.MYSQL_URL}}` e
   refaça o deploy. O pre-deploy roda o `migrate`, que aplica só o que for
   mais novo que o dump (o `schema_migrations` veio nele). **Não rode o
   seed**: os dados vieram do dump.
4. `/api/health` `ok`, login com uma conta conhecida, a Dex com as espécies.
5. O serviço MySQL antigo fica parado, não apagado, até você ter certeza.

O dump começa cada tabela com `DROP TABLE IF EXISTS`: importado num banco
que não está vazio, ele **substitui** as tabelas do Tamba. Tudo o que foi
gravado depois do dump se perde — por isso o dump vem logo antes da
operação arriscada, não horas antes.

**B. Fotos, a partir do arquivo.** O `tar` guarda o caminho `uploads/...`:

- **Num servidor novo ou na máquina local:** extraia na pasta pai do
  `UPLOADS_DIR` (`tar -xzf fotos-AAAA-MM-DD.tar.gz -C <pasta pai>`); as
  chaves no banco batem com os caminhos.
- **De volta ao volume da API no Railway:** o caminho seria mandar o
  arquivo para dentro do container pelo `railway ssh` (base64 pela entrada
  padrão) e extrair em `/data`. **Não foi testado** — o `railway ssh` pode
  não repassar a entrada; confira com um arquivo pequeno antes de precisar.

Depois de restaurar de qualquer jeito, apague as cópias descompactadas.

---

## 9. Conferência depois do deploy

- [ ] `https://tamba-production-5fff.up.railway.app/api/health` responde
      exatamente `{"status":"ok"}` — não `"degraded"` (seção 4.6).
- [ ] O site (`https://projeto-tamba.vercel.app` — não `tamba.vercel.app`,
      que é de outra pessoa) abre e a Dex mostra as fotos do catálogo (testa
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
- [ ] Os dois backups manuais da seção 8 (dump e fotos) foram feitos, conferidos
      pelo hash e guardados cifrados fora do projeto.
