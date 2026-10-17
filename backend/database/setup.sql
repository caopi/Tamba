-- Preparação do MySQL para o Tamba. Rode UMA vez por máquina, como root:
--
--   mysql -u root -p < backend/database/setup.sql
--
-- (ou abra no MySQL Workbench conectado como root e execute tudo).
-- Depois disso o projeto só usa o usuário `tamba`, configurado no .env —
-- a senha do root nunca vai para o .env.
--
-- Pode rodar de novo sem quebrar nada: tudo aqui é IF NOT EXISTS ou idempotente.
-- Antes de rodar, troque a senha abaixo e use a mesma no DATABASE_URL do .env.

CREATE DATABASE IF NOT EXISTS tamba
  CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE USER IF NOT EXISTS 'tamba'@'localhost' IDENTIFIED BY 'troque-essa-senha';

GRANT ALL PRIVILEGES ON tamba.* TO 'tamba'@'localhost';

-- Necessário para os triggers da migration 007_follows_no_self_trigger.sql.
-- O MySQL 8 vem com binary log ligado por padrão, e nesse modo só quem tem
-- SUPER pode criar trigger — a menos que esta variável esteja em 1 (sem ela,
-- o `npm run migrate` falha com o erro 1419). PERSIST grava a configuração
-- em mysqld-auto.cnf, então ela sobrevive a reinício do servidor.
SET PERSIST log_bin_trust_function_creators = 1;
