import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { VideoNotFoundForDayException } from '../../../domain/exceptions/video-not-found-for-day.exception';
import { DailyVideoDto } from '../../dto/daily-video.dto';
import {
  DAILY_VIDEO_REPOSITORY,
  DailyVideoRepositoryPort,
} from '../../ports/output/daily-video-repository.port';

@Injectable()
export class GetVideoByDayUseCase implements UseCase<{ dayNumber: number }, DailyVideoDto> {
  constructor(
    @Inject(DAILY_VIDEO_REPOSITORY) private readonly repository: DailyVideoRepositoryPort,
  ) {}

  async execute(command: { dayNumber: number }): Promise<DailyVideoDto> {
    const video = await this.repository.findByDayNumber(command.dayNumber);
    if (!video) {
      throw new VideoNotFoundForDayException(command.dayNumber);
    }
    return DailyVideoDto.fromDomain(video);
  }
}
