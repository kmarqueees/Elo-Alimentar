import type { InstitutionOffer } from '@/application/use-cases/offers/list-institution-offers'
import type { Offer } from '@/domain/food-batch/offer'
import { presentFoodBatch } from './food-batch-presenter'

export function presentOffer(offer: Offer) {
  return {
    id: offer.id,
    batchId: offer.batchId,
    institutionId: offer.institutionId,
    score: offer.score,
    status: offer.status,
    createdAt: offer.createdAt,
    expiresAt: offer.expiresAt,
    respondedAt: offer.respondedAt,
  }
}

/**
 * Visão da instituição: a oferta e o lote, sem a nota do ranking.
 * A instituição não precisa saber sua posição nem a de outras.
 */
export function presentInstitutionOffer({ offer, batch }: InstitutionOffer) {
  const { score: _score, ...withoutScore } = presentOffer(offer)

  return { offer: withoutScore, batch: presentFoodBatch(batch) }
}
