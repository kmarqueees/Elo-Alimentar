/**
 * Premissa de consumo usada para estimar quanto tempo o estoque de uma
 * instituição dura. É uma média; a instituição corrige a estimativa sempre
 * que informa o estoque real.
 */
export interface StockPolicy {
  /** Quilos de alimento consumidos por pessoa atendida, por dia. */
  kgPerPersonPerDay: number
}

export const DEFAULT_STOCK_POLICY: StockPolicy = {
  kgPerPersonPerDay: 0.5,
}
