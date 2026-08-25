import { Subscription } from '../../../domain/entities/subscription.entity';

export const SUBSCRIPTION_REPOSITORY = Symbol('SUBSCRIPTION_REPOSITORY');

export interface SubscriptionRepositoryPort {
  save(subscription: Subscription): Promise<Subscription>;
  findByResellerId(resellerId: string): Promise<Subscription | null>;
  findByRecurrenceId(recurrenceId: string): Promise<Subscription | null>;
  findById(id: string): Promise<Subscription | null>;
  findSuspendedBefore(date: Date): Promise<Subscription[]>;
  findAll(options?: {
    status?: string[];
    limit?: number;
    offset?: number;
  }): Promise<Subscription[]>;
  delete(subscription: Subscription): Promise<void>;
}
