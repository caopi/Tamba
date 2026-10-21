-- Pesqueiros: chave única (name, location), is_active e fim dos pesqueiros de
-- exemplo.
--
-- Chave em (name, location), não só no nome: dois pesqueiros de cidades
-- diferentes podem ter o mesmo nome. Com ela o seed faz upsert, como o das
-- espécies, em vez de só inserir com a tabela vazia. A collation da tabela
-- (utf8mb4_0900_ai_ci) ignora caixa e acento: "Pesqueiro do Renato" e
-- "Pesqueiro Do Renato" na mesma cidade são o mesmo.
--
-- `is_active`: pesqueiro fecha, e as capturas continuam apontando para ele;
-- esconder é desativar, não apagar. Por enquanto é só a coluna: nada lê nem
-- grava ainda.
--
-- Os três pesqueiros de exemplo do seed antigo saem. Os ids são aleatórios em
-- cada banco, então vão pelo (name, location). A FK fk_catches_spot (SET NULL,
-- da 001) solta as capturas ligadas a eles; a região delas já foi copiada ao
-- salvar (catches.region) e fica. O nome do pesqueiro sumiria (spot_name é
-- NULL quando se escolhe do catálogo), então antes ele é copiado para
-- spot_name: a captura continua mostrando o mesmo lugar, e o autor pode editar.
-- `updated_at = updated_at` evita o ON UPDATE: a captura não foi editada por
-- ninguém.
--
-- Banco novo: a tabela está vazia aqui, nada é apagado, e o seed insere os
-- pesqueiros reais.

UPDATE catches c
INNER JOIN fishing_spots s ON s.id = c.spot_id
SET c.spot_name = s.name,
    c.updated_at = c.updated_at
WHERE c.spot_name IS NULL
  AND (s.name, s.location) IN (
    ('Pesqueiro Modelo', 'São Paulo, SP'),
    ('Rio Tietê - Trecho', 'Salto, SP'),
    ('Represa de Exemplo', 'Avaré, SP')
  );

DELETE FROM fishing_spots
WHERE (name, location) IN (
  ('Pesqueiro Modelo', 'São Paulo, SP'),
  ('Rio Tietê - Trecho', 'Salto, SP'),
  ('Represa de Exemplo', 'Avaré, SP')
);

ALTER TABLE fishing_spots
  ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD UNIQUE KEY uq_fishing_spots_name_location (name, location);
