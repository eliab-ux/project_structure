import { Injectable } from '@nestjs/common';
import { UserRole } from '../../../contexts/user/domain/value-objects/user-role.vo';
import { RoleGuard } from './role.guard';

/**
 * Área administrativa: reserva, pagamento, cadastro de cliente, equipe, financeiro.
 *
 * `owner` entra junto porque em toda linha da §5 em que o `admin` pode, o `owner` também pode. O
 * que o `admin` não pode e o `owner` sim (criar outro dono, configurar janelas, definir preço) é
 * tratado pelo `OwnerGuard` ou por regra dentro do use case.
 */
@Injectable()
export class AdminGuard extends RoleGuard {
  protected readonly allowedRoles: readonly UserRole[] = ['admin', 'owner'];
}
