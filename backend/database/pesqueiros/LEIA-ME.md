# Pesqueiros — origem da carga inicial

`pesqueiros-busca-2026-10.csv` é o resultado bruto, sem nenhuma alteração, de
uma **busca assistida por IA** feita em outubro de 2026: 30 pesqueiros da
região de Bragança Paulista (SP) e arredores, com nome, cidade, UF, endereço,
link do Google Maps, uma fonte e um grau de confiança.

São dados gerados por terceiros sobre estabelecimentos reais. Regra: na dúvida,
a linha fica de fora. Só entra no `seed.js` o que foi conferido abaixo: **5 das
30 linhas**.

**As outras 25 não foram verificadas** e não vão ser curadas em lote. O Lucas,
que pesca na região, vai conferindo cada uma localmente e cadastrando as que
existem pelo cadastro de pesqueiros do app (admin, em Registrar Captura), não por este CSV nem pelo
seed. Daí em diante o banco de produção é a fonte da verdade sobre pesqueiros;
esta tabela registra só o estado em 21/10/2026.

## O que vale e o que não vale no CSV

- **`maps_url`** são links de Google Maps por CID, fáceis de inventar de um
  jeito convincente. Não foram conferidos em lote (exigiria a API do Google
  Places, adiada de propósito). Ficam aqui só como atalho para conferência à
  mão; **nunca** são guardados no banco nem usados como identificador. Também
  não são Place IDs: `fishing_spots.google_place_id` continua vazio.
- **`fonte`** igual a `maps_url` (9 linhas) não é confirmação independente.
- **`confianca`** é a nota que a própria IA deu a cada linha. Não serve de
  critério: o Pesqueiro do Galo, com o perfil suspeito, está como "alta".
- **`endereco`** não vai para o banco (nada no app o mostra).

O banco guarda só `name` e `location` = "Cidade, UF".

## Conferência (21/10/2026)

- **Fonte por script:** as 9 fontes que são site próprio ou notícia foram
  abertas por script, procurando o nome e a cidade na página; domínio que não
  abriu foi consultado no registro.br.
- **No seed:** a página da fonte confirma o nome e a cidade.
- **Não verificado:** todo o resto, pelo motivo da coluna "Fonte por script".

| # | Nome (como no CSV) | Cidade | Fonte por script | Situação |
|---|---|---|---|---|
| 1 | Pesqueiro Santa Rita Gigantes | Bragança Paulista, SP | site: nome, cidade e estrada conferem | **no seed** |
| 2 | Pesqueiro do Galo | Bragança Paulista, SP | Instagram (não conferível); perfil com "galo" duplicado, suspeito | não verificado |
| 3 | Pesqueiro da Penha | Bragança Paulista, SP | lista genérica da Buser, não confirma o pesqueiro | não verificado |
| 4 | Pesqueiro rancho verde | Bragança Paulista, SP | fonte = Maps | não verificado |
| 5 | Pesqueiro Portão da Montanha | Atibaia, SP | domínio registrado (08/2025), mas o site não tem conteúdo (HTTP 409) | não verificado |
| 6 | Pesqueiro Tilapia Park | Atibaia, SP | fonte é a página de *outro* nome (Boa Vista de Atibaia); mesma estrada da linha 10 | não verificado |
| 7 | Pesqueiro Kondo | Atibaia, SP | Facebook (não conferível) | não verificado |
| 8 | Pesqueiro Sanches | Atibaia, SP | Facebook (não conferível); "Estr. Boa Vista", mesmo grupo das linhas 6 e 10 | não verificado |
| 9 | Pesqueiro Ki Pesca Tres Lagoas | Atibaia, SP | lista genérica da Buser | não verificado |
| 10 | Pesqueiro & Restaurante Boa Vista de Atibaia | Atibaia, SP | fonte = Maps; mesma estrada da linha 6 | não verificado |
| 11 | Pesqueiro Rancho Pescador | Atibaia, SP | fonte = Maps | não verificado |
| 12 | Pesqueiro Do Renato | Piracaia, SP | **domínio nunca registrado** (registro.br: não existe) — fonte inventada | não verificado |
| 13 | Por do Sol Pesca & Camping | Piracaia, SP | Facebook (não conferível) | não verificado |
| 14 | Pesqueiro e Restaurante Trote | Piracaia, SP | fonte = Maps | não verificado |
| 15 | Pesqueiro Padilha | Joanópolis, SP | Facebook (não conferível) | não verificado |
| 16 | Pesqueiro e Restaurante Pires | Nazaré Paulista, SP | fonte = Maps | não verificado |
| 17 | Pesqueiro & Camping do Brancão | Nazaré Paulista, SP | fonte = Maps | não verificado |
| 18 | Pesqueiro Regagnin | Itatiba, SP | Instagram (não conferível) | não verificado |
| 19 | Três Coqueiros Pesqueiro e Lanchonete | Itatiba, SP | notícia da Rádio Itatiba: nome e cidade conferem | **no seed** |
| 20 | Pesqueiro Lagoa dos Patos | Jundiaí, SP | site confirma o nome, mas não a cidade | não verificado |
| 21 | Pesqueiro Cristais | Jundiaí, SP | **domínio nunca registrado** (registro.br: não existe) — fonte inventada | não verificado |
| 22 | Pesqueiro Metalurgicos | Jundiaí, SP | Instagram (não conferível) | não verificado |
| 23 | Gambini - Pesqueiro e Restaurante | Jundiaí, SP | fonte = Maps | não verificado |
| 24 | Pesqueiro & Gastrobar Ocean | Amparo, SP | Instagram (não conferível) | não verificado |
| 25 | PESQUEIRO DO NARDINHO - AMPARO | Amparo, SP | fonte = Maps | não verificado |
| 26 | Pesqueiro Nenê Oliani | Socorro, SP | site: nome e cidade conferem | **no seed** |
| 27 | Restaurante e Pesqueiro Pitauá | Socorro, SP | site: nome e cidade conferem | **no seed** |
| 28 | Pousada e Pesqueiro Boa Vida - Armazém do Peixe. | Extrema, MG | site: nome e cidade conferem | **no seed** |
| 29 | CPI Pesqueiro e Restaurante | Extrema, MG | Facebook (não conferível) | não verificado |
| 30 | Pesqueiro São José | Camanducaia, MG | fonte = Maps | não verificado |

Fonte inventada não prova que o pesqueiro não existe — só que aquela fonte não
serve. Essas linhas dependem da conferência à mão como as outras. As linhas 6,
8 e 10 (Atibaia, mesma estrada) podem ser um, dois ou três lugares.

No `seed.js` os nomes entram com a caixa e a pontuação acertadas (ex.: "Pousada
e Pesqueiro Boa Vida"); o CSV fica como veio.
