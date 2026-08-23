import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { ContactGeoPort } from '../../../../contexts/route/application/ports/output/contact-geo.port';
import { ContactAddressOrmEntity } from '../entities/contact-address-orm.entity';

/**
 * Adapter do `ContactGeoPort` — escreve as coordenadas do GPS do pedido no endereço do contato
 * (endereço `main` primeiro; sem `main`, o primeiro cadastrado). Contato sem endereço não recebe
 * coordenada: não há onde ancorá-la, e inventar um endereço vazio seria pior que não propagar.
 *
 * Escopado pelo tenant (filtro global + RLS) — contactId de outra conta não encontra linha.
 */
@Injectable()
export class MikroOrmContactGeo implements ContactGeoPort {
  constructor(private readonly em: EntityManager) {}

  async applyOrderGps(params: {
    contactId: string;
    latitude: number;
    longitude: number;
    overwrite: boolean;
  }): Promise<void> {
    const rows = await this.em.find(ContactAddressOrmEntity, { contact: params.contactId });
    if (rows.length === 0) {
      return;
    }
    const target = rows.find((row) => row.purpose === 'main') ?? rows[0];
    if (!params.overwrite && target.latitude !== null) {
      return;
    }
    target.latitude = params.latitude.toFixed(7);
    target.longitude = params.longitude.toFixed(7);
    await this.em.flush();
  }
}
