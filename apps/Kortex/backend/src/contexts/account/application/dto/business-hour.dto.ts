import { BusinessHour } from '../../domain/entities/business-hour.entity';

export class BusinessHourDto {
  id!: string;
  weekday!: number;
  startsAt!: string;
  endsAt!: string;
  durationMinutes!: number;

  static fromDomain(businessHour: BusinessHour): BusinessHourDto {
    const dto = new BusinessHourDto();
    dto.id = businessHour.id.value;
    dto.weekday = businessHour.weekday;
    dto.startsAt = businessHour.startsAt.value;
    dto.endsAt = businessHour.endsAt.value;
    // Calculado aqui e não na tela: "horas úteis do dia" aparece na Configuração e vai ser a base
    // do "dia inteiro" da regra 2.11. Dois cálculos da mesma coisa divergem no primeiro ajuste.
    dto.durationMinutes = businessHour.durationMinutes;
    return dto;
  }
}
