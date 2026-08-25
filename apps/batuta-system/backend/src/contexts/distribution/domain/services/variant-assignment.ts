import { VariantTagMapping } from '../value-objects/target-filter.vo';

/** What the assigner needs to know about a recipient: nothing but the id and the tags. */
export interface AssignableContact {
  contactId: string;
  tags: readonly string[];
}

/** A body that can be sent: the content's base, or one of its variants. */
export interface AssignableBody {
  /** Null for the base body — `dispatches.variant_id` is nullable for exactly this case. */
  variantId: string | null;
  label: string;
  body: string;
}

export interface VariantAssignment {
  contactId: string;
  variantId: string | null;
  body: string;
  label: string;
  /** True when the manual variant↔tag mapping decided this one, false when the round-robin did. */
  fromManualMapping: boolean;
}

/**
 * Decides which body each contact receives (§9.1, "Variante").
 *
 * Two rules, and the order between them is the whole substance:
 *
 *  1. **Manual mapping wins.** If the operator said "variante B vai para a tag zona-norte", every
 *     contact with that tag gets B, full stop. The spec is explicit: "o manual **prevalece** sobre o
 *     rateio automático". An operator who bothered to write a rule about audience segments knows
 *     something the round-robin does not.
 *  2. **What is left is spread evenly**, deterministically, by position in the input order.
 *
 * Deterministic on purpose: the same audience and the same variants must produce the same assignment
 * every time the preview runs, or the preview would be describing a different plan than the one that
 * gets persisted a click later. Randomising here would also make the audit answer to "why did this
 * person get this text?" be "chance", which is not an answer.
 *
 * Note what is NOT here: no generation, no rewriting, no "spinning" of text. §2 forbids automatic
 * variant generation to dodge duplicate detection; this function only ROUTES bodies a human wrote.
 */
export function assignVariants(params: {
  contacts: readonly AssignableContact[];
  bodies: readonly AssignableBody[];
  manualMappings: readonly VariantTagMapping[];
}): VariantAssignment[] {
  const { contacts, bodies } = params;
  if (bodies.length === 0) {
    // Callers guarantee at least the base body; an empty list would silently send nothing.
    throw new Error('assignVariants: nenhum corpo enviável.');
  }

  const byVariantId = new Map<string | null, AssignableBody>();
  for (const body of bodies) {
    byVariantId.set(body.variantId, body);
  }

  // Tag → variant, first mapping wins; TargetFilter already refused a tag pointing at two variants.
  const manualByTag = new Map<string, AssignableBody>();
  for (const mapping of params.manualMappings) {
    const body = byVariantId.get(mapping.variantId);
    if (body) {
      manualByTag.set(mapping.tag.toLowerCase(), body);
    }
    // A mapping pointing at a variant that no longer exists is ignored rather than fatal: the variant
    // may have been deleted after the audience was saved, and the round-robin is a safe fallback.
  }

  const assignments: VariantAssignment[] = [];
  let rotation = 0;

  for (const contact of contacts) {
    const manual = findManual(contact.tags, manualByTag);
    if (manual) {
      assignments.push({
        contactId: contact.contactId,
        variantId: manual.variantId,
        body: manual.body,
        label: manual.label,
        fromManualMapping: true,
      });
      continue;
    }

    // The rotation only advances for contacts the round-robin actually served, so a manual mapping
    // covering half the base does not leave the other half all receiving the same variant.
    const body = bodies[rotation % bodies.length];
    rotation += 1;
    assignments.push({
      contactId: contact.contactId,
      variantId: body.variantId,
      body: body.body,
      label: body.label,
      fromManualMapping: false,
    });
  }

  return assignments;
}

/**
 * A contact may carry several tags and more than one may be mapped. The first of the CONTACT's tags
 * in its own order decides — stable, and explainable to the operator as "a primeira tag do contato
 * que tem regra".
 */
function findManual(
  tags: readonly string[],
  manualByTag: Map<string, AssignableBody>,
): AssignableBody | null {
  for (const tag of tags) {
    const found = manualByTag.get(tag.trim().toLowerCase());
    if (found) {
      return found;
    }
  }
  return null;
}

/** Distribution of variants over an assignment set, for the preview (§9.3). */
export function summariseAssignments(
  assignments: readonly VariantAssignment[],
): { variantId: string | null; label: string; contacts: number; fromManualMapping: number }[] {
  const summary = new Map<
    string,
    { variantId: string | null; label: string; contacts: number; fromManualMapping: number }
  >();
  for (const assignment of assignments) {
    const key = assignment.variantId ?? '__base__';
    const entry = summary.get(key) ?? {
      variantId: assignment.variantId,
      label: assignment.label,
      contacts: 0,
      fromManualMapping: 0,
    };
    entry.contacts += 1;
    if (assignment.fromManualMapping) {
      entry.fromManualMapping += 1;
    }
    summary.set(key, entry);
  }
  return [...summary.values()];
}
