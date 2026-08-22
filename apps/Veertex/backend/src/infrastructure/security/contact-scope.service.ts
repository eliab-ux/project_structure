import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import type { AbstractSqlConnection } from '@mikro-orm/postgresql';
import { AuthTokenPayload } from '../../contexts/auth/application/ports/output/token-service.port';
import { grants, PERMISSIONS } from '../../contexts/role/domain/permissions.catalog';
import { AccountOrmEntity } from '../persistence/mikro-orm/entities/account-orm.entity';
import { CONTACT_SCOPE_GUC } from '../persistence/mikro-orm/entities/tenant-scoped-orm.entity';

/**
 * Estabelece o escopo de CARTEIRIZAÇÃO do request (§2.3 do 02), escrevendo `app.contact_scope`.
 *
 * ## Por que POR REQUEST, e não no token (ADR-0007)
 *
 * O escopo do ator NÃO viaja no JWT, ao contrário dos módulos (ADR-0001). O ADR-0001 aceitou a
 * defasagem de até 15 min porque o efeito de um módulo defasado é uma tela a menos. Aqui o efeito é
 * **contato de um vendedor visível a outro** enquanto o token velho não renova — vazamento entre
 * atores da mesma conta. Um claim também não se invalida em dois casos sem saída: admin troca o
 * `sales_rep_id` de um contato (o vendedor antigo continuaria vendo até renovar) e usuário desativado
 * (o token ainda carregaria o escopo). A leitura por request não tem nenhum dos dois problemas: o
 * `sales_rep_id` é comparado LIVE pela policy (troca vale na hora) e o escopo é recomputado a cada
 * request. Ver ADR-0007 para o contraste completo com o ADR-0001.
 *
 * ## Como resolve
 *
 * - **Sem ator** (login/rotas públicas) → escopo vazio. Essas rotas não leem contato.
 * - **Ator com `contacts.read.all`** → escopo vazio (vê tudo) — sem nem ler a preferência.
 * - **Ator sem `contacts.read.all`** → lê a preferência `contact_carteirizacao` da conta (LIVE,
 *   escopada; `app.account_id` já está setado neste ponto da transação). Ligada → escopo = `sub` do
 *   ator (vê só a própria carteira); desligada → vazio.
 *
 * Custo: uma leitura pequena e indexada por request, só para atores restritos-candidatos. Se aparecer
 * como gargalo, a saída é cache server-side invalidado no toggle da preferência — **cache se
 * invalida; token emitido, não** (ADR-0007). Não implementado até o custo aparecer.
 *
 * Falha: se `app.contact_scope` não for setado, a policy o lê como vazio = não restrito. Isso nunca
 * compromete o isolamento por CONTA (a policy de conta continua valendo); no máximo deixa de
 * restringir por ATOR — e só aconteceria numa rota fora do interceptor global, que não lê contato.
 */
@Injectable()
export class ContactScopeService {
  async establishForRequest(em: EntityManager, user: AuthTokenPayload | undefined): Promise<void> {
    const ctx = em.getTransactionContext();
    if (!ctx) {
      return;
    }
    const scope = await this.resolve(em, user);
    const connection = em.getConnection() as unknown as AbstractSqlConnection;
    await connection.execute(
      'select set_config(?, ?, true)',
      [CONTACT_SCOPE_GUC, scope],
      'run',
      ctx,
    );
  }

  private async resolve(em: EntityManager, user: AuthTokenPayload | undefined): Promise<string> {
    if (!user) {
      return '';
    }
    if (grants(user.permissions ?? [], PERMISSIONS.contacts.readAll)) {
      return '';
    }
    // Preferência lida ao vivo, já escopada por `app.account_id` (setado no início da transação).
    const account = await em.findOne(
      AccountOrmEntity,
      { id: user.accountId },
      { fields: ['id', 'contactCarteirizacao'] },
    );
    return account?.contactCarteirizacao ? user.sub : '';
  }
}
