/**
 * Institutional or electoral (§1.3, §7 item 2).
 *
 * MANDATORY at creation, with NO default and no nullable: "Todo conteúdo nasce com classification.
 * Sem default, sem nulo." The reason is §15 risco 6 — electoral content has its own rules in Brazil,
 * and the whole point of the exportable trail is that the operation is defensible. A default here
 * would silently mislabel the thing the trail exists to prove.
 */
export enum ContentClassification {
  INSTITUTIONAL = 'INSTITUTIONAL',
  ELECTORAL = 'ELECTORAL',
}
