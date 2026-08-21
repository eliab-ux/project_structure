/**
 * Estima `fabric.layer_thickness_cm` a partir do histórico de cortes.
 *
 *   npm run seed:layer-thickness -w apps/Kortex/backend -- --account <uuid> [--min-cuts 5] [--apply]
 *
 * **Roda em modo simulação por padrão.** Sem `--apply` ele só imprime o que faria — porque o número
 * que este script grava passa a governar um aviso que o Modelista vai ler em toda matriz, e um
 * palpite ruim aplicado em silêncio é pior que a ausência que ele veio corrigir.
 *
 * ## De onde vem a estimativa
 *
 * O sistema não mede espessura. O que ele tem é o que a operação **de fato faz**: quantas camadas
 * o Modelista empilha naquele tecido, corte após corte. Se a operação trabalha no limite da mesa —
 * e trabalha, porque camada a menos é tempo de máquina desperdiçado —, então
 *
 *     espessura ≈ altura_máxima ÷ camadas_típicas
 *
 * `camadas_típicas` é o **percentil 90** das camadas apontadas, não a média nem o máximo:
 *
 * - a **média** é puxada para baixo por todo lote pequeno, e produziria espessura alta demais —
 *   o aviso passaria a disparar cedo, que é exatamente o ruído de antes com outra fórmula;
 * - o **máximo** é uma única matriz onde alguém forçou o enfesto, e produziria espessura baixa
 *   demais — o aviso nunca dispararia, e o campo viraria decoração.
 *
 * O p90 é o enfesto alto que a operação repete. Fica um pouco conservador de propósito: erra para
 * o lado de avisar cedo, não de calar.
 *
 * ## Limites, declarados
 *
 * Isto é **estimativa a partir de comportamento**, não medição. Vale como ponto de partida para o
 * cadastro sair do zero; assim que alguém medir o tecido com paquímetro, o valor medido substitui
 * este sem cerimônia. Tecido com menos de `--min-cuts` cortes é **pulado** — amostra pequena não
 * sustenta percentil, e um número frágil aqui vira aviso falso lá.
 *
 * Tecido que já tem espessura cadastrada **nunca** é sobrescrito: o script só preenche vazio.
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { MikroORM, RequestContext } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { AppModule } from '../src/app.module';
import {
  FABRIC_REPOSITORY,
  FabricRepositoryPort,
} from '../src/contexts/catalog/application/ports/output/catalog-repository.port';
import { AccountId } from '../src/contexts/account/domain/value-objects/account-id.vo';

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

interface HistoryRow {
  fabric_id: string;
  samples: number;
  p90_layers: number;
}

async function main(): Promise<void> {
  const logger = new Logger('seed-layer-thickness');

  const accountId = arg('account');
  if (!accountId) {
    throw new Error('Argumento --account <uuid> é obrigatório.');
  }
  const minCuts = Number(arg('min-cuts') ?? 5);
  const apply = process.argv.includes('--apply');

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const orm = app.get(MikroORM);
  const fabrics = app.get<FabricRepositoryPort>(FABRIC_REPOSITORY);
  const em = app.get(EntityManager);

  try {
    await RequestContext.create(orm.em, async () => {
      // Percentil no banco, com `account_id = ?` inline — mesma regra de toda consulta do projeto.
      const result = await em.getKnex().raw(
        `select
           fabric_id                                                        as fabric_id,
           count(*)::int                                                    as samples,
           percentile_cont(0.9) within group (order by layers)              as p90_layers
         from "cut"
         where account_id = ?
           and ended_at is not null
           and layers > 0
         group by fabric_id`,
        [accountId],
      );

      const history = new Map<string, HistoryRow>(
        (result.rows ?? []).map((row: HistoryRow) => [String(row.fabric_id), row]),
      );

      const todos = await fabrics.listByAccount(AccountId.from(accountId));
      let atualizados = 0;

      for (const fabric of todos) {
        if (fabric.layerThicknessCm !== null) {
          logger.log(`— ${fabric.name}: já tem espessura cadastrada, não toco.`);
          continue;
        }

        const row = history.get(fabric.id.value);
        const samples = Number(row?.samples ?? 0);
        if (!row || samples < minCuts) {
          logger.log(`— ${fabric.name}: ${samples} corte(s), abaixo de ${minCuts}. Fica sem.`);
          continue;
        }

        const p90 = Number(row.p90_layers);
        // Três casas: a precisão da coluna. Abaixo disso a divisão vira ruído.
        const espessura = Math.round((fabric.maxLayerHeightCm / p90) * 1000) / 1000;
        if (!Number.isFinite(espessura) || espessura <= 0) {
          logger.warn(`— ${fabric.name}: p90 = ${p90} não produz espessura válida. Fica sem.`);
          continue;
        }

        logger.log(
          `→ ${fabric.name}: ${samples} cortes, p90 = ${p90.toFixed(1)} camadas, ` +
            `${fabric.maxLayerHeightCm} cm ÷ ${p90.toFixed(1)} = ${espessura} cm/camada`,
        );

        if (apply) {
          fabric.update({
            name: fabric.name,
            maxLayerHeightCm: fabric.maxLayerHeightCm,
            layerThicknessCm: espessura,
            notes: fabric.notes,
          });
          await fabrics.save(fabric);
          atualizados += 1;
        }
      }

      if (apply) {
        logger.log(`\n${atualizados} tecido(s) atualizado(s).`);
      } else {
        logger.log('\nSimulação — nada foi gravado. Rode de novo com --apply para aplicar.');
      }
    });
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
