import { DomainException } from '@gitspread/domain-primitives';

export class MaterialNotFoundException extends DomainException {
  constructor(message: string) {
    super(message);
  }
}
