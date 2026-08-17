import { Injectable } from '@nestjs/common';
import { UserRole } from '../../../contexts/user/domain/value-objects/user-role.vo';
import { RoleGuard } from './role.guard';

/**
 * Exclusivo do dono (§5): configurar as janelas de funcionamento, cadastrar máquina e definir o
 * preço da hora.
 *
 * São as três decisões que mudam quanto a operação cobra e quando ela pode vender. O
 * Administrativo opera dentro delas; quem as define é quem responde pelo negócio.
 */
@Injectable()
export class OwnerGuard extends RoleGuard {
  protected readonly allowedRoles: readonly UserRole[] = ['owner'];
}
