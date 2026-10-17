-- Raridade, faixas plausíveis de peso/tamanho e curiosidades da espécie
-- (RGN-08, RGN-16/17).
--
-- As faixas são NULL-áveis: uma espécie cadastrada pelo admin pode não ter faixa
-- conhecida, e nesse caso a captura simplesmente não é sinalizada. O seed
-- preenche as faixas do catálogo atual.
--
-- `is_active`: espécie nunca é apagada, só desativada (RGN-17). A FK
-- fk_catches_species (RESTRICT, da 001) continua barrando DELETE de espécie
-- com capturas no próprio banco.
--
-- `rarity` é NULL-ável e sem DEFAULT de propósito: o seed só preenche coluna
-- vazia (COALESCE no upsert, para não pisar em edição do admin), e um DEFAULT
-- 'comum' deixaria a coluna "cheia" antes do seed rodar. A obrigatoriedade para
-- espécie nova fica na validação da rota de admin.
--
-- Unidades iguais às da captura: peso em kg, comprimento em cm.
-- Os CHECKs passam quando algum lado é NULL (comparação com NULL não é FALSE).

ALTER TABLE fish_species
  ADD COLUMN rarity      ENUM('comum', 'incomum', 'raro', 'muito_raro') NULL,
  ADD COLUMN min_weight  DECIMAL(7, 3) NULL COMMENT 'Peso mínimo plausível (kg)',
  ADD COLUMN max_weight  DECIMAL(7, 3) NULL COMMENT 'Peso máximo plausível (kg)',
  ADD COLUMN min_length  DECIMAL(5, 1) NULL COMMENT 'Comprimento mínimo plausível (cm)',
  ADD COLUMN max_length  DECIMAL(5, 1) NULL COMMENT 'Comprimento máximo plausível (cm)',
  ADD COLUMN curiosities TEXT          NULL,
  ADD COLUMN is_active   BOOLEAN       NOT NULL DEFAULT TRUE,
  ADD CONSTRAINT chk_fish_species_weight_range
    CHECK (min_weight > 0 AND min_weight <= max_weight),
  ADD CONSTRAINT chk_fish_species_length_range
    CHECK (min_length > 0 AND min_length <= max_length);
