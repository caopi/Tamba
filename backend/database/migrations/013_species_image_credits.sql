-- Crédito das fotos do catálogo e espaço reservado para um modelo 3D.
--
-- `image_url` (desde a 001) guarda de onde vem a foto, em um de dois formatos,
-- e quem transforma isso em URL é só o `storage.publicUrl`:
--   - caminho relativo à API, para as fotos versionadas no repositório
--     ("/assets/species/tambaqui.webp", preenchido pelo seed);
--   - URL absoluta, para a foto que o admin envia pelo app (upload comum,
--     na pasta dele em uploads/).
--
-- Toda foto de terceiros precisa de autor, licença e link da origem (CC BY
-- exige atribuição): é o que a ficha da espécie e a tela de créditos mostram.
-- Os três ficam NULL quando a espécie não tem foto. `image_caption` é a
-- legenda opcional, para quando a foto não mostra exatamente a entrada (nas de
-- gênero, "spp.": "Na foto: Cichla piquiti...").
--
-- `model_url`: reservado para um modelo 3D da espécie, ideia adiada. Fica
-- NULL e nada no código lê ou grava a coluna por enquanto; existe só para não
-- precisar de outra migration se a ideia voltar.

ALTER TABLE fish_species
  ADD COLUMN image_credit     VARCHAR(255) NULL AFTER image_url,
  ADD COLUMN image_license    VARCHAR(60)  NULL AFTER image_credit,
  ADD COLUMN image_source_url VARCHAR(500) NULL AFTER image_license,
  ADD COLUMN image_caption    VARCHAR(300) NULL AFTER image_source_url,
  ADD COLUMN model_url        VARCHAR(500) NULL AFTER image_caption;
