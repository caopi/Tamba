-- Raridade passa a ser obrigatória no banco (REQ-12: faz parte da definição da
-- espécie; RGN-11: quem define é o admin).
--
-- A 004 criou `rarity` NULL-ável e sem DEFAULT para o seed conseguir
-- preenchê-la com COALESCE. Agora que o seed preencheu as 34 espécies, a
-- coluna vira NOT NULL, sem DEFAULT declarado: o banco recusa NULL explícito.
--
-- Atenção a um detalhe do MySQL: ENUM NOT NULL sem DEFAULT ganha como default
-- IMPLÍCITO o primeiro valor da lista, mesmo em modo estrito. Um INSERT que
-- simplesmente omita `rarity` grava 'comum'. Pela API isso não acontece — a
-- rota de admin exige `rarity` (species.service) —, só por SQL escrito à mão.
--
-- Numa máquina nova a tabela ainda está vazia, então esta migration passa
-- direto e o seed (que sempre manda a raridade) roda depois sem problema.
-- Só um banco que já tinha espécies antes da 004 precisa rodar o seed antes
-- desta: se sobrar alguma espécie com rarity NULL, o ALTER falha com
-- "Invalid use of NULL value" sem alterar nada — rode `npm run seed` e depois
-- `npm run migrate` de novo.

ALTER TABLE fish_species
  MODIFY COLUMN rarity ENUM('comum', 'incomum', 'raro', 'muito_raro') NOT NULL;
