// Armazenamento de arquivos enviados (fotos de captura).
//
// Por enquanto só existe o driver de disco local: os arquivos vão para
// backend/uploads/ (fora do git) e a própria API os serve em /uploads. Escolha
// deliberada de desenvolvimento — ninguém do grupo precisa de conta nem de
// credencial em serviço externo. Para produção (Cloudinary, S3...), basta
// escrever outro driver com o mesmo `save` / `getUrl` / `isStoredUrl` e
// trocar a constante `driver`: o resto do código só conhece as funções
// exportadas. Ver ARQUITETURA, "Decisões".

import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Pasta dos arquivos do driver local. Servida estaticamente em /uploads. */
export const UPLOADS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../uploads",
);

// Endereço público dos arquivos. Em desenvolvimento, a própria API.
const URL_PUBLICA = (process.env.UPLOADS_PUBLIC_URL ?? "http://localhost:3333/uploads").replace(
  /\/+$/,
  "",
);

const localDriver = {
  /**
   * Grava o arquivo com nome gerado aqui — nunca o nome que veio do cliente,
   * que poderia ter "../" ou caracteres que o sistema de arquivos interpreta.
   */
  async save({ buffer, extension }) {
    await mkdir(UPLOADS_DIR, { recursive: true });
    const id = `${randomBytes(16).toString("hex")}.${extension}`;
    // flag "wx": falha se o arquivo já existir, em vez de sobrescrever.
    await writeFile(path.join(UPLOADS_DIR, id), buffer, { flag: "wx" });
    return id;
  },

  getUrl(id) {
    return `${URL_PUBLICA}/${id}`;
  },

  /** A URL aponta para um arquivo deste armazenamento (e não para fora)? */
  isStoredUrl(url) {
    const prefixo = `${URL_PUBLICA}/`;
    if (typeof url !== "string" || !url.startsWith(prefixo)) return false;
    // Só o formato de id que o próprio save gera: 32 hex + extensão.
    return /^[0-9a-f]{32}\.(jpg|png|webp)$/.test(url.slice(prefixo.length));
  },
};

const driver = localDriver;

/** Grava `{ buffer, extension }` e devolve o id do arquivo. */
export function save(arquivo) {
  return driver.save(arquivo);
}

export function getUrl(id) {
  return driver.getUrl(id);
}

export function isStoredUrl(url) {
  return driver.isStoredUrl(url);
}
