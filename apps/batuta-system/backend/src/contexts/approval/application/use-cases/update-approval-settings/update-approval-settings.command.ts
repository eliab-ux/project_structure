import { NotifyChannel } from '../../../domain/value-objects/notify-channel.vo';

export class UpdateApprovalSettingsCommand {
  constructor(
    public readonly accountId: string,
    public readonly performedBy: string,
    public readonly requiredForInstitutional: number,
    public readonly requiredForElectoral: number,
    public readonly notifyChannel: NotifyChannel,
    public readonly ip: string | null,
  ) {}
}
