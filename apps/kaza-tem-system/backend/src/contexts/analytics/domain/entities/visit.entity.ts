import { AggregateRoot } from '@gitspread/domain-primitives';
import { VisitId } from '../value-objects/visit-id.vo';

interface VisitProps {
  id: VisitId;
  resellerId: string;
  visitorId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  referrer: string | null;
  pageUrl: string | null;
  createdAt: Date;
}

export class Visit extends AggregateRoot {
  private constructor(private readonly props: VisitProps) {
    super();
  }

  static record(payload: {
    resellerId: string;
    visitorId?: string | null;
    ipAddress?: string | null;
    userAgent?: string | null;
    referrer?: string | null;
    pageUrl?: string | null;
  }): Visit {
    return new Visit({
      id: VisitId.generate(),
      resellerId: payload.resellerId,
      visitorId: payload.visitorId ?? null,
      ipAddress: payload.ipAddress ?? null,
      userAgent: payload.userAgent ?? null,
      referrer: payload.referrer ?? null,
      pageUrl: payload.pageUrl ?? null,
      createdAt: new Date(),
    });
  }

  static reconstitute(props: VisitProps): Visit {
    return new Visit({ ...props });
  }

  get id(): VisitId {
    return this.props.id;
  }

  get resellerId(): string {
    return this.props.resellerId;
  }

  get visitorId(): string | null {
    return this.props.visitorId;
  }

  get ipAddress(): string | null {
    return this.props.ipAddress;
  }

  get userAgent(): string | null {
    return this.props.userAgent;
  }

  get referrer(): string | null {
    return this.props.referrer;
  }

  get pageUrl(): string | null {
    return this.props.pageUrl;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }
}
