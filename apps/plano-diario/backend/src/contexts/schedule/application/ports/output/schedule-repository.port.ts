import { Schedule } from '../../../domain/entities/schedule.entity';

export const SCHEDULE_REPOSITORY = Symbol('SCHEDULE_REPOSITORY');

export interface ScheduleRepositoryPort {
  save(schedule: Schedule): Promise<Schedule>;
  findByUserId(userId: string): Promise<Schedule | null>;
  findById(id: string): Promise<Schedule | null>;
  /** Usado pelo tick do scheduler a cada minuto — só os ativos. */
  findAllActive(): Promise<Schedule[]>;
}
