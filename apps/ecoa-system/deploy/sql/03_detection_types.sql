-- ─────────────────────────────────────────────────────────────────────────────
-- 03 — Realinha `detection.detection_type` com o que a API da Meta realmente entrega
--
-- Motivo: os valores antigos prometiam um sinal que não existe. A doc oficial diz
-- "Mentions on Stories are not supported" na Instagram API with Facebook Login —
-- o campo de webhook `mentions` é menção em LEGENDA ou COMENTÁRIO, e `/tags` é
-- marcação. Story reshare só existe pela Messaging API, que é outro produto.
--
--   story_mention  → caption_mention   (era o campo `mentions`, nunca foi story)
--   mention        → caption_mention   (valor genérico do fallback antigo)
--   tag            → tag               (inalterado)
--
-- Idempotente: rodar de novo não muda nada, pois os valores antigos já não existem.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

UPDATE detection SET detection_type = 'caption_mention'
 WHERE detection_type IN ('story_mention', 'mention');

-- Sobra alguma linha fora do domínio novo? Aborta em vez de deixar dado inválido:
-- o DetectionType.from() do domínio lança em valor desconhecido.
DO $$
DECLARE invalid_count integer;
BEGIN
  SELECT count(*) INTO invalid_count
    FROM detection
   WHERE detection_type NOT IN ('caption_mention', 'comment_mention', 'tag');
  IF invalid_count > 0 THEN
    RAISE EXCEPTION 'detection_type inválido em % linha(s) — revise antes de prosseguir', invalid_count;
  END IF;
END $$;

COMMIT;
