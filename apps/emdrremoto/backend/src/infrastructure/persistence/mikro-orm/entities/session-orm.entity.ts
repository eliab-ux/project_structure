import { Entity, PrimaryKey, Property, Unique, Index } from '@mikro-orm/core';

/**
 * A sessão EMDR. NÃO persiste mais `paciente_socket_id`/`psicologo_socket_id` (legado):
 * o roteamento em tempo real é por rooms do Socket.IO (`session:<code>`).
 */
@Entity({ tableName: 'sessions' })
export class SessionOrmEntity {
  @PrimaryKey({ columnType: 'varchar(36)' })
  id!: string;

  @Property({ fieldName: 'session_code', length: 64 })
  @Unique()
  sessionCode!: string;

  @Property({ fieldName: 'daily_co_name', length: 128, nullable: true })
  dailyCoName?: string | null;

  @Property({ fieldName: 'psicologo_id', columnType: 'varchar(36)' })
  @Index()
  psicologoId!: string;

  @Property({ fieldName: 'paciente_id', columnType: 'varchar(36)' })
  @Index()
  pacienteId!: string;

  @Property({ fieldName: 'paciente_in', nullable: true })
  pacienteIn?: Date | null;

  @Property({ fieldName: 'psicologo_in', nullable: true })
  psicologoIn?: Date | null;

  @Property({ fieldName: 'session_out', nullable: true })
  sessionOut?: Date | null;

  @Property()
  active: boolean = true;

  @Property({ fieldName: 'created_at' })
  createdAt: Date = new Date();

  @Property({ fieldName: 'updated_at', onUpdate: () => new Date() })
  updatedAt: Date = new Date();
}
