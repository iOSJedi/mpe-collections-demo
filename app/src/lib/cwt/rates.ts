// BIR ATC decision table for Ayala Land leasing context.
// Sources: RR 11-2018 (rent on real property), RR 2-98 §2.57.2.
export type ContractType = 'LEASE' | 'CONCESSION' | 'SERVICE'
export type TaxClassification = 'PRIVATE' | 'GOVT'

export interface AtcMatch {
  code: string
  ratePct: number
}

const TABLE: Record<ContractType, Record<TaxClassification, AtcMatch | null>> = {
  LEASE:      { PRIVATE: { code: 'WC100', ratePct: 5 }, GOVT: { code: 'WC640', ratePct: 5 } },
  SERVICE:    { PRIVATE: { code: 'WC158', ratePct: 2 }, GOVT: { code: 'WC640', ratePct: 5 } },
  CONCESSION: { PRIVATE: null,                            GOVT: null },
}

export function atcFor(input: { contractType: ContractType; taxClassification: TaxClassification }): AtcMatch | null {
  return TABLE[input.contractType][input.taxClassification]
}

export function defaultRateFor(contractType: ContractType): number {
  return TABLE[contractType].PRIVATE?.ratePct ?? 0
}
