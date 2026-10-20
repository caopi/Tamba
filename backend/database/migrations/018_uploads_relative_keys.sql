-- Fotos enviadas: o banco passa a guardar a CHAVE do arquivo, não a URL.
--
-- Antes: "http://localhost:3333/uploads/<id do usuário>/<nome>.jpg".
-- Depois: "<id do usuário>/<nome>.jpg", e a API junta UPLOADS_PUBLIC_URL na
-- hora de responder (storage.publicUrl), como já fazia com as fotos do
-- catálogo ("/assets/..."). Trocar de domínio, de provedor ou pôr uma CDN
-- passa a ser trocar a variável, sem mexer no banco. Ver DEPLOY.md, 1.4.
--
-- Migration de DADOS: o código novo só reconhece como upload o que estiver
-- no formato de chave. Banco de desenvolvimento que não rodar esta migration
-- continua mostrando as fotos (URL absoluta passa intacta), mas as capturas
-- antigas deixam de poder receber essas fotos como "do próprio autor".
--
-- O que é convertido: só o que o driver local gerou, em qualquer host (quem
-- testou pelo celular pode ter usado o IP da rede no lugar de localhost) —
-- "<esquema>://<host>/uploads/" seguido exatamente de uma chave:
-- "<uuid>/<32 hex>.<ext>" ou, das fotos de antes da pasta por usuário, só
-- "<32 hex>.<ext>". Link externo e caminho do catálogo ("/assets/...") não
-- casam com o padrão e ficam como estão.
--
-- Banco novo: as tabelas estão vazias quando as migrations rodam, então isto
-- não altera nada.

UPDATE catch_photos
SET url = REGEXP_REPLACE(url, '^https?://[^/]+/uploads/', '')
WHERE url REGEXP '^https?://[^/]+/uploads/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/)?[0-9a-f]{32}[.](jpg|png|webp)$';

UPDATE users
SET avatar_url = REGEXP_REPLACE(avatar_url, '^https?://[^/]+/uploads/', '')
WHERE avatar_url REGEXP '^https?://[^/]+/uploads/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/)?[0-9a-f]{32}[.](jpg|png|webp)$';

UPDATE fish_species
SET image_url = REGEXP_REPLACE(image_url, '^https?://[^/]+/uploads/', '')
WHERE image_url REGEXP '^https?://[^/]+/uploads/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/)?[0-9a-f]{32}[.](jpg|png|webp)$';

UPDATE fish_species
SET image_thumb_url = REGEXP_REPLACE(image_thumb_url, '^https?://[^/]+/uploads/', '')
WHERE image_thumb_url REGEXP '^https?://[^/]+/uploads/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/)?[0-9a-f]{32}[.](jpg|png|webp)$';
