-- A grade da Dex deixa de usar a versão pixel art (96 px, migration 014) e
-- passa a usar uma miniatura nítida, em cor cheia (~400 px, WebP), gerada por
-- `npm run thumbs` em assets/species/thumb/. A coluna continua a mesma
-- (image_thumb_url); muda só o arquivo para onde ela aponta.
--
-- Só as fotos do repositório: as de upload ganham a miniatura nova quando o
-- admin salvar a foto de novo.

UPDATE fish_species
SET image_thumb_url = REPLACE(REPLACE(image_thumb_url, '/assets/species/pixel/', '/assets/species/thumb/'), '.png', '.webp')
WHERE image_thumb_url LIKE '/assets/species/pixel/%.png';
