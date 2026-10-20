import express from "express";
import cors from "cors";
import { routes } from "./routes/index.js";
import { notFound, errorHandler } from "./middlewares/errorHandler.js";
import { ASSETS_DIR, UPLOADS_DIR } from "./lib/storage.js";

export const app = express();

// Quantos proxies há entre a internet e a API. Atrás do proxy do Railway, o
// Express vê o IP do proxy, não o de quem fez a request; com o número certo,
// req.ip passa a ser o do cliente (lido do X-Forwarded-For). O limite de
// requisições depende disso: ver DEPLOY.md, seção 7. Sem proxy (na máquina
// local), 0: aí um X-Forwarded-For mandado pelo cliente é ignorado.
app.set("trust proxy", lerTrustProxy(process.env.TRUST_PROXY));

function lerTrustProxy(valor) {
  if (valor === undefined || valor === "") return 0;
  if (!/^\d+$/.test(valor)) {
    throw new Error(`TRUST_PROXY inválido: "${valor}" (precisa ser o número de proxies, ex.: 1)`);
  }
  return Number(valor);
}

app.use(cors({ origin: lerOrigemCors(process.env.CORS_ORIGIN) }));

/**
 * Uma origem só, a do frontend. Sem a variável, a do Vite local: fechado
 * para qualquer outro site, nunca "*". Com valor, ele tem de ser exatamente
 * uma origem — esquema e domínio, sem caminho nem barra no final. O navegador
 * manda "https://tamba.vercel.app"; um "https://tamba.vercel.app/" nunca
 * casaria, e o site quebraria por CORS sem nenhum erro na API.
 */
function lerOrigemCors(valor) {
  if (!valor) return "http://localhost:5173";
  let origem = null;
  try {
    origem = new URL(valor).origin;
  } catch {
    // cai no erro abaixo
  }
  if (origem !== valor) {
    throw new Error(
      `CORS_ORIGIN inválido: "${valor}" (precisa ser só esquema e domínio, sem barra no final, ex.: https://tamba.vercel.app)`,
    );
  }
  return valor;
}
app.use(express.json());

// Fotos enviadas (driver de disco local do lib/storage.js). Fora de /api:
// é arquivo estático, não rota. O nome é aleatório e nunca muda, então pode
// ficar em cache. `nosniff` impede o navegador de "adivinhar" outro tipo
// para o arquivo além do que a extensão diz.
app.use(
  "/uploads",
  express.static(UPLOADS_DIR, {
    dotfiles: "deny",
    index: false,
    immutable: true,
    maxAge: "365d",
    setHeaders: (res) => res.setHeader("X-Content-Type-Options", "nosniff"),
  }),
);

// Imagens versionadas no repositório (fotos do catálogo). O nome do arquivo
// é o da espécie e a foto pode ser trocada mantendo o nome, então o navegador
// não pode usar a cópia guardada sem perguntar: `no-cache` faz ele conferir
// pelo ETag a cada vez (resposta 304, sem baixar de novo, se não mudou).
app.use(
  "/assets",
  express.static(ASSETS_DIR, {
    dotfiles: "deny",
    index: false,
    cacheControl: false,
    setHeaders: (res) => {
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("X-Content-Type-Options", "nosniff");
    },
  }),
);

app.use("/api", routes);

// Precisam ficar por último, depois de todas as rotas.
app.use(notFound);
app.use(errorHandler);
