-- Schema inicial do Tamba.
--
-- Convenções: tabelas no plural, colunas em snake_case, ids CHAR(36) com UUID
-- gerado na aplicação (crypto.randomUUID), datas em DATETIME(3) sempre em UTC.
-- Charset utf8mb4 por causa dos acentos dos nomes de peixe.

CREATE TABLE users (
  id            CHAR(36)     NOT NULL,
  email         VARCHAR(191) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name          VARCHAR(120) NOT NULL,
  created_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_users_email (email)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

-- Catálogo fixo de espécies (a "Dex"). Populado pelo seed, nunca pelo usuário.
-- O UNIQUE em `name` é o que permite o upsert do seed (ON DUPLICATE KEY UPDATE).
CREATE TABLE fish_species (
  id                CHAR(36)     NOT NULL,
  name              VARCHAR(120) NOT NULL,
  scientific_name   VARCHAR(180) NOT NULL,
  habitat           TEXT         NOT NULL,
  image_url         TEXT         NULL,
  -- Iscas típicas, separadas por vírgula: 'massa, milho, minhoca'.
  recommended_baits VARCHAR(255) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_fish_species_name (name)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

-- Pesqueiro, rio ou represa. google_place_id fica nulo até integrarmos
-- com a API do Google Places.
CREATE TABLE fishing_spots (
  id              CHAR(36)     NOT NULL,
  name            VARCHAR(180) NOT NULL,
  location        VARCHAR(255) NOT NULL,
  google_place_id VARCHAR(255) NULL,
  PRIMARY KEY (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

-- Registro central do app: um peixe pescado por um usuário.
CREATE TABLE catches (
  id         CHAR(36)    NOT NULL,
  user_id    CHAR(36)    NOT NULL,
  species_id CHAR(36)    NOT NULL,
  spot_id    CHAR(36)    NULL,
  weight     DOUBLE      NOT NULL COMMENT 'Peso em quilogramas (kg)',
  length     DOUBLE      NOT NULL COMMENT 'Comprimento em centímetros (cm)',
  photo_url  TEXT        NULL,
  caught_at  DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_catches_user_caught_at (user_id, caught_at),
  KEY idx_catches_species (species_id),
  -- Apagar o usuário apaga as capturas dele.
  CONSTRAINT fk_catches_user
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  -- Espécie usada por alguma captura não pode ser apagada.
  CONSTRAINT fk_catches_species
    FOREIGN KEY (species_id) REFERENCES fish_species (id) ON DELETE RESTRICT,
  -- Apagar o pesqueiro só desassocia a captura, não a perde.
  CONSTRAINT fk_catches_spot
    FOREIGN KEY (spot_id) REFERENCES fishing_spots (id) ON DELETE SET NULL
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;
