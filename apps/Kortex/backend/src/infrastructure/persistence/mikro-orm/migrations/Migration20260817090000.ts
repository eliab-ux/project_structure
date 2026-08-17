import { Migration } from '@mikro-orm/migrations';

/**
 * `fabric.layer_thickness_cm` — a espessura de UMA camada.
 *
 * Corrige um erro dimensional que estava na spec e virou código: o aviso comparava `layers` (uma
 * contagem) com `max_layer_height_cm` (centímetros), então disparava em praticamente todo corte —
 * e aviso que sempre aparece é aviso que ninguém lê.
 *
 * A comparação certa é `layers × layer_thickness_cm > max_layer_height_cm`. As duas colunas
 * coexistem porque descrevem coisas diferentes: a **altura máxima** é a restrição física da mesa e
 * do tecido; a **espessura por camada** é a propriedade do material. O número de camadas é
 * consequência das duas, não substituto de nenhuma.
 *
 * **Nullable, e continua nullable.** Enquanto o tecido não tiver espessura cadastrada, o sistema
 * **não avisa nada** — silêncio é melhor que ruído. Diferente do caso do telefone (CLAUDE.md,
 * regra 9), aqui a nulidade não é transitória: é o estado legítimo de um cadastro que ainda não foi
 * medido, e forçar um valor obrigatório faria o operador inventar um número que depois vira aviso
 * falso.
 */
export class Migration20260817090000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      alter table "fabric"
        add column "layer_thickness_cm" numeric(6,3) null;
    `);

    // Espessura de camada é sempre positiva quando informada — zero faria a comparação nunca
    // disparar, o que é indistinguível de "não cadastrado" mas sem o silêncio honesto do nulo.
    this.addSql(`
      alter table "fabric"
        add constraint "fabric_layer_thickness_positive_check"
        check ("layer_thickness_cm" is null or "layer_thickness_cm" > 0);
    `);
  }

  async down(): Promise<void> {
    this.addSql(`
      alter table "fabric" drop constraint if exists "fabric_layer_thickness_positive_check";
    `);
    this.addSql(`alter table "fabric" drop column if exists "layer_thickness_cm";`);
  }
}
