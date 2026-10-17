-- Observações, coordenadas, moderação e fotos múltiplas da captura
-- (RGN-07, RGN-08, RGN-12, RGN-13).

ALTER TABLE catches
  ADD COLUMN notes                 TEXT          NULL COMMENT 'Clima, isca, equipamento',
  -- Cidade/região: vem do `location` do pesqueiro do catálogo ou é digitada.
  -- É o que os outros usuários veem quando o autor não compartilha a
  -- coordenada exata (RGN-13).
  ADD COLUMN region                VARCHAR(120)  NULL AFTER spot_name,
  ADD COLUMN latitude              DECIMAL(9, 6) NULL,
  ADD COLUMN longitude             DECIMAL(9, 6) NULL,
  -- Peso/tamanho fora da faixa da espécie, aceito com confirmação (RGN-08).
  ADD COLUMN is_flagged_for_review BOOLEAN       NOT NULL DEFAULT FALSE,
  -- Escondida pela moderação ou por denúncias (RGN-14); some do feed (RGN-12).
  ADD COLUMN is_hidden             BOOLEAN       NOT NULL DEFAULT FALSE,
  ADD COLUMN updated_at            DATETIME(3)   NOT NULL
    DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  -- O feed lista as capturas mais recentes de todo mundo.
  ADD KEY idx_catches_created_at (created_at),
  ADD CONSTRAINT chk_catches_latitude  CHECK (latitude  BETWEEN -90  AND 90),
  ADD CONSTRAINT chk_catches_longitude CHECK (longitude BETWEEN -180 AND 180),
  -- Coordenada pela metade não serve para nada: ou as duas, ou nenhuma.
  ADD CONSTRAINT chk_catches_coords_pair CHECK ((latitude IS NULL) = (longitude IS NULL));

-- Capturas antigas ligadas a um pesqueiro do catálogo herdam a região dele.
UPDATE catches c
INNER JOIN fishing_spots p ON p.id = c.spot_id
SET c.region = LEFT(p.location, 120);

-- O ADD COLUMN acima (e o UPDATE de região) carimbaram "agora" nas linhas
-- antigas. Fica por último para desfazer os dois.
UPDATE catches SET updated_at = created_at;

-- Uma captura tem uma ou mais fotos. O "pelo menos uma" (RGN-07) é garantido na
-- aplicação: o banco não tem como exigir uma linha filha.
CREATE TABLE catch_photos (
  id         CHAR(36)         NOT NULL,
  catch_id   CHAR(36)         NOT NULL,
  url        TEXT             NOT NULL,
  -- Ordem de exibição; a posição 0 é a capa.
  position   TINYINT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_catch_photos_catch (catch_id, position),
  CONSTRAINT fk_catch_photos_catch
    FOREIGN KEY (catch_id) REFERENCES catches (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

-- Leva a foto única das capturas antigas para a tabela nova. UUID() do MySQL
-- gera 36 caracteres, mesmo formato do randomUUID da aplicação.
-- catches.photo_url NÃO é removida aqui: o código atual ainda lê essa coluna.
-- Ela sai numa migration própria, junto com a mudança no model.
INSERT INTO catch_photos (id, catch_id, url, position, created_at)
SELECT UUID(), id, photo_url, 0, created_at
FROM catches
WHERE photo_url IS NOT NULL AND photo_url <> '';
