-- Preferências de notificação do usuário (UC007, REQ-39/40): receber ou não
-- avisos de curtida, comentário e novo seguidor.
--
-- Ligadas por padrão, inclusive para quem já tem conta. A preferência é
-- respeitada no único lugar que cria notificação (notification.model.create):
-- com o tipo desligado, a notificação simplesmente não é gravada.

ALTER TABLE users
  ADD COLUMN notify_likes    BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN notify_comments BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN notify_follows  BOOLEAN NOT NULL DEFAULT TRUE;
