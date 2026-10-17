-- Raridade passa de ENUM para VARCHAR + CHECK, para que omiti-la seja ERRO.
--
-- Por quê: no MySQL, uma coluna ENUM NOT NULL sem DEFAULT ganha como default
-- IMPLÍCITO o primeiro valor da lista, mesmo em modo estrito. Com a 008, um
-- INSERT que simplesmente esquecesse `rarity` gravava 'comum' em silêncio, em
-- vez de falhar — e "raridade obrigatória" (REQ-12, RGN-11) virava "raridade
-- comum por omissão". VARCHAR NOT NULL sem DEFAULT não tem esse default
-- implícito: em modo estrito, omitir a coluna dá o erro 1364 ("Field 'rarity'
-- doesn't have a default value").
--
-- O CHECK faz o papel da lista do ENUM, no mesmo estilo dos outros CHECKs do
-- schema (faixas da 004, coordenadas da 005).
--
-- COLLATE utf8mb4_bin: a collation padrão das tabelas (_ai_ci) ignora caixa e
-- acento, e com ela o CHECK aceitaria 'COMUM' ou 'Raro' — que o ENUM
-- normalizava para o valor canônico, mas o VARCHAR gravaria do jeito que veio.
-- Com _bin, só passam os quatro valores exatos.
--
-- Os valores atuais são preservados: o ALTER converte cada ENUM no texto dele.

ALTER TABLE fish_species
  MODIFY COLUMN rarity VARCHAR(12) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  ADD CONSTRAINT chk_fish_species_rarity
    CHECK (rarity IN ('comum', 'incomum', 'raro', 'muito_raro'));
