import { Injectable } from '@nestjs/common';
import { UserRole } from '../../../contexts/user/domain/value-objects/user-role.vo';
import { RoleGuard } from './role.guard';

/**
 * Chão de fábrica: apontar matriz (start/stop), criar pré-pedido, ler a fila do dia.
 *
 * `owner` entra e `admin` **não**. Sai direto da §5: "Start / corte / stop de matriz" é
 * modelista ✅, admin ❌, owner ✅. A ausência do `admin` é a segregação de função em si — se o
 * Administrativo pudesse apontar corte, ele fecharia sozinho o ciclo de vender e executar, que é
 * exatamente o que o dono declarou querer evitar.
 *
 * Nenhuma rota da Fase 1 usa este guard; ele existe porque as três superfícies de papel precisam
 * estar de pé e testadas antes de a Fase 3 encostar nelas.
 */
@Injectable()
export class ModelistaGuard extends RoleGuard {
  protected readonly allowedRoles: readonly UserRole[] = ['modelista', 'owner'];
}
