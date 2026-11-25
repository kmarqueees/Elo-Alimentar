import { CompareStrategiesUseCase } from '@/application/evaluation/compare-strategies'
import { GetBatchUseCase } from '@/application/use-cases/food-batches/get-batch'
import { ListBatchesUseCase } from '@/application/use-cases/food-batches/list-batches'
import { RegisterFoodBatchUseCase } from '@/application/use-cases/food-batches/register-food-batch'
import { LookupPostalCodeUseCase } from '@/application/use-cases/geocoding/lookup-postal-code'
import { SearchAddressUseCase } from '@/application/use-cases/geocoding/search-address'
import type { Geocoder, PostalCodeLookup } from '@/application/ports/address-services'
import { ListInstitutionsUseCase } from '@/application/use-cases/institutions/list-institutions'
import { RegisterInstitutionUseCase } from '@/application/use-cases/institutions/register-institution'
import { UpdateInstitutionStockUseCase } from '@/application/use-cases/institutions/update-institution-stock'
import { ValidateInstitutionUseCase } from '@/application/use-cases/institutions/validate-institution'
import { MatchBatchUseCase } from '@/application/use-cases/matching/match-batch'
import { AcceptOfferUseCase } from '@/application/use-cases/offers/accept-offer'
import { AdvanceOfferQueueUseCase } from '@/application/use-cases/offers/advance-offer-queue'
import { CompletePickupUseCase } from '@/application/use-cases/offers/complete-pickup'
import { DeclineOfferUseCase } from '@/application/use-cases/offers/decline-offer'
import { ListBatchOffersUseCase } from '@/application/use-cases/offers/list-batch-offers'
import { ListInstitutionOffersUseCase } from '@/application/use-cases/offers/list-institution-offers'
import { AddCollectedDonationToStock } from '@/application/subscribers/add-collected-donation-to-stock'
import { NotifyOfferEvents } from '@/application/subscribers/notify-offer-events'
import { ListNotificationsUseCase } from '@/application/use-cases/notifications/list-notifications'
import { MarkAllNotificationsReadUseCase } from '@/application/use-cases/notifications/mark-all-notifications-read'
import { MarkNotificationReadUseCase } from '@/application/use-cases/notifications/mark-notification-read'
import type { NotificationsRepository } from '@/domain/notification/notifications-repository'
import { DomainEventPublisher } from '@/core/events/domain-event-publisher'
import type { DonorsRepository } from '@/domain/donor/donors-repository'
import { DonationCollected } from '@/domain/food-batch/events/donation-collected'
import type { FoodBatchesRepository } from '@/domain/food-batch/food-batches-repository'
import type { InstitutionsRepository } from '@/domain/institution/institutions-repository'
import { EligibleInstitutionsRanker } from '@/domain/matching/eligible-institutions-ranker'
import { SequentialOfferService } from '@/domain/matching/sequential-offer-service'
import { DistanceOnlyStrategy } from '@/domain/matching/strategies/distance-only-strategy'
import { MultiCriteriaStrategy } from '@/domain/matching/strategies/multi-criteria-strategy'
import type { MatchingStrategy } from '@/domain/matching/types'
import type { StrategyKey, UseCases } from '@/infra/http/http-dependencies'

export interface Repositories {
  batchesRepository: FoodBatchesRepository
  institutionsRepository: InstitutionsRepository
  donorsRepository: DonorsRepository
  notificationsRepository: NotificationsRepository
}

/** Serviços externos de endereço (adaptadores das portas em application/ports). */
export interface AddressServices {
  postalCodes: PostalCodeLookup
  geocoder: Geocoder
}

interface ContainerOptions {
  /** Prazo para a instituição responder a uma oferta. */
  offerTimeoutMinutes?: number | undefined
}

/** Composition root: o único lugar que conhece as implementações concretas. */
export function makeUseCases(
  { batchesRepository, institutionsRepository, donorsRepository, notificationsRepository }: Repositories,
  addressServices: AddressServices,
  { offerTimeoutMinutes = 30 }: ContainerOptions = {},
): UseCases {
  const strategies: Record<StrategyKey, MatchingStrategy> = {
    multicriteria: new MultiCriteriaStrategy(),
    distance: new DistanceOnlyStrategy(),
  }

  // Eventos de domínio:
  //  - a retirada de uma doação soma o lote ao estoque da instituição;
  //  - cada mudança na oferta vira notificação para a instituição e o doador.
  const events = new DomainEventPublisher()
  const addToStock = new AddCollectedDonationToStock(institutionsRepository)

  events.subscribe(DonationCollected, (event) => addToStock.handle(event))
  new NotifyOfferEvents(notificationsRepository, institutionsRepository).subscribeTo(events)

  // A fila de ofertas real usa sempre o ranking multicritério.
  const offers = new SequentialOfferService(
    new EligibleInstitutionsRanker(strategies.multicriteria),
    offerTimeoutMinutes,
  )

  const matchWith = (strategy: MatchingStrategy) =>
    new MatchBatchUseCase(
      batchesRepository,
      institutionsRepository,
      new EligibleInstitutionsRanker(strategy),
    )

  return {
    registerInstitution: new RegisterInstitutionUseCase(institutionsRepository),
    listInstitutions: new ListInstitutionsUseCase(institutionsRepository),
    validateInstitution: new ValidateInstitutionUseCase(institutionsRepository),
    updateInstitutionStock: new UpdateInstitutionStockUseCase(institutionsRepository),
    registerFoodBatch: new RegisterFoodBatchUseCase(
      batchesRepository,
      donorsRepository,
      institutionsRepository,
      offers,
      events,
    ),
    listBatches: new ListBatchesUseCase(batchesRepository),
    getBatch: new GetBatchUseCase(batchesRepository),
    matchBatch: {
      multicriteria: matchWith(strategies.multicriteria),
      distance: matchWith(strategies.distance),
    },
    compareStrategies: new CompareStrategiesUseCase(
      batchesRepository,
      institutionsRepository,
      [strategies.distance, strategies.multicriteria],
      undefined,
      offerTimeoutMinutes,
    ),
    listBatchOffers: new ListBatchOffersUseCase(batchesRepository),
    listInstitutionOffers: new ListInstitutionOffersUseCase(
      batchesRepository,
      institutionsRepository,
    ),
    acceptOffer: new AcceptOfferUseCase(batchesRepository, events),
    declineOffer: new DeclineOfferUseCase(batchesRepository, institutionsRepository, offers, events),
    completePickup: new CompletePickupUseCase(batchesRepository, events),
    advanceOfferQueue: new AdvanceOfferQueueUseCase(
      batchesRepository,
      institutionsRepository,
      offers,
      events,
    ),
    lookupPostalCode: new LookupPostalCodeUseCase(addressServices.postalCodes),
    searchAddress: new SearchAddressUseCase(addressServices.geocoder),
    listNotifications: new ListNotificationsUseCase(notificationsRepository),
    markNotificationRead: new MarkNotificationReadUseCase(notificationsRepository),
    markAllNotificationsRead: new MarkAllNotificationsReadUseCase(notificationsRepository),
  }
}
