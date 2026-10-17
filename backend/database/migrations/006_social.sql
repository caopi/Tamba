-- Parte social: favoritos, seguir, curtir, comentar, denunciar e notificações.
--
-- A captura É o post do feed: curtida, comentário e denúncia apontam direto
-- para `catches`, sem tabela de posts no meio.
--
-- Tabelas de ligação usam chave primária composta: ela já é o UNIQUE do par
-- (RGN-15) e dispensa um id que ninguém usaria.
--
-- Apagar usuário ou captura leva junto tudo que depende dela (CASCADE).

CREATE TABLE user_favorite_species (
  user_id    CHAR(36)    NOT NULL,
  species_id CHAR(36)    NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id, species_id),
  KEY idx_user_favorite_species_species (species_id),
  CONSTRAINT fk_user_favorite_species_user
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_user_favorite_species_species
    FOREIGN KEY (species_id) REFERENCES fish_species (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

-- "Não seguir a si mesmo" (RGN-15): o MySQL proíbe CHECK em coluna que tem FK
-- com ON DELETE CASCADE (erro 3823), então a regra vai em triggers logo abaixo
-- (007_follows_no_self_trigger.sql). A aplicação confere antes também, só para
-- dar mensagem amigável.
CREATE TABLE follows (
  follower_id  CHAR(36)    NOT NULL,
  following_id CHAR(36)    NOT NULL,
  created_at   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (follower_id, following_id),
  -- "Quem me segue" consulta pelo lado contrário da PK.
  KEY idx_follows_following (following_id),
  CONSTRAINT fk_follows_follower
    FOREIGN KEY (follower_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_follows_following
    FOREIGN KEY (following_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE likes (
  user_id    CHAR(36)    NOT NULL,
  catch_id   CHAR(36)    NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id, catch_id),
  -- Contar curtidas de uma captura.
  KEY idx_likes_catch (catch_id),
  CONSTRAINT fk_likes_user
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_likes_catch
    FOREIGN KEY (catch_id) REFERENCES catches (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE comments (
  id         CHAR(36)    NOT NULL,
  catch_id   CHAR(36)    NOT NULL,
  user_id    CHAR(36)    NOT NULL,
  body       TEXT        NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_comments_catch_created_at (catch_id, created_at),
  CONSTRAINT fk_comments_catch
    FOREIGN KEY (catch_id) REFERENCES catches (id) ON DELETE CASCADE,
  CONSTRAINT fk_comments_user
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

-- O UNIQUE (reporter_id, catch_id) é o que faz "denunciada por usuários
-- distintos" (RGN-14) ser só um COUNT(*): ninguém denuncia a mesma captura duas vezes.
CREATE TABLE reports (
  id          CHAR(36)                      NOT NULL,
  reporter_id CHAR(36)                      NOT NULL,
  catch_id    CHAR(36)                      NOT NULL,
  reason      VARCHAR(500)                  NOT NULL,
  status      ENUM('pendente', 'analisado') NOT NULL DEFAULT 'pendente',
  created_at  DATETIME(3)                   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_reports_reporter_catch (reporter_id, catch_id),
  KEY idx_reports_catch_status (catch_id, status),
  KEY idx_reports_status_created_at (status, created_at),
  CONSTRAINT fk_reports_reporter
    FOREIGN KEY (reporter_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_reports_catch
    FOREIGN KEY (catch_id) REFERENCES catches (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

-- `user_id` é quem recebe; `actor_id` é quem curtiu/comentou/seguiu.
-- `catch_id` é NULL para 'follow' e preenchido para 'like'/'comment'.
CREATE TABLE notifications (
  id         CHAR(36)                           NOT NULL,
  user_id    CHAR(36)                           NOT NULL,
  type       ENUM('like', 'comment', 'follow')  NOT NULL,
  actor_id   CHAR(36)                           NOT NULL,
  catch_id   CHAR(36)                           NULL,
  is_read    BOOLEAN                            NOT NULL DEFAULT FALSE,
  created_at DATETIME(3)                        NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_notifications_user_read_created_at (user_id, is_read, created_at),
  CONSTRAINT fk_notifications_user
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_notifications_actor
    FOREIGN KEY (actor_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_notifications_catch
    FOREIGN KEY (catch_id) REFERENCES catches (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;
