-- Remove a coluna legada catches.photo_url.
--
-- Desde a 005 as fotos moram em catch_photos (várias por captura, a de
-- posição 0 é a capa), e photo_url só existia como espelho da capa para o
-- frontend antigo, que lia uma foto só. Com o upload (REQ-15) o frontend
-- passou a ler e gravar só `photos`, então o espelho não tem mais leitor.
--
-- Antes de apagar, uma rede de segurança: se alguma captura tiver photo_url
-- sem a linha correspondente em catch_photos (num banco que tenha recebido
-- captura por algum caminho antigo), a foto é copiada para lá como capa —
-- nenhuma foto se perde. Nos bancos que estão em dia, isto não insere nada.

INSERT INTO catch_photos (id, catch_id, url, position, created_at)
SELECT UUID(), c.id, c.photo_url, 0, c.created_at
FROM catches c
WHERE c.photo_url IS NOT NULL
  AND c.photo_url <> ''
  AND NOT EXISTS (SELECT 1 FROM catch_photos p WHERE p.catch_id = c.id);

ALTER TABLE catches DROP COLUMN photo_url;
