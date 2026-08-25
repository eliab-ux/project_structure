import { ContentClassification } from '../../../domain/value-objects/content-classification.vo';
import { ContentOrigin } from '../../../domain/value-objects/content-origin.vo';

export class CreateContentCommand {
  constructor(
    public readonly accountId: string,
    public readonly performedBy: string,
    public readonly title: string,
    /** Mandatory: there is no default anywhere (1.3). */
    public readonly classification: ContentClassification,
    public readonly origin: ContentOrigin,
    public readonly bodyBase: string,
    /** Procedência apenas — o link do post, por exemplo. Nada busca conteúdo por ele. */
    public readonly sourceUrl: string | null,
    public readonly includeSourceUrl: boolean,
    public readonly ip: string | null,
  ) {}
}
