import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PasswordHasherPort } from '../../contexts/auth/application/ports/output/password-hasher.port';

/** Cost 12: ~250ms per hash on the target hardware — slow enough to matter, fast enough to log in. */
const SALT_ROUNDS = 12;

@Injectable()
export class BcryptPasswordHasher implements PasswordHasherPort {
  async hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, SALT_ROUNDS);
  }

  async compare(plain: string, hash: string): Promise<boolean> {
    // bcrypt.compare is constant-time for a given hash and tolerates a malformed hash by
    // returning false instead of throwing.
    return bcrypt.compare(plain, hash);
  }
}
