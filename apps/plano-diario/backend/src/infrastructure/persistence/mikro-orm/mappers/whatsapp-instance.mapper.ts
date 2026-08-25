import { Inject, Injectable } from '@nestjs/common';
import { WhatsappInstance } from '../../../../contexts/whatsapp/domain/entities/whatsapp-instance.entity';
import { ConnectionStatus } from '../../../../contexts/whatsapp/domain/value-objects/connection-status.vo';
import { InstanceName } from '../../../../contexts/whatsapp/domain/value-objects/instance-name.vo';
import { TOKEN_CRYPTO, TokenCryptoPort } from '../../../security/ports/token-crypto.port';
import { WhatsappInstanceOrmEntity } from '../entities/whatsapp-instance-orm.entity';

/**
 * O mapper é onde a criptografia acontece: o domínio trabalha com o token em claro em memória,
 * e o banco só vê o ciphertext. Concentrar isso aqui garante que nenhum caminho de persistência
 * consiga gravar o token em claro por esquecimento.
 */
@Injectable()
export class WhatsappInstanceMapper {
  constructor(@Inject(TOKEN_CRYPTO) private readonly crypto: TokenCryptoPort) {}

  toDomain(orm: WhatsappInstanceOrmEntity): WhatsappInstance {
    return WhatsappInstance.reconstitute({
      id: orm.id,
      userId: orm.userId,
      instanceName: InstanceName.from(orm.instanceName),
      token: this.crypto.decrypt(orm.instanceToken),
      status: ConnectionStatus.from(orm.status),
      connectedNumber: orm.connectedNumber ?? null,
      lastStatusAt: orm.lastStatusAt,
      createdAt: orm.createdAt,
      updatedAt: orm.updatedAt,
    });
  }

  toOrm(domain: WhatsappInstance, existing?: WhatsappInstanceOrmEntity): WhatsappInstanceOrmEntity {
    const orm = existing ?? new WhatsappInstanceOrmEntity();
    orm.id = domain.id;
    orm.userId = domain.userId;
    orm.instanceName = domain.instanceName.value;
    orm.instanceToken = this.crypto.encrypt(domain.token);
    orm.status = domain.status.value;
    orm.connectedNumber = domain.connectedNumber;
    orm.lastStatusAt = domain.lastStatusAt;
    orm.createdAt = domain.createdAt;
    orm.updatedAt = domain.updatedAt;
    return orm;
  }
}
