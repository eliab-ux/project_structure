/**
 * Tax regime of a company (01_Veertex_Core §3.2). Drives everything the FIS module will decide
 * about an invoice, which is why it is a required field from day one rather than a later addition.
 */
export enum TaxRegime {
  /** Simples Nacional. */
  SIMPLES = 'SIMPLES',
  /** Lucro Presumido / Lucro Real — "regime normal" for NF-e purposes. */
  NORMAL = 'NORMAL',
  /** Microempreendedor Individual. */
  MEI = 'MEI',
}
