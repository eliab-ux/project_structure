import {
  AssignableBody,
  AssignableContact,
  assignVariants,
  summariseAssignments,
} from '../../../src/contexts/distribution/domain/services/variant-assignment';
import { TargetFilter } from '../../../src/contexts/distribution/domain/value-objects/target-filter.vo';
import { InvalidTargetFilterException } from '../../../src/contexts/distribution/domain/exceptions/invalid-target-filter.exception';

const BASE: AssignableBody = { variantId: null, label: 'Base', body: 'Olá, tudo bem?' };
const NORTE: AssignableBody = { variantId: 'v-norte', label: 'Zona Norte', body: 'Olá, vizinho!' };
const SUL: AssignableBody = { variantId: 'v-sul', label: 'Zona Sul', body: 'Olá, vizinha!' };

function contacts(...specs: [string, string[]][]): AssignableContact[] {
  return specs.map(([contactId, tags]) => ({ contactId, tags }));
}

describe('assignVariants — manual mapping prevails (§9.1)', () => {
  it('a mapped tag decides, overriding the round-robin', () => {
    const result = assignVariants({
      contacts: contacts(['c1', ['zona-norte']], ['c2', ['zona-norte']], ['c3', ['zona-norte']]),
      bodies: [BASE, NORTE, SUL],
      manualMappings: [{ variantId: 'v-norte', tag: 'zona-norte' }],
    });

    expect(result.map((entry) => entry.variantId)).toEqual(['v-norte', 'v-norte', 'v-norte']);
    expect(result.every((entry) => entry.fromManualMapping)).toBe(true);
  });

  it('unmapped contacts are still spread evenly, and the rotation ignores the mapped ones', () => {
    const result = assignVariants({
      contacts: contacts(
        ['mapped1', ['zona-norte']],
        ['free1', ['outra']],
        ['mapped2', ['zona-norte']],
        ['free2', ['outra']],
      ),
      bodies: [BASE, NORTE, SUL],
      manualMappings: [{ variantId: 'v-norte', tag: 'zona-norte' }],
    });

    const byContact = new Map(result.map((entry) => [entry.contactId, entry]));
    expect(byContact.get('mapped1')?.variantId).toBe('v-norte');
    expect(byContact.get('mapped2')?.variantId).toBe('v-norte');
    // The free contacts took rotation positions 0 and 1. Had the rotation advanced on the mapped ones
    // too, they would have taken positions 1 and 3 — so these exact values are what proves it did not.
    expect(byContact.get('free1')?.variantId).toBe(null);
    expect(byContact.get('free2')?.variantId).toBe('v-norte');
  });

  it('the first of the CONTACT’s own tags with a rule wins, which is explainable', () => {
    const result = assignVariants({
      contacts: contacts(['c1', ['zona-sul', 'zona-norte']]),
      bodies: [BASE, NORTE, SUL],
      manualMappings: [
        { variantId: 'v-norte', tag: 'zona-norte' },
        { variantId: 'v-sul', tag: 'zona-sul' },
      ],
    });

    expect(result[0].variantId).toBe('v-sul');
  });

  it('a mapping pointing at a deleted variant falls back to the rotation instead of failing', () => {
    const result = assignVariants({
      contacts: contacts(['c1', ['zona-norte']]),
      bodies: [BASE],
      manualMappings: [{ variantId: 'v-que-nao-existe', tag: 'zona-norte' }],
    });

    expect(result[0].variantId).toBeNull();
    expect(result[0].fromManualMapping).toBe(false);
  });
});

describe('assignVariants — the automatic split', () => {
  it('rotates through every body, in order, deterministically', () => {
    const result = assignVariants({
      contacts: contacts(['c1', []], ['c2', []], ['c3', []], ['c4', []]),
      bodies: [BASE, NORTE, SUL],
      manualMappings: [],
    });

    expect(result.map((entry) => entry.variantId)).toEqual([null, 'v-norte', 'v-sul', null]);
  });

  it('is stable: the same input twice gives the same plan', () => {
    const input = {
      contacts: contacts(['c1', []], ['c2', []], ['c3', []]),
      bodies: [BASE, NORTE],
      manualMappings: [],
    };

    // The preview and the persisted plan are two separate calls; if this were random, the operator
    // would confirm a plan different from the one they were shown.
    expect(assignVariants(input)).toEqual(assignVariants(input));
  });

  it('a single body goes to everyone', () => {
    const result = assignVariants({
      contacts: contacts(['c1', []], ['c2', []]),
      bodies: [BASE],
      manualMappings: [],
    });

    expect(result.map((entry) => entry.body)).toEqual([BASE.body, BASE.body]);
  });

  it('carries the resolved body, not just the id — that is what gets rendered and persisted', () => {
    const result = assignVariants({
      contacts: contacts(['c1', []]),
      bodies: [NORTE],
      manualMappings: [],
    });

    expect(result[0].body).toBe('Olá, vizinho!');
    expect(result[0].label).toBe('Zona Norte');
  });

  it('refuses to run with no bodies at all', () => {
    expect(() =>
      assignVariants({ contacts: contacts(['c1', []]), bodies: [], manualMappings: [] }),
    ).toThrow(/nenhum corpo/i);
  });
});

describe('summariseAssignments — the preview line "variantes e onde cada uma cai"', () => {
  it('counts contacts per body and how many came from a manual rule', () => {
    const assignments = assignVariants({
      contacts: contacts(['c1', ['zona-norte']], ['c2', []], ['c3', []]),
      bodies: [BASE, NORTE],
      manualMappings: [{ variantId: 'v-norte', tag: 'zona-norte' }],
    });

    const summary = summariseAssignments(assignments);
    const norte = summary.find((entry) => entry.variantId === 'v-norte');
    const base = summary.find((entry) => entry.variantId === null);

    expect(norte?.contacts).toBe(2);
    expect(norte?.fromManualMapping).toBe(1);
    expect(base?.contacts).toBe(1);
  });
});

describe('TargetFilter', () => {
  it('normalises tags: trimmed, lowercased, deduplicated, sorted', () => {
    const filter = TargetFilter.create({ tags: [' Zona-Norte ', 'zona-norte', 'APOIADOR'] });

    expect(filter.tags).toEqual(['apoiador', 'zona-norte']);
  });

  it('an empty tag list means the whole base, and says so explicitly', () => {
    expect(TargetFilter.create({}).isWholeBase).toBe(true);
  });

  it('refuses a tag pointing at two variants — there would be no defined winner', () => {
    expect(() =>
      TargetFilter.create({
        variantMappings: [
          { variantId: 'v1', tag: 'zona-norte' },
          { variantId: 'v2', tag: 'zona-norte' },
        ],
      }),
    ).toThrow(InvalidTargetFilterException);
  });

  it('survives a round trip through JSON, which is how it is persisted', () => {
    const filter = TargetFilter.create({
      tags: ['zona-norte'],
      variantMappings: [{ variantId: 'v1', tag: 'zona-norte' }],
    });

    const restored = TargetFilter.fromJson(JSON.parse(JSON.stringify(filter.toJson())));

    expect(restored.tags).toEqual(filter.tags);
    expect(restored.variantMappings).toEqual(filter.variantMappings);
  });

  it('tolerates a null stored filter, which is what an old row may hold', () => {
    expect(TargetFilter.fromJson(null).isWholeBase).toBe(true);
  });
});
