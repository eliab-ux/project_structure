import { randomUUID } from 'crypto';
import { MODULE_CATALOG } from '../../../contexts/module/domain/modules.catalog';
import { SqlExecutor } from '../isolation-invariants';

export interface ModuleSeedResult {
  inserted: number;
  updated: number;
}

/**
 * Reconcilia a tabela `modules` com o catálogo do código.
 *
 * Diferente do seed de planos em um ponto importante: aqui o seed **atualiza** nome, descrição,
 * dependências e `core` de módulos existentes. E a diferença não é arbitrária —
 *
 *   - um PLANO é decisão comercial, pode ser ajustado à mão para um cliente, e sobrescrever
 *     reverteria esse ajuste no deploy seguinte;
 *   - um MÓDULO é fato técnico. `dependsOn` precisa refletir o que o código realmente exige, e a
 *     tabela discordar do catálogo é a origem de uma tela que oferece uma ativação que o use case
 *     vai recusar. Aqui o código é a autoridade, e o banco é a cópia.
 *
 * Nenhum módulo é apagado: uma linha órfã é inofensiva, enquanto remover uma referenciada por
 * `account_modules` quebraria a FK — e o histórico de quem já teve o módulo tem valor.
 *
 * Roda na conexão de OWNER, no bootstrap.
 */
export async function seedModuleCatalog(query: SqlExecutor): Promise<ModuleSeedResult> {
  let inserted = 0;
  let updated = 0;

  for (const module of MODULE_CATALOG) {
    const rows = await query(
      `insert into modules (id, code, name, description, depends_on, core, created_at)
            values ($1, $2, $3, $4, $5::jsonb, $6, now())
       on conflict (code) do update
               set name = excluded.name,
                   description = excluded.description,
                   depends_on = excluded.depends_on,
                   core = excluded.core
         returning (xmax = 0) as was_inserted`,
      [
        randomUUID(),
        module.code,
        module.name,
        module.description,
        JSON.stringify(module.dependsOn),
        module.core,
      ],
    );

    // `xmax = 0` distingue INSERT de UPDATE num upsert do Postgres: numa linha recém-inserida o
    // xmax é zero. Sem isso o log diria "9 módulos" a cada boot, sem informar o que mudou.
    if (rows[0]?.was_inserted === true) {
      inserted += 1;
    } else {
      updated += 1;
    }
  }

  return { inserted, updated };
}
