-- RGN-15 no próprio banco: usuário não pode seguir a si mesmo.
--
-- Seria um CHECK (follower_id <> following_id), mas o MySQL proíbe CHECK em
-- coluna com FK ON DELETE CASCADE (erro 3823). Trigger com SIGNAL faz o mesmo
-- papel. O de UPDATE fecha a brecha de alterar uma linha existente para
-- apontar para si mesmo.
--
-- Arquivo separado da 006 de propósito: com binary log ligado (padrão do
-- MySQL 8), criar trigger exige SUPER ou log_bin_trust_function_creators = 1
-- (erro 1419). Isolado aqui, se faltar permissão o migrate falha logo no
-- primeiro comando, sem deixar nada aplicado pela metade.

CREATE TRIGGER trg_follows_no_self_insert
BEFORE INSERT ON follows
FOR EACH ROW
BEGIN
  IF NEW.follower_id = NEW.following_id THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RGN-15: usuário não pode seguir a si mesmo';
  END IF;
END;

CREATE TRIGGER trg_follows_no_self_update
BEFORE UPDATE ON follows
FOR EACH ROW
BEGIN
  IF NEW.follower_id = NEW.following_id THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RGN-15: usuário não pode seguir a si mesmo';
  END IF;
END;
