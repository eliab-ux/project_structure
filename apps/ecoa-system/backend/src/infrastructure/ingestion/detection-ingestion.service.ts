import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import {
  EntityManager,
  EntityRepository,
  UniqueConstraintViolationException,
} from '@mikro-orm/core';
import { randomUUID } from 'crypto';
import {
  WATCHLIST_REPOSITORY,
  WatchlistRepositoryPort,
} from '../../contexts/watchlist/application/ports/output/watchlist-repository.port';
import {
  CONTENT_REPOSITORY,
  ContentRepositoryPort,
} from '../../contexts/content/application/ports/output/content-repository.port';
import { RegisterDetectionUseCase } from '../../contexts/detection/application/use-cases/register-detection/register-detection.use-case';
import { RegisterDetectionCommand } from '../../contexts/detection/application/use-cases/register-detection/register-detection.command';
import { DetectionType } from '../../contexts/detection/domain/value-objects/detection-type.vo';
import { WebhookEventOrmEntity } from '../persistence/mikro-orm/entities/webhook-event-orm.entity';

export interface IngestDetectionInput {
  ownerId: string;
  sourceUsername: string;
  detectionType: DetectionType;
  /** ig_media_id of the tenant's own media that was reshared, when the payload exposes it. */
  igMediaId?: string | null;
  permalink?: string | null;
  detectedAt?: Date;
  /** Deterministic idempotency key; a repeated ingestion with the same key is a no-op. */
  externalId: string;
  payloadHash?: string;
}

/**
 * Shared ingestion path used by BOTH the webhook controller and the reconcile-mentions job.
 * Centralizes: idempotency (webhook_event.external_id), tenant-scoped watchlist matching
 * (a match ⇒ "highlighted"), own-media resolution, and detection creation. Every write is
 * scoped to the resolved tenant — never to a client-supplied owner.
 */
@Injectable()
export class DetectionIngestionService {
  private readonly logger = new Logger(DetectionIngestionService.name);

  constructor(
    @InjectRepository(WebhookEventOrmEntity)
    private readonly webhookEvents: EntityRepository<WebhookEventOrmEntity>,
    private readonly em: EntityManager,
    @Inject(WATCHLIST_REPOSITORY)
    private readonly watchlistRepository: WatchlistRepositoryPort,
    @Inject(CONTENT_REPOSITORY)
    private readonly contentRepository: ContentRepositoryPort,
    private readonly registerDetection: RegisterDetectionUseCase,
  ) {}

  /**
   * Records an idempotency row. Returns true if this externalId is NEW (caller should proceed),
   * false if it was already seen (duplicate → skip). The unique constraint is the source of truth,
   * so a race between two deliveries still results in exactly one processed event.
   */
  async claim(
    externalId: string,
    payloadHash: string,
    resolvedOwnerId: string | null,
  ): Promise<boolean> {
    const existing = await this.webhookEvents.findOne({ externalId });
    if (existing) {
      return false;
    }
    const row = new WebhookEventOrmEntity();
    row.id = randomUUID();
    row.externalId = externalId;
    row.payloadHash = payloadHash;
    row.resolvedOwnerId = resolvedOwnerId;
    row.receivedAt = new Date();
    row.processed = false;
    try {
      await this.em.persistAndFlush(row);
      return true;
    } catch (error) {
      if (error instanceof UniqueConstraintViolationException) {
        return false; // lost the race — another delivery already claimed it
      }
      throw error;
    }
  }

  async markProcessed(externalId: string): Promise<void> {
    const row = await this.webhookEvents.findOne({ externalId });
    if (row) {
      row.processed = true;
      await this.em.persistAndFlush(row);
    }
  }

  /**
   * Creates a detection for the (already resolved) tenant, attributing it to a watched account
   * when the source matches the tenant's watchlist, and linking the tenant's own media when the
   * reshared ig_media_id is known.
   */
  async ingest(input: IngestDetectionInput): Promise<void> {
    const isNew = await this.claim(
      input.externalId,
      input.payloadHash ?? input.externalId,
      input.ownerId,
    );
    if (!isNew) {
      this.logger.debug('Ingestão duplicada ignorada', { externalId: input.externalId });
      return;
    }

    const watched = await this.watchlistRepository.findByOwnerAndSourceUsername(
      input.ownerId,
      input.sourceUsername,
    );
    const watchedAccountId = watched ? watched.id.value : null;

    let ownMediaId: string | null = null;
    if (input.igMediaId) {
      const media = await this.contentRepository.findByOwnerAndIgMediaId(
        input.ownerId,
        input.igMediaId,
      );
      ownMediaId = media ? media.id.value : null;
    }

    await this.registerDetection.execute(
      new RegisterDetectionCommand(
        input.ownerId,
        input.sourceUsername,
        input.detectionType,
        ownMediaId,
        watchedAccountId,
        input.permalink ?? null,
        input.detectedAt,
      ),
    );
    await this.markProcessed(input.externalId);
  }
}
