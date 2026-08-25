import { ValueObject } from '@gitspread/domain-primitives';
import { InvalidTargetFilterException } from '../exceptions/invalid-target-filter.exception';

const MAX_TAGS = 20;

export interface VariantTagMapping {
  variantId: string;
  tag: string;
}

/**
 * Who receives a distribution (§9.1), plus how variants land on them (§9.1, "Variante").
 *
 * `tags: []` means the whole routable base, and that is deliberately expressible: "todo mundo" is a
 * real campaign, and forcing a fake tag to say it would be worse than making it explicit here.
 *
 * `variantMappings` carries the manual variant↔tag decision, which "prevalece sobre o rateio
 * automático". Stored on the filter rather than resolved at plan time so the reason a given contact
 * received a given variant is reconstructible later from the row alone.
 */
export class TargetFilter extends ValueObject<{
  tags: string[];
  variantMappings: VariantTagMapping[];
}> {
  private constructor(props: { tags: string[]; variantMappings: VariantTagMapping[] }) {
    super(props);
  }

  static create(params: {
    tags?: readonly string[];
    variantMappings?: readonly VariantTagMapping[];
  }): TargetFilter {
    const tags = normalise(params.tags ?? []);
    if (tags.length > MAX_TAGS) {
      throw new InvalidTargetFilterException(`No máximo ${MAX_TAGS} tags por público.`);
    }

    const mappings = (params.variantMappings ?? []).map((mapping) => ({
      variantId: mapping.variantId,
      tag: mapping.tag.trim().toLowerCase(),
    }));
    for (const mapping of mappings) {
      if (!mapping.variantId || !mapping.tag) {
        throw new InvalidTargetFilterException('Mapeamento de variante exige variante e tag.');
      }
    }
    // The same tag pointing at two variants has no defined winner, so it is refused rather than
    // resolved by insertion order — which would make the outcome depend on how the UI serialised it.
    const tagsInMappings = mappings.map((mapping) => mapping.tag);
    if (new Set(tagsInMappings).size !== tagsInMappings.length) {
      throw new InvalidTargetFilterException(
        'Uma tag não pode apontar para duas variantes no mesmo público.',
      );
    }

    return new TargetFilter({ tags, variantMappings: mappings });
  }

  static fromJson(raw: unknown): TargetFilter {
    const value = (raw ?? {}) as { tags?: string[]; variantMappings?: VariantTagMapping[] };
    return TargetFilter.create({ tags: value.tags, variantMappings: value.variantMappings });
  }

  get tags(): string[] {
    return [...this.props.tags];
  }

  get variantMappings(): VariantTagMapping[] {
    return this.props.variantMappings.map((mapping) => ({ ...mapping }));
  }

  get isWholeBase(): boolean {
    return this.props.tags.length === 0;
  }

  get hasManualVariantMapping(): boolean {
    return this.props.variantMappings.length > 0;
  }

  toJson(): { tags: string[]; variantMappings: VariantTagMapping[] } {
    return { tags: this.tags, variantMappings: this.variantMappings };
  }
}

function normalise(tags: readonly string[]): string[] {
  const seen = new Set<string>();
  for (const tag of tags) {
    const clean = tag.trim().toLowerCase();
    if (clean) {
      seen.add(clean);
    }
  }
  return [...seen].sort();
}
