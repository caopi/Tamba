-- Ordem do feed vira preferência do usuário (Configurações), e o padrão passa
-- a ser por engajamento (curtidas + 2 × comentários, ver catch.service).
--
-- Antes, a ordem era um seletor no topo do próprio feed, com "mais recentes"
-- de padrão. O seletor saiu do feed (com o botão Atualizar); quem prefere a
-- ordem cronológica escolhe "Mais recentes" uma vez, nas Configurações.
--
-- VARCHAR + CHECK, não ENUM: o ENUM grava o primeiro valor quando a coluna é
-- omitida (o mesmo motivo da 009). Todo mundo, inclusive quem já tem conta,
-- começa no padrão novo.

ALTER TABLE users
  ADD COLUMN feed_order VARCHAR(12) NOT NULL DEFAULT 'engagement',
  ADD CONSTRAINT chk_users_feed_order CHECK (feed_order IN ('engagement', 'recent'));
