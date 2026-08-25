import { Inject, Injectable, Logger } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { GroupNotFoundException } from '../../../../whatsapp/domain/exceptions/group-not-found.exception';
import { Schedule } from '../../../domain/entities/schedule.entity';
import { MessageTemplate } from '../../../domain/value-objects/message-template.vo';
import { SendTime } from '../../../domain/value-objects/send-time.vo';
import { Timezone } from '../../../domain/value-objects/timezone.vo';
import { ScheduleDto } from '../../dto/schedule.dto';
import { GROUP_DIRECTORY, GroupDirectoryPort } from '../../ports/output/group-directory.port';
import {
  SCHEDULE_REPOSITORY,
  ScheduleRepositoryPort,
} from '../../ports/output/schedule-repository.port';

export interface UpsertScheduleCommand {
  userId: string;
  groupJid: string;
  sendTime: string;
  timezone?: string;
  planStartDate: string;
  dayOffset?: number;
  messageTemplate?: string;
}

@Injectable()
export class UpsertScheduleUseCase implements UseCase<UpsertScheduleCommand, ScheduleDto> {
  private readonly logger = new Logger(UpsertScheduleUseCase.name);

  constructor(
    @Inject(SCHEDULE_REPOSITORY) private readonly repository: ScheduleRepositoryPort,
    @Inject(GROUP_DIRECTORY) private readonly groups: GroupDirectoryPort,
  ) {}

  async execute(command: UpsertScheduleCommand): Promise<ScheduleDto> {
    // Barreira de autorização: o grupo tem que estar entre os grupos DESTE usuário. Sem isso,
    // um JID qualquer no body viraria destino da mensagem diária.
    const group = await this.groups.findByUserAndJid(command.userId, command.groupJid);
    if (!group) {
      throw new GroupNotFoundException();
    }

    const sendTime = SendTime.create(command.sendTime);
    const timezone = Timezone.create(command.timezone);
    const messageTemplate = MessageTemplate.create(command.messageTemplate);

    const existing = await this.repository.findByUserId(command.userId);

    if (existing) {
      existing.update({
        groupJid: group.jid,
        // Snapshot do nome atual do grupo (spec §4.5).
        groupName: group.name,
        sendTime,
        timezone,
        planStartDate: command.planStartDate,
        dayOffset: command.dayOffset ?? 0,
        messageTemplate,
      });
      const saved = await this.repository.save(existing);
      this.logger.log('Agendamento atualizado', {
        userId: command.userId,
        sendTime: sendTime.value,
        timezone: timezone.value,
      });
      return ScheduleDto.fromDomain(saved);
    }

    const created = await this.repository.save(
      Schedule.create({
        userId: command.userId,
        groupJid: group.jid,
        groupName: group.name,
        sendTime,
        timezone,
        planStartDate: command.planStartDate,
        dayOffset: command.dayOffset ?? 0,
        messageTemplate,
      }),
    );
    this.logger.log('Agendamento criado', { userId: command.userId, sendTime: sendTime.value });
    return ScheduleDto.fromDomain(created);
  }
}
