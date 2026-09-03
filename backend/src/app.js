import express from "express";
import cors from "cors";
import { routes } from "./routes/index.js";
import { notFound, errorHandler } from "./middlewares/errorHandler.js";

export const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN ?? "http://localhost:5173" }));
app.use(express.json());

app.use("/api", routes);

// Precisam ficar por último, depois de todas as rotas.
app.use(notFound);
app.use(errorHandler);
