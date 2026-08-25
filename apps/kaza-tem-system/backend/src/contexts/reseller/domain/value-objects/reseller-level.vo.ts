import { ValueObject } from '@gitspread/domain-primitives';

type ResellerLevelType = 'bronze' | 'silver' | 'gold';

interface ResellerLevelProps {
  level: ResellerLevelType;
}

export class ResellerLevel extends ValueObject<ResellerLevelProps> {
  private constructor(props: ResellerLevelProps) {
    super(props);
  }

  static bronze(): ResellerLevel {
    return new ResellerLevel({ level: 'bronze' });
  }

  static silver(): ResellerLevel {
    return new ResellerLevel({ level: 'silver' });
  }

  static gold(): ResellerLevel {
    return new ResellerLevel({ level: 'gold' });
  }

  static from(level: string): ResellerLevel {
    switch (level) {
      case 'bronze':
        return ResellerLevel.bronze();
      case 'silver':
        return ResellerLevel.silver();
      case 'gold':
        return ResellerLevel.gold();
      default:
        throw new Error(`Invalid reseller level: ${level}`);
    }
  }

  get value(): ResellerLevelType {
    return this.props.level;
  }

  isBronze(): boolean {
    return this.props.level === 'bronze';
  }

  isSilver(): boolean {
    return this.props.level === 'silver';
  }

  isGold(): boolean {
    return this.props.level === 'gold';
  }
}
