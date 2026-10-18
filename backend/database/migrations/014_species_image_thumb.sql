-- Versão pequena (pixel art) da foto da espécie, para a grade da Dex no tema
-- retrô: ~96 px de largura, paleta reduzida, exibida com
-- image-rendering: pixelated. A ficha continua usando image_url (foto
-- inteira).
--
-- Mesmo formato do image_url: caminho relativo à API para as fotos do
-- repositório ("/assets/species/pixel/tambaqui.png", gerado por
-- `npm run pixel`) ou URL absoluta para a de upload (gerada pelo
-- species.service ao salvar a foto). NULL quando não há foto.

ALTER TABLE fish_species
  ADD COLUMN image_thumb_url VARCHAR(500) NULL AFTER image_url;

-- Bancos que já rodaram o seed com as fotos (013) têm image_url preenchido, e
-- o seed não mexe em coluna de espécie que já tem foto: a versão pixel das
-- fotos do repositório entra aqui. Mesmo nome de arquivo, em pixel/, PNG.
-- Foto enviada pelo app (URL absoluta) fica sem; o admin a ganha ao salvar.
UPDATE fish_species
SET image_thumb_url = CONCAT('/assets/species/pixel/',
                             SUBSTRING(image_url, LENGTH('/assets/species/') + 1,
                                       LENGTH(image_url) - LENGTH('/assets/species/') - LENGTH('.webp')),
                             '.png')
WHERE image_url LIKE '/assets/species/%.webp' AND image_thumb_url IS NULL;
