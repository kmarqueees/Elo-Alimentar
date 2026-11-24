import type { CompareStrategiesUseCase } from '@/application/evaluation/compare-strategies'
import type { GetBatchUseCase } from '@/application/use-cases/food-batches/get-batch'
import type { ListBatchesUseCase } from '@/application/use-cases/food-batches/list-batches'
import type { RegisterFoodBatchUseCase } from '@/application/use-cases/food-batches/register-food-batch'
import type { ListInstitutionsUseCase } from '@/application/use-cases/institutions/list-institutions'
import type { RegisterInstitutionUseCase } from '@/application/use-cases/institutions/register-institution'
import type { ValidateInstitutionUseCase } from '@/application/use-cases/institutions/validate-institution'
import type { MatchBatchUseCase } from '@/application/use-cases/matching/match-batch'
import type { AcceptOfferUseCase } from '@/application/use-cases/offers/accept-offer'
import type { AdvanceOfferQueueUseCase } from '@/application/use-cases/offers/advance-offer-queue'
import type { CompletePickupUseCase } from '@/application/use-cases/offers/complete-pickup'
import type { DeclineOfferUseCase } from '@/application/use-cases/offers/decline-offer'
import type { ListBatchOffersUseCase } from '@/application/use-cases/offers/list-batch-offers'
import type { ListInstitutionOffersUseCase } from '@/application/use-cases/offers/list-institution-offers'

/** Estratégias selecionáveis por query string (?strategy=). */
export const STRATEGY_KEYS = ['multicriteria', 'distance'] as const
export type StrategyKey = (typeof STRATEGY_KEYS)[number]

/** O que a camada HTTP precisa receber do composition root. */
export interface UseCases {
  registerInstitution: RegisterInstitutionUseCase
  listInstitutions: ListInstitutionsUseCase
  validateInstitution: ValidateInstitutionUseCase
  registerFoodBatch: RegisterFoodBatchUseCase
  listBatches: ListBatchesUseCase
  getBatch: GetBatchUseCase
  matchBatch: Record<StrategyKey, MatchBatchUseCase>
  compareStrategies: CompareStrategiesUseCase
  listBatchOffers: ListBatchOffersUseCase
  listInstitutionOffers: ListInstitutionOffersUseCase
  acceptOffer: AcceptOfferUseCase
  declineOffer: DeclineOfferUseCase
  completePickup: CompletePickupUseCase
  advanceOfferQueue: AdvanceOfferQueueUseCase
}

export interface HttpDependencies {
  useCases: UseCases
  clock: () => Date
}
