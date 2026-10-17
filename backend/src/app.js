import express from "express";
import cors from "cors";
import { routes } from "./routes/index.js";
import { notFound, errorHandler } from "./middlewares/errorHandler.js";
import { UPLOADS_DIR } from "./lib/storage.js";

export const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN ?? "http://localhost:5173" }));
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

app.use("/api", routes);

// Precisam ficar por último, depois de todas as rotas.
app.use(notFound);
app.use(errorHandler);
