import { randomUUID } from 'crypto';
import { ContentClassification } from '../../../content/domain/value-objects/content-classification.vo';
import { NotifyChannel } from '../value-objects/notify-channel.vo';
import { InvalidApprovalSettingsException } from '../exceptions/invalid-approval-settings.exception';

/** §8 item 1: "1 ou 2 aprovadores". Not a free number — two is the ceiling the spec sets. */
const ALLOWED_REQUIRED_COUNTS = [1, 2] as const;

/**
 * How many approvals a content needs, per classification (§8 item 1).
 *
 * Separately configurable for INSTITUTIONAL and ELECTORAL, and that separation is the whole point:
 * electoral content carries its own legal exposure in Brazil (§15 risco 6), so an office can demand
 * two pairs of eyes there while keeping one for routine institutional notices.
 *
 * Defaults, when an account has never configured it: 1 for institutional, 2 for electoral. That is a
 * choice, not a spec value — it errs towards the side where being wrong is expensive.
 */
export class ApprovalSettings {
  private constructor(
    private readonly _id: string,
    private readonly _accountId: string,
    private _requiredForInstitutional: number,
    private _requiredForElectoral: number,
    private _notifyChannel: NotifyChannel,
  ) {}

  static createDefault(accountId: string): ApprovalSettings {
    return new ApprovalSettings(randomUUID(), accountId, 1, 2, NotifyChannel.EMAIL);
  }

  static reconstitute(params: {
    id: string;
    accountId: string;
    requiredForInstitutional: number;
    requiredForElectoral: number;
    notifyChannel: NotifyChannel;
  }): ApprovalSettings {
    return new ApprovalSettings(
      params.id,
      params.accountId,
      params.requiredForInstitutional,
      params.requiredForElectoral,
      params.notifyChannel,
    );
  }

  get id(): string {
    return this._id;
  }

  get accountId(): string {
    return this._accountId;
  }

  get requiredForInstitutional(): number {
    return this._requiredForInstitutional;
  }

  get requiredForElectoral(): number {
    return this._requiredForElectoral;
  }

  get notifyChannel(): NotifyChannel {
    return this._notifyChannel;
  }

  /** How many approvals THIS classification needs. The only place that answer comes from. */
  requiredFor(classification: ContentClassification): number {
    return classification === ContentClassification.ELECTORAL
      ? this._requiredForElectoral
      : this._requiredForInstitutional;
  }

  change(params: {
    requiredForInstitutional?: number;
    requiredForElectoral?: number;
    notifyChannel?: NotifyChannel;
  }): void {
    if (params.requiredForInstitutional !== undefined) {
      ApprovalSettings.assertAllowedCount(params.requiredForInstitutional);
      this._requiredForInstitutional = params.requiredForInstitutional;
    }
    if (params.requiredForElectoral !== undefined) {
      ApprovalSettings.assertAllowedCount(params.requiredForElectoral);
      this._requiredForElectoral = params.requiredForElectoral;
    }
    if (params.notifyChannel !== undefined) {
      this._notifyChannel = params.notifyChannel;
    }
  }

  private static assertAllowedCount(count: number): void {
    if (!ALLOWED_REQUIRED_COUNTS.includes(count as 1 | 2)) {
      throw new InvalidApprovalSettingsException();
    }
  }
}
