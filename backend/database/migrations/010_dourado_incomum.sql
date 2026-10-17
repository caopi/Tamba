-- Correção de dado: o Dourado é 'incomum', não 'raro'.
--
-- O seed.js já foi corrigido, mas o seed nunca sobrescreve valor preenchido
-- (COALESCE no upsert), então nos bancos já populados o Dourado continuaria
-- 'raro'. Esta migration leva a correção a todos os bancos do grupo pelo
-- caminho normal (`npm run migrate`), uma vez em cada um.
--
-- Por que migration e não regra no seed: o seed roda sempre, e uma regra
-- "trocar raro por incomum" desfaria toda vez uma decisão futura do admin de
-- voltar o Dourado para 'raro'. A migration roda uma única vez.
--
-- O WHERE só troca se o valor ainda for o antigo do seed ('raro'): se um admin
-- já mudou a raridade para outra coisa, a escolha dele fica.
--
-- Banco novo: a tabela está vazia quando as migrations rodam, então isto não
-- altera nada, e o seed (já corrigido) insere o Dourado como 'incomum'.

UPDATE fish_species
SET rarity = 'incomum'
WHERE name = 'Dourado' AND rarity = 'raro';
