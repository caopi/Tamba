-- Perfil, ativação por e-mail e papéis (RGN-01/02/03/04).
--
-- `nickname` entra NULL, é preenchido para as contas que já existem e só depois
-- vira NOT NULL + UNIQUE — senão o ALTER falharia com usuários já cadastrados.
-- O UNIQUE herda a collation da tabela (_ai_ci), então "Lucas" e "lucas" colidem.
--
-- `is_active` nasce FALSE para contas novas (só ativa após confirmar o e-mail),
-- mas as contas que já existem são ativadas aqui: elas foram criadas antes de
-- existir confirmação, e deixá-las FALSE trancaria todo mundo fora (RGN-04).
--
-- Por isso, no banco, contas antigas aparecem com is_active = TRUE e
-- email_verification_token NULL sem nunca terem confirmado nada: não é bug, é
-- este backfill. Toda conta criada depois desta migration passa pela confirmação.
--
-- O link de confirmação vale 24h (`email_verification_expires_at`); depois disso
-- o usuário pede outro, e o token antigo é sobrescrito.
--
-- `measurement_unit` é só preferência de exibição: o banco continua gravando
-- peso sempre em kg.

ALTER TABLE users
  ADD COLUMN nickname                      VARCHAR(30)           NULL AFTER name,
  ADD COLUMN avatar_url                    TEXT                  NULL AFTER nickname,
  ADD COLUMN is_active                     BOOLEAN               NOT NULL DEFAULT FALSE,
  ADD COLUMN email_verification_token      VARCHAR(64)           NULL,
  ADD COLUMN email_verification_expires_at DATETIME(3)           NULL,
  ADD COLUMN role                          ENUM('user', 'admin') NOT NULL DEFAULT 'user',
  ADD COLUMN measurement_unit              ENUM('kg', 'lb')      NOT NULL DEFAULT 'kg',
  ADD COLUMN share_exact_location          BOOLEAN               NOT NULL DEFAULT FALSE;

-- Apelido provisório para as contas antigas, derivado do id (único por definição).
UPDATE users
SET nickname  = CONCAT('pescador_', LEFT(REPLACE(id, '-', ''), 12)),
    is_active = TRUE;

ALTER TABLE users
  MODIFY COLUMN nickname VARCHAR(30) NOT NULL,
  ADD UNIQUE KEY uk_users_nickname (nickname),
  -- A confirmação busca a conta pelo token, então ele precisa de índice.
  ADD UNIQUE KEY uk_users_email_verification_token (email_verification_token);
