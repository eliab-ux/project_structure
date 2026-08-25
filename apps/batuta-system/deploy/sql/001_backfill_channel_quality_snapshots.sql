-- =============================================================================================
-- Backfill dos snapshots de qualidade de canal: delivered / failed / inbound / opt_out
-- =============================================================================================
--
-- POR QUE ESTE SCRIPT EXISTE
--
-- `channel_quality_snapshots` guardava `delivered_count = 0` em toda linha, porque o signal source
-- devolvia esse valor fixo (as quatro métricas de resultado esperavam a FASE 7/8 e ficaram para trás).
-- Com `sent_count` real e `delivered_count` zerado, o painel de saúde — que lê o snapshot direto —
-- calcula 0% de entrega e classifica o canal como AT_RISK: "perfil de número sendo bloqueado".
--
-- O código já foi corrigido: o throttle agora recalcula as quatro métricas das tabelas de origem a
-- cada avaliação, então ELE se cura sozinho, sem depender deste script. Quem continua errado é o
-- HISTÓRICO gravado — os snapshots já fechados, que o painel usa para a janela e para o gráfico de
-- decisões. Este script reescreve esse histórico a partir das tabelas de origem.
--
-- IDEMPOTENTE: pode rodar quantas vezes quiser. Recalcula sempre do zero a partir de `dispatches`,
-- `messages` e `contacts`; não acumula e não depende do valor anterior.
--
-- NÃO ALTERA SCHEMA. Só UPDATE de quatro colunas de contagem.
--
-- COMO RODAR (terminal do container do backend no Dokploy):
--   psql "$DATABASE_URL" -f deploy/sql/001_backfill_channel_quality_snapshots.sql
--
-- Se preferir conferir antes de gravar, rode a CTE `recomputed` como SELECT (está isolada de
-- propósito) e compare com o que está gravado.
--
-- LIMITE HONESTO DO BACKFILL: só pode contar o que sobrou nas tabelas de origem. Se `dispatches` ou
-- `messages` já sofreram expurgo (§4 prevê que essas duas crescem e podem ser particionadas), o dia
-- expurgado volta com contagem menor que a real. Preferimos isso a manter o zero: subestimar entrega
-- de um dia antigo mexe na média da janela, mas o zero cravado é o que dispara alarme falso.
--
-- BUCKETIZAÇÃO: por dia LOCAL da conta (`accounts.timezone`), a mesma chave que
-- `channel_daily_counters` usa (o `sent_count` vem de `localDateKey(now, account.timezone)` no
-- momento do envio). Bucketizar o numerador em UTC e o denominador em São Paulo desalinharia todo
-- envio perto da meia-noite.
--
-- ACK QUE CONTA COMO ENTREGUE: espelha `DELIVERED_ACK_STATUSES` em
-- src/contexts/distribution/domain/value-objects/delivery-ack.vo.ts. Mudou lá, mude aqui.
-- `SERVER_ACK` NÃO conta: significa apenas que o servidor do WhatsApp aceitou a mensagem, que é
-- exatamente o que continua acontecendo quando o destinatário bloqueou o remetente.
-- =============================================================================================

begin;

with acct as (
  select id as account_id, timezone as tz
    from accounts
),
-- Entregas e falhas por dia local, a partir de dispatches.
-- `coalesce(sent_at, scheduled_at)`: markFailed nunca preenche sent_at, então uma falha
-- bucketizada só por sent_at desapareceria do dia em que aconteceu.
dispatch_totals as (
  select d.account_id,
         d.channel_id,
         to_char(coalesce(d.sent_at, d.scheduled_at) at time zone acct.tz, 'YYYY-MM-DD') as date,
         count(*) filter (
           where d.status = 'SENT'
             and upper(btrim(coalesce(d.delivery_status, ''))) in
                 ('DELIVERY_ACK', 'DELIVERED', 'READ', 'READ_ACK', 'PLAYED', '2', '3', '4')
         ) as delivered_count,
         count(*) filter (where d.status = 'FAILED') as failed_count
    from dispatches d
    join acct on acct.account_id = d.account_id
   where d.channel_id is not null
     and coalesce(d.sent_at, d.scheduled_at) is not null
   group by 1, 2, 3
),
inbound_totals as (
  select m.account_id,
         m.channel_id,
         to_char(m.occurred_at at time zone acct.tz, 'YYYY-MM-DD') as date,
         count(*) as inbound_count
    from messages m
    join acct on acct.account_id = m.account_id
   where m.direction = 'INBOUND'
   group by 1, 2, 3
),
-- Atribuído ao canal ATUAL do contato — o único vínculo que o schema guarda entre um opt-out e um
-- chip. Uma re-hospedagem (§6.4) move opt-outs antigos para o chip novo; aceito, porque a
-- alternativa exigiria a mensagem que disparou o opt-out, e opt-out também pode vir de ação do
-- operador, sem mensagem nenhuma.
opt_out_totals as (
  select c.account_id,
         c.current_channel_id as channel_id,
         to_char(c.opted_out_at at time zone acct.tz, 'YYYY-MM-DD') as date,
         count(*) as opt_out_count
    from contacts c
    join acct on acct.account_id = c.account_id
   where c.opted_out_at is not null
   group by 1, 2, 3
),
recomputed as (
  select s.id,
         coalesce(dt.delivered_count, 0) as delivered_count,
         coalesce(dt.failed_count, 0)    as failed_count,
         coalesce(it.inbound_count, 0)   as inbound_count,
         coalesce(ot.opt_out_count, 0)   as opt_out_count
    from channel_quality_snapshots s
    left join dispatch_totals dt
           on dt.account_id = s.account_id and dt.channel_id = s.channel_id and dt.date = s.date
    left join inbound_totals it
           on it.account_id = s.account_id and it.channel_id = s.channel_id and it.date = s.date
    left join opt_out_totals ot
           on ot.account_id = s.account_id and ot.channel_id = s.channel_id and ot.date = s.date
)
update channel_quality_snapshots s
   set delivered_count = r.delivered_count,
       failed_count    = r.failed_count,
       inbound_count   = r.inbound_count,
       opt_out_count   = r.opt_out_count
  from recomputed r
 where r.id = s.id
   -- Só escreve o que realmente muda: mantém o UPDATE barato e deixa o resultado (linhas afetadas)
   -- significando "quantos dias estavam errados", que é a informação útil ao rodar.
   and (s.delivered_count, s.failed_count, s.inbound_count, s.opt_out_count)
       is distinct from
       (r.delivered_count, r.failed_count, r.inbound_count, r.opt_out_count);

commit;

-- Conferência pós-execução: dias com envio e entrega zerada. Depois do backfill, o que sobrar aqui
-- é entrega genuinamente não confirmada — ou seja, ack que nunca chegou (webhook do Evolution) e não
-- contador esquecido. Um canal com muitas linhas aqui é caso para o botão "Webhook" na tela de Canais.
select c.label,
       s.date,
       s.sent_count,
       s.delivered_count,
       s.decision
  from channel_quality_snapshots s
  join channels c on c.id = s.channel_id
 where s.sent_count > 0
   and s.delivered_count = 0
 order by s.date desc, c.label;
