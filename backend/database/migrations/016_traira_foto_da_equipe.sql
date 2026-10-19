-- Correção de dado: a Traíra passa a usar foto da própria equipe.
--
-- O arquivo continua o mesmo caminho (/assets/species/traira.webp), só que
-- agora com a foto da equipe; o crédito no banco é que precisa mudar — o seed
-- nunca sobrescreve valor preenchido (COALESCE no upsert), então nos bancos já
-- populados a foto nova apareceria com o crédito antigo (Vassil, CC0, do
-- Wikimedia Commons). Mesma lógica da 010: roda uma vez em cada banco.
--
-- O WHERE só troca se a espécie ainda usa a foto do repositório com o crédito
-- antigo: se um admin já trocou a foto pelo app, a escolha dele fica.
--
-- Banco novo: a tabela está vazia quando as migrations rodam; o seed (já
-- atualizado em species-images.js) insere a Traíra com o crédito certo.

UPDATE fish_species
SET image_credit = 'Equipe Tamba',
    image_license = 'Todos os direitos reservados',
    image_source_url = NULL
WHERE name = 'Traíra'
  AND image_url = '/assets/species/traira.webp'
  AND image_credit = 'Vassil';
