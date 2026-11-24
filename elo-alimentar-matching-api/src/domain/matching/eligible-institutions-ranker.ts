import type { FoodBatch } from '../food-batch/food-batch'
import type { Institution } from '../institution/institution'
import type { MatchingStrategy, MatchResult } from './types'

/**
 * Domain service: em que ordem as instituições devem receber este lote.
 * Regras aplicadas antes da estratégia:
 *  - só instituições validadas pelo administrador (RN03);
 *  - quem já recusou ou deixou a oferta expirar não volta à fila (RN08).
 */
export class EligibleInstitutionsRanker {
  constructor(private strategy: MatchingStrategy) {}

  rank(batch: FoodBatch, institutions: Institution[], now: Date): MatchResult<Institution>[] {
    const alreadyTried = batch.institutionsAlreadyTried()

    const eligible = institutions.filter(
      (institution) => institution.validated && !alreadyTried.has(institution.id),
    )

    return this.strategy.rank(batch, eligible, now)
  }
}
