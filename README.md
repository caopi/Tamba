# 🎣 Tamba

![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-4479A1?style=for-the-badge&logo=mysql&logoColor=white)

O Tamba é um diário de pescarias no estilo "Pokédex de peixes": cada captura
registrada desbloqueia a espécie numa coleção pessoal, a Fish Dex, e mostra
quantas ainda faltam. Foi desenvolvido como projeto semestral no IFSP, campus
Bragança Paulista.

**Acesse:** <https://projeto-tamba.vercel.app>

O que dá para fazer:

- Registrar capturas com espécie, peso, tamanho, local e fotos
- Completar a Fish Dex, com 35 espécies de água doce, cada uma com raridade, ficha e curiosidades
- Acompanhar o recorde pessoal e as estatísticas no perfil
- Seguir outros pescadores, curtir e comentar as capturas no feed
- Receber notificações de curtidas, comentários e novos seguidores
- Instalar no celular como app (PWA)

<p align="center">
  <img src="docs/dex.webp" alt="Fish Dex: espécies capturadas com foto, as demais na sombra" width="300">
  &nbsp;&nbsp;
  <img src="docs/especie.webp" alt="Ficha de uma espécie: foto, raridade, iscas, faixa de peso e curiosidades" width="300">
</p>

## Como rodar localmente

**Pré-requisitos:** Node.js 22.9 ou mais novo e MySQL 8.

```bash
git clone https://github.com/caopi/Tamba.git
cd Tamba
```

**1. Banco.** Troque a senha dentro de
[`backend/database/setup.sql`](backend/database/setup.sql) e rode o arquivo
como root, uma única vez. Ele cria o banco `tamba` e o usuário `tamba`.

```bash
mysql -u root -p < backend/database/setup.sql
```

**2. Backend.** Copie o `.env.example` e, no `.env`, ajuste a senha da
`DATABASE_URL` (a mesma do `setup.sql`) e o `JWT_SECRET`. O restante já vem
pronto para desenvolvimento.

```bash
cd backend
npm install
cp .env.example .env
npm run migrate    # cria as tabelas
npm run seed       # catálogo de espécies, pesqueiros e contas de teste
npm run dev        # API em http://localhost:3333/api
```

**3. Frontend**, em outro terminal:

```bash
cd frontend
npm install
cp .env.example .env
npm run dev        # app em http://localhost:5173
```

Abra <http://localhost:5173> e entre com `admin@tamba.local` / `admin123`, uma
das contas de teste que o seed cria.

## Documentação

- [ARQUITETURA.md](ARQUITETURA.md): estrutura do código, banco, API e convenções
- [DEPLOY.md](DEPLOY.md): deploy na Vercel e no Railway, e backups
- [CREDITOS.md](CREDITOS.md): autoria e licença das fotos do catálogo

## Equipe

- Lucas Nogueira Sanchez
- Vinicius Aparecido da Silva
- Leticia Zavazi de Almeida
- Henrique Rachid
- Fernando Henrique Camargo
- David Miqueias Santos Paixão
