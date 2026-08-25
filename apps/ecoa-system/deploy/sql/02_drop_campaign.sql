-- ─────────────────────────────────────────────────────────────────────────────
-- 02 — Remove o recurso "Campanhas" do ECOA
--
-- Motivo: a tela de Campanhas não é usada e foi retirada do produto. Ela também
-- ampliava a superfície do app apresentada no App Review da Meta sem entregar
-- nada ao usuário.
--
-- Idempotente: pode rodar mais de uma vez sem erro.
--
-- ⚠️ DESTRUTIVO: apaga a tabela `campaign` e o vínculo de cada mídia com ela.
-- As mídias e as métricas NÃO são afetadas — só o agrupamento se perde.
-- Faça backup antes de rodar em produção.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- A FK own_media.campaign_id → campaign(id) cai junto com a coluna.
ALTER TABLE own_media DROP COLUMN IF EXISTS campaign_id;

DROP TABLE IF EXISTS campaign;

COMMIT;
