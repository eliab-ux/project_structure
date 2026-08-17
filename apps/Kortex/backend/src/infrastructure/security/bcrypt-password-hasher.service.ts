import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PasswordHasherPort } from '../../contexts/user/application/ports/output/password-hasher.port';

/**
 * 12 rounds: hoje custa cerca de 250 ms por hash numa máquina comum. É lento de propósito — é o
 * que torna um vazamento de banco caro de explorar em massa. Subir demais atrasaria o login de
 * quem está de pé ao lado da máquina esperando entrar.
 */
const SALT_ROUNDS = 12;

@Injectable()
export class BcryptPasswordHasher implements PasswordHasherPort {
  async hash(plainPassword: string): Promise<string> {
    return bcrypt.hash(plainPassword, SALT_ROUNDS);
  }

  async compare(plainPassword: string, hash: string): Promise<boolean> {
    // `bcrypt.compare` é de tempo constante para o mesmo custo — nunca comparar hash com `===`.
    return bcrypt.compare(plainPassword, hash);
  }
}
