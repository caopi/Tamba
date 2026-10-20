import { app } from "./app.js";
import { prepararArmazenamento, UPLOADS_DIR } from "./lib/storage.js";
import { pendingMigrations } from "./lib/migrations.js";

const PORT = process.env.PORT ?? 3333;

await prepararArmazenamento();

app.listen(PORT, () => {
  console.log(`Tamba API rodando em http://localhost:${PORT}/api`);
  console.log(`Fotos enviadas em ${UPLOADS_DIR}`);
  avisarMigrationsPendentes();
});

// Só avisa, nunca impede a subida (ver lib/migrations.js). Alto de propósito:
// é a primeira coisa a procurar no log de um deploy que trouxe migration.
async function avisarMigrationsPendentes() {
  try {
    const pendentes = await pendingMigrations();
    if (pendentes.length === 0) return;
    const linha = "=".repeat(72);
    console.error(
      `\n${linha}\n  MIGRATIONS PENDENTES: ${pendentes.join(", ")}\n` +
        `  A API está rodando contra um schema antigo. Rode \`npm run migrate\`\n` +
        `  e confira o pre-deploy command (DEPLOY.md, 4.6).\n${linha}\n`,
    );
  } catch (err) {
    console.error(`AVISO: não foi possível conferir as migrations pendentes: ${err.code ?? err.message}`);
  }
}
