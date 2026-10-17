-- Local da pescaria digitado à mão, direto na captura.
--
-- Até o Google Places entrar, o usuário só escreve o nome do lugar ("Pesqueiro
-- do Zé", "Represa de Salto"). Guardar isso como texto na própria captura evita
-- encher `fishing_spots` de linha órfã a cada erro de digitação — a tabela
-- continua reservada para o pesqueiro "de verdade", com google_place_id.
--
-- As duas colunas convivem: `spot_id` aponta para o catálogo quando existe,
-- `spot_name` é o que o usuário escreveu. A tela mostra o que estiver preenchido.
ALTER TABLE catches
  ADD COLUMN spot_name VARCHAR(180) NULL AFTER spot_id;
