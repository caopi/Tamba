import { app } from "./app.js";
import { prepararArmazenamento, UPLOADS_DIR } from "./lib/storage.js";

const PORT = process.env.PORT ?? 3333;

await prepararArmazenamento();

app.listen(PORT, () => {
  console.log(`Tamba API rodando em http://localhost:${PORT}/api`);
  console.log(`Fotos enviadas em ${UPLOADS_DIR}`);
});
