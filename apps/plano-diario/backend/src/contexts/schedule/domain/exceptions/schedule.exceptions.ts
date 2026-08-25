import { DomainException } from '@gitspread/domain-primitives';

export class ScheduleNotFoundException extends DomainException {
  constructor() {
    super('Nenhum agendamento configurado');
  }
}

export class InvalidPlanStartDateException extends DomainException {
  constructor() {
    super('Data de início do plano inválida (use o formato AAAA-MM-DD)');
  }
}
