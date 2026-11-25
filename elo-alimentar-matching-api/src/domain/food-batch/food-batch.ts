import { AggregateRoot } from '@/core/entities/aggregate-root'
import { ResourceNotFoundError } from '@/core/errors/resource-not-found-error'
import { Address, type AddressInput } from '../shared/address'
import { Coordinates } from '../shared/coordinates'
import type { FoodType, StorageCondition } from '../shared/food'
import { BatchAlreadyExpiredError } from './errors/batch-already-expired-error'
import { BatchNotAvailableError } from './errors/batch-not-available-error'
import { InvalidBatchQuantityError } from './errors/invalid-batch-quantity-error'
import { InvalidOfferStateError } from './errors/invalid-offer-state-error'
import { DonationCollected } from './events/donation-collected'
import {
  BatchExpired,
  OfferAccepted,
  OfferDeclined,
  OfferExpired,
  OfferMade,
  OfferReminderDue,
  WaitingForInstitution,
  type BatchSnapshot,
} from './events/offer-events'
import { Offer } from './offer'

/**
 * AVAILABLE → sem oferta ativa (esperando a próxima instituição do ranking)
 * OFFERED   → oferecido a uma instituição, aguardando a resposta dela
 * RESERVED  → a instituição aceitou e vai retirar
 * COLLECTED → retirado
 * EXPIRED   → a validade passou antes de alguém aceitar
 */
export const BATCH_STATUSES = ['AVAILABLE', 'OFFERED', 'RESERVED', 'COLLECTED', 'EXPIRED'] as const
export type BatchStatus = (typeof BATCH_STATUSES)[number]

const MS_PER_HOUR = 1000 * 60 * 60

export interface FoodBatchProps {
  donorId: string
  foodType: FoodType
  quantityKg: number
  expiresAt: Date
  storageCondition: StorageCondition
  coordinates: Coordinates
  /** Endereço de retirada. null em lotes marcados só pelo mapa. */
  address: Address | null
  status: BatchStatus
  createdAt: Date
  offers: Offer[]
}

export interface RegisterFoodBatchInput {
  donorId: string
  foodType: FoodType
  quantityKg: number
  expiresAt: Date
  storageCondition: StorageCondition
  latitude: number
  longitude: number
  address?: AddressInput | null | undefined
}

export interface OfferToInput {
  institutionId: string
  score: number
  now: Date
  timeoutMinutes: number
}

/**
 * Raiz do agregado "lote de alimentos". Reúne o lote e a fila de ofertas
 * já feitas, porque o status do lote depende delas:
 *
 *   AVAILABLE --offerTo--> OFFERED --acceptOffer--> RESERVED --completePickup--> COLLECTED
 *       ^                     |
 *       +---decline/expire----+     (o sistema então oferece à próxima do ranking)
 *
 *   AVAILABLE / OFFERED --validade vencida--> EXPIRED
 */
export class FoodBatch extends AggregateRoot<FoodBatchProps> {
  static register(input: RegisterFoodBatchInput, now: Date, id?: string) {
    if (!(input.quantityKg > 0)) {
      throw new InvalidBatchQuantityError()
    }

    if (input.expiresAt.getTime() <= now.getTime()) {
      throw new BatchAlreadyExpiredError()
    }

    const coordinates = Coordinates.create(input.latitude, input.longitude)
    const address = input.address ? Address.create(input.address) : null

    return new FoodBatch(
      {
        donorId: input.donorId,
        foodType: input.foodType,
        quantityKg: input.quantityKg,
        expiresAt: input.expiresAt,
        storageCondition: input.storageCondition,
        coordinates,
        address,
        status: 'AVAILABLE',
        createdAt: now,
        offers: [],
      },
      id,
    )
  }

  /** Reconstrói a partir da persistência; os dados já foram validados ao entrar. */
  static restore(props: FoodBatchProps, id: string) {
    return new FoodBatch({ ...props, offers: [...props.offers] }, id)
  }

  get donorId() {
    return this.props.donorId
  }

  get foodType() {
    return this.props.foodType
  }

  get quantityKg() {
    return this.props.quantityKg
  }

  get expiresAt() {
    return this.props.expiresAt
  }

  get storageCondition() {
    return this.props.storageCondition
  }

  get coordinates() {
    return this.props.coordinates
  }

  get latitude() {
    return this.props.coordinates.latitude
  }

  get longitude() {
    return this.props.coordinates.longitude
  }

  get address() {
    return this.props.address
  }

  get status() {
    return this.props.status
  }

  get createdAt() {
    return this.props.createdAt
  }

  /** Histórico de ofertas, em ordem de criação. */
  get offers(): readonly Offer[] {
    return this.props.offers
  }

  /** Oferta pendente ou aceita, se houver. */
  get activeOffer() {
    return this.props.offers.find((offer) => offer.isPending || offer.isAccepted) ?? null
  }

  /** Pode receber uma nova oferta agora. */
  get isAvailable() {
    return this.props.status === 'AVAILABLE'
  }

  /** Ainda não foi retirado nem venceu. */
  get isOpen() {
    return this.props.status !== 'COLLECTED' && this.props.status !== 'EXPIRED'
  }

