import type { FoodBatch } from '../food-batch/food-batch'
import type { Institution } from '../institution/institution'
import { InstitutionWorkload } from './institution-workload'
import { toMatchCandidate } from './match-candidate'
import type { MatchingStrategy, MatchResult } from './types'

export interface OfferLimits {
  /** Máximo de lotes em aberto (oferecidos ou aceitos, não retirados) por instituição. */
  maxOpenBatchesPerInstitution: number
}

export const DEFAULT_OFFER_LIMITS: OfferLimits = {
  maxOpenBatchesPerInstitution: 2,
}

/**
 * Domain service: em que ordem as instituições devem receber este lote.
 * Filtros aplicados antes da estratégia:
 *  - só instituições validadas pelo administrador (RN03);
 *  - quem já recusou ou deixou a oferta expirar não volta à fila (RN08);
 *  - no máximo N lotes em aberto por instituição (distribui as doações);
 *  - o lote precisa caber no armazenamento (estoque + já comprometido + lote ≤ capacidade).
 */
export class EligibleInstitutionsRanker {
  constructor(
    private strategy: MatchingStrategy,
    private limits: OfferLimits = DEFAULT_OFFER_LIMITS,
  ) {}

  rank(
    batch: FoodBatch,
    institutions: Institution[],
    now: Date,
    workload: InstitutionWorkload = new InstitutionWorkload(),
  ): MatchResult[] {
    const alreadyTried = batch.institutionsAlreadyTried()

    const candidates = institutions
      .filter((institution) => institution.validated && !alreadyTried.has(institution.id))
      .filter(
        (institution) =>
          workload.openCount(institution.id, batch.id) < this.limits.maxOpenBatchesPerInstitution,
      )
      .map((institution) =>
        toMatchCandidate(institution, now, workload.committedKg(institution.id, batch.id)),
      )
      .filter((candidate) => candidate.availableCapacityKg >= batch.quantityKg)

    return this.strategy.rank(batch, candidates, now)
  }
}
