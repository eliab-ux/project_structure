import { Migration } from '@mikro-orm/migrations';

/**
 * `account.timezone` — o fuso da operação sai do ambiente e vira dado da conta.
 *
 * As janelas de funcionamento são horários LOCAIS ("abre 07:00") e `starts_at` é `timestamptz`.
 * Traduzir um do outro exige saber o relógio da oficina, e o relógio do servidor não serve: em
 * produção ele roda em UTC. Até aqui o valor vinha de `DEFAULT_TIMEZONE`, o que só funciona
 * enquanto **todas** as contas estiverem no mesmo fuso — a limitação estava anotada na
 * `business-hours-policy.ts` desde a Fase 4.
 *
 * Sai do ambiente porque fuso é atributo da conta, não da instalação: duas contas no mesmo
 * container podem operar em fusos diferentes, e nesse dia uma variável de processo não teria como
 * atender as duas. Aplicar agora, com uma conta só, custa uma coluna; aplicar depois custa
 * reinterpretar toda agenda já gravada.
 *
 * `NOT NULL` com default: nada de nulidade transitória. Toda linha existente recebe
 * `America/Sao_Paulo`, que é o valor que a env já entregava — a migração não muda o
 * comportamento de nenhuma agenda existente, só muda de onde o número vem.
 */
export class Migration20260818090000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      alter table "account"
        add column "timezone" varchar(64) not null default 'America/Sao_Paulo';
    `);

    // O nome tem que ser um fuso IANA de verdade: `Intl.DateTimeFormat` lança com string inválida,
    // e um erro no meio do cálculo da agenda seria diagnosticado como bug da agenda, não como
    // cadastro errado. O CHECK só garante o FORMATO (`Região/Cidade`); a existência do fuso é
    // validada no domínio, onde o `Intl` está disponível.
    this.addSql(`
      alter table "account"
        add constraint "account_timezone_format_check"
        check ("timezone" ~ '^[A-Za-z]+/[A-Za-z_+-]+(/[A-Za-z_+-]+)?$');
    `);
  }

  async down(): Promise<void> {
    this.addSql(`alter table "account" drop constraint if exists "account_timezone_format_check";`);
    this.addSql(`alter table "account" drop column if exists "timezone";`);
  }
}