  hoursUntilExpiry(now: Date) {
    return (this.props.expiresAt.getTime() - now.getTime()) / MS_PER_HOUR
  }

  isPastValidity(now: Date) {
    return this.props.expiresAt.getTime() <= now.getTime()
  }

  /** Quem recusou ou deixou a oferta expirar não recebe este lote de novo (RN08). */
  institutionsAlreadyTried(): ReadonlySet<string> {
    return new Set(
      this.props.offers
        .filter((offer) => offer.isClosedWithoutAcceptance)
        .map((offer) => offer.institutionId),
    )
  }

  /** Oferece o lote a uma instituição. Só uma oferta ativa por vez (RN06). */
  offerTo({ institutionId, score, now, timeoutMinutes }: OfferToInput) {
    if (!this.isAvailable || this.isPastValidity(now)) {
      throw new BatchNotAvailableError()
    }

    const offer = Offer.make({
      batchId: this.id,
      institutionId,
      score,
      now,
      timeoutMinutes,
    })

    this.props.offers.push(offer)
    this.props.status = 'OFFERED'
    this.addDomainEvent(new OfferMade(this.snapshot(), offer.id, institutionId, offer.expiresAt, now))

    return offer
  }

  /**
   * Lembra a instituição quando faltam `leadMinutes` para a oferta expirar.
   * Cada oferta é lembrada uma única vez. Devolve as ofertas lembradas.
   */
  remindPendingOffers(now: Date, leadMinutes: number) {
    const due = this.props.offers.filter((offer) => offer.isReminderDue(now, leadMinutes))

    for (const offer of due) {
      offer.markReminded(now)
      this.addDomainEvent(new OfferReminderDue(this.snapshot(), offer.id, offer.institutionId, offer.expiresAt, now))
    }

    return due
  }

  /**
   * O lote ficou sem oferta ativa e nenhuma instituição pode recebê-lo agora.
   * Chamado por quem tentou oferecer e não encontrou candidata.
   */
  reportWaitingForInstitution(now: Date) {
    if (this.isAvailable) {
      this.addDomainEvent(new WaitingForInstitution(this.snapshot(), now))
    }
  }

  acceptOffer(offerId: string, institutionId: string, now: Date) {
    const offer = this.getOffer(offerId)

    offer.accept(institutionId, now)
    this.props.status = 'RESERVED'
    this.addDomainEvent(new OfferAccepted(this.snapshot(), offer.id, institutionId, now))

    return offer
  }

  /** Recusa: o lote volta a AVAILABLE para ser oferecido à próxima (RN08). */
  declineOffer(offerId: string, institutionId: string, now: Date) {
    const offer = this.getOffer(offerId)

    offer.decline(institutionId, now)
    this.props.status = 'AVAILABLE'
    this.addDomainEvent(new OfferDeclined(this.snapshot(), offer.id, institutionId, now))

    return offer
  }

  /** Expira as ofertas sem resposta no prazo e devolve o lote à fila (RN04, RN08). */
  expireOverdueOffers(now: Date) {
    const overdue = this.props.offers.filter((offer) => offer.isOverdue(now))

    for (const offer of overdue) {
      offer.expire()
      this.addDomainEvent(new OfferExpired(this.snapshot(), offer.id, offer.institutionId, now))
    }

    if (overdue.length > 0) {
      this.props.status = 'AVAILABLE'
    }

    return overdue
  }

  /**
   * A validade passou antes de alguém aceitar: o lote sai de circulação.
   * Um lote já aceito (RESERVED) não é afetado: a instituição já está a caminho.
   */
  expireIfPastValidity(now: Date) {
    const canExpire = this.props.status === 'AVAILABLE' || this.props.status === 'OFFERED'

    if (!canExpire || !this.isPastValidity(now)) {
      return false
    }

    let pendingInstitutionId: string | null = null

    for (const offer of this.props.offers) {
      if (offer.isPending) {
        offer.expire()
        pendingInstitutionId = offer.institutionId
      }
    }

    this.props.status = 'EXPIRED'
    this.addDomainEvent(new BatchExpired(this.snapshot(), pendingInstitutionId, now))

    return true
  }

  /** Retirada concluída pela instituição que aceitou. Gera o evento DonationCollected. */
  completePickup(offerId: string, institutionId: string, now: Date) {
    const offer = this.getOffer(offerId)

    offer.ensureCanBePickedUpBy(institutionId)

    if (this.props.status !== 'RESERVED') {
      throw new InvalidOfferStateError()
    }

    this.props.status = 'COLLECTED'
    this.addDomainEvent(new DonationCollected(this.snapshot(), institutionId, now))

    return offer
  }

  private snapshot(): BatchSnapshot {
    return {
      batchId: this.id,
      donorId: this.props.donorId,
      foodType: this.props.foodType,
      quantityKg: this.props.quantityKg,
    }
  }

  private getOffer(offerId: string) {
    const offer = this.props.offers.find((item) => item.id === offerId)

    if (!offer) {
      throw new ResourceNotFoundError()
    }

    return offer
  }
}
