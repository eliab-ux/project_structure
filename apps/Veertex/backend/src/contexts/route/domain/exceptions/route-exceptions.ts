import { DomainException } from '@gitspread/domain-primitives';

export class RouteNotFoundException extends DomainException {
  constructor() {
    super('Rota não encontrada.');
  }
}
