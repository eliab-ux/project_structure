import { Entity, Index, PrimaryKey, Property } from '@mikro-orm/core';

@Entity({ tableName: 'business_hour' })
@Index({ name: 'business_hour_account_id_weekday_index', properties: ['accountId', 'weekday'] })
export class BusinessHourOrmEntity {
  @PrimaryKey({ type: 'uuid' })
  id!: string;

  @Property({ fieldName: 'account_id', type: 'uuid' })
  accountId!: string;

  @Property({ type: 'smallint' })
  weekday!: number;

  /**
   * Colunas `time` chegam como string ('07:00:00') e é assim que ficam: converter para `Date`
   * exigiria inventar uma data para pendurar a hora, e aí o fuso entraria numa informação que não
   * tem dia nenhum. O `TimeOfDay` do domínio aceita os dois formatos.
   */
  @Property({ fieldName: 'starts_at', type: 'time' })
  startsAt!: string;

  @Property({ fieldName: 'ends_at', type: 'time' })
  endsAt!: string;

  @Property({ fieldName: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Property({ fieldName: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
