import type { FoodBatchesRepository } from '@/repositories/food-batches-repository'
import type { InstitutionsRepository } from '@/repositories/institutions-repository'
import type { ReservationsRepository } from '@/repositories/reservations-repository'
import { DistanceOnlyStrategy } from '@/matching/strategies/distance-only-strategy'
import { MultiCriteriaStrategy } from '@/matching/strategies/multi-criteria-strategy'
import { CompareStrategiesUseCase } from '@/use-cases/compare-strategies'
import { CompletePickupUseCase } from '@/use-cases/complete-pickup'
import { ConfirmReservationUseCase } from '@/use-cases/confirm-reservation'
import { ExpireReservationsUseCase } from '@/use-cases/expire-reservations'
import { GetBatchUseCase } from '@/use-cases/get-batch'
import { ListBatchReservationsUseCase } from '@/use-cases/list-batch-reservations'
import { ListBatchesUseCase } from '@/use-cases/list-batches'
import { ListInstitutionsUseCase } from '@/use-cases/list-institutions'
import { MatchBatchUseCase } from '@/use-cases/match-batch'
import { RegisterFoodBatchUseCase } from '@/use-cases/register-food-batch'
import { RegisterInstitutionUseCase } from '@/use-cases/register-institution'
import { RejectReservationUseCase } from '@/use-cases/reject-reservation'
import { ReserveBatchUseCase } from '@/use-cases/reserve-batch'
import { ValidateInstitutionUseCase } from '@/use-cases/validate-institution'

export const STRATEGY_KEYS = ['multicriteria', 'distance'] as const
export type StrategyKey = (typeof STRATEGY_KEYS)[number]

export interface Repositories {
  batchesRepository: FoodBatchesRepository
  institutionsRepository: InstitutionsRepository
  reservationsRepository: ReservationsRepository
}

interface ComposeOptions {
  reservationTimeoutMinutes?: number | undefined
}

export function composeUseCases(
  { batchesRepository, institutionsRepository, reservationsRepository }: Repositories,
  { reservationTimeoutMinutes = 30 }: ComposeOptions = {},
) {
  const matchWith = (strategy: MultiCriteriaStrategy | DistanceOnlyStrategy) =>
    new MatchBatchUseCase(
      batchesRepository,
      institutionsRepository,
      strategy,
      reservationsRepository,
    )

  const matchBatch: Record<StrategyKey, MatchBatchUseCase> = {
    multicriteria: matchWith(new MultiCriteriaStrategy()),
    distance: matchWith(new DistanceOnlyStrategy()),
  }

  return {
    registerInstitution: new RegisterInstitutionUseCase(institutionsRepository),
    listInstitutions: new ListInstitutionsUseCase(institutionsRepository),
    validateInstitution: new ValidateInstitutionUseCase(institutionsRepository),
    registerFoodBatch: new RegisterFoodBatchUseCase(batchesRepository),
    listBatches: new ListBatchesUseCase(batchesRepository),
    getBatch: new GetBatchUseCase(batchesRepository),
    matchBatch,
    compareStrategies: new CompareStrategiesUseCase(
      batchesRepository,
      institutionsRepository,
      [new DistanceOnlyStrategy(), new MultiCriteriaStrategy()],
    ),
    reserveBatch: new ReserveBatchUseCase(
      matchBatch.multicriteria,
      reservationsRepository,
      reservationTimeoutMinutes,
    ),
    listBatchReservations: new ListBatchReservationsUseCase(
      batchesRepository,
      reservationsRepository,
    ),
    confirmReservation: new ConfirmReservationUseCase(reservationsRepository),
    rejectReservation: new RejectReservationUseCase(reservationsRepository),
    completePickup: new CompletePickupUseCase(reservationsRepository),
    expireReservations: new ExpireReservationsUseCase(reservationsRepository),
  }
}

export type UseCases = ReturnType<typeof composeUseCases>
