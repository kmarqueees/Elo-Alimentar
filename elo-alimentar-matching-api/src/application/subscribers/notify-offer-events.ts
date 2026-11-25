import type { DomainEventPublisher } from '@/core/events/domain-event-publisher'
import { DonationCollected } from '@/domain/food-batch/events/donation-collected'
import {
  BatchExpired,
  OfferAccepted,
  OfferDeclined,
  OfferExpired,
  OfferMade,
  OfferReminderDue,
  WaitingForInstitution,
  type BatchSnapshot,
} from '@/domain/food-batch/events/offer-events'
import type { InstitutionsRepository } from '@/domain/institution/institutions-repository'
import {
  Notification,
  type NotificationRecipient,
  type NotificationType,
} from '@/domain/notification/notification'
import type { NotificationsRepository } from '@/domain/notification/notifications-repository'
import type { FoodType } from '@/domain/shared/food'

const FOOD_LABEL: Record<FoodType, string> = {
  HORTIFRUTI: 'hortifruti',
  PANIFICADOS: 'panificados',
  PRATOS_PRONTOS: 'pratos prontos',
  LATICINIOS: 'laticínios',
  CARNES: 'carnes',
  NAO_PERECIVEIS: 'não perecíveis',
}

const kg = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })

/** "18 kg de hortifruti" */
const describe = (batch: BatchSnapshot) => `${kg.format(batch.quantityKg)} kg de ${FOOD_LABEL[batch.foodType]}`

const minutesBetween = (from: Date, to: Date) => Math.max(1, Math.round((to.getTime() - from.getTime()) / 60_000))

interface NewNotification {
  recipientType: NotificationRecipient
  recipientId: string
  type: NotificationType
  title: string
  message: string
  batchId: string
  offerId?: string
  at: Date
}

/**
 * Transforma os eventos do lote em notificações no app (sininho), para a
 * instituição que recebe a oferta e para o doador que acompanha o lote.
 *
 * Outros canais (e-mail, WhatsApp) entrariam aqui como novos destinos, sem
 * mudar o domínio: o lote só registra o que aconteceu.
 */
export class NotifyOfferEvents {
  constructor(
    private notifications: NotificationsRepository,
    private institutions: InstitutionsRepository,
  ) {}

  subscribeTo(events: DomainEventPublisher) {
    events.subscribe(OfferMade, (event) => this.offerMade(event))
    events.subscribe(OfferReminderDue, (event) => this.reminderDue(event))
    events.subscribe(OfferAccepted, (event) => this.offerAccepted(event))
    events.subscribe(OfferDeclined, (event) => this.offerDeclined(event))
    events.subscribe(OfferExpired, (event) => this.offerExpired(event))
    events.subscribe(WaitingForInstitution, (event) => this.waiting(event))
    events.subscribe(DonationCollected, (event) => this.collected(event))
    events.subscribe(BatchExpired, (event) => this.batchExpired(event))
  }

  // ---------- Instituição ----------

  private async offerMade(event: OfferMade) {
    await this.notify({
      recipientType: 'INSTITUTION',
      recipientId: event.institutionId,
      type: 'OFFER_RECEIVED',
      title: 'Nova doação para você',
      message: `${capitalize(describe(event.batch))} disponíveis para a sua instituição. Você tem ${minutesBetween(event.occurredAt, event.respondBy)} minutos para aceitar ou recusar.`,
      batchId: event.batch.batchId,
      offerId: event.offerId,
      at: event.occurredAt,
    })
  }

  private async reminderDue(event: OfferReminderDue) {
    const minutes = minutesBetween(event.occurredAt, event.respondBy)

    await this.notify({
      recipientType: 'INSTITUTION',
      recipientId: event.institutionId,
      type: 'OFFER_REMINDER',
      title: `Faltam ${minutes} minutos para responder`,
      message: `A oferta de ${describe(event.batch)} expira em ${minutes} minutos. Sem resposta, ela segue para a próxima instituição.`,
      batchId: event.batch.batchId,
      offerId: event.offerId,
      at: event.occurredAt,
    })
  }

  // ---------- Instituição e doador ----------

  private async offerExpired(event: OfferExpired) {
    const name = await this.institutionName(event.institutionId)

    await this.notify({
      recipientType: 'INSTITUTION',
      recipientId: event.institutionId,
      type: 'OFFER_TIMED_OUT',
      title: 'Prazo da oferta encerrado',
      message: `A oferta de ${describe(event.batch)} expirou sem resposta e seguiu para outra instituição.`,
      batchId: event.batch.batchId,
      offerId: event.offerId,
      at: event.occurredAt,
    })

    await this.notify({
      recipientType: 'DONOR',
      recipientId: event.batch.donorId,
      type: 'OFFER_EXPIRED',
      title: `${name} não respondeu a tempo`,
      message: `Sua doação de ${describe(event.batch)} segue para a próxima instituição da fila.`,
      batchId: event.batch.batchId,
      offerId: event.offerId,
      at: event.occurredAt,
    })
  }

  // ---------- Doador ----------

  private async offerAccepted(event: OfferAccepted) {
    const name = await this.institutionName(event.institutionId)

    await this.notify({
      recipientType: 'DONOR',
      recipientId: event.batch.donorId,
      type: 'OFFER_ACCEPTED',
      title: 'Doação aceita',
      message: `${name} aceitou sua doação de ${describe(event.batch)} e vai fazer a retirada.`,
      batchId: event.batch.batchId,
      offerId: event.offerId,
      at: event.occurredAt,
    })
  }

  private async offerDeclined(event: OfferDeclined) {
    const name = await this.institutionName(event.institutionId)

    await this.notify({
      recipientType: 'DONOR',
      recipientId: event.batch.donorId,
      type: 'OFFER_DECLINED',
      title: `${name} recusou a doação`,
      message: `Sua doação de ${describe(event.batch)} segue para a próxima instituição da fila.`,
      batchId: event.batch.batchId,
      offerId: event.offerId,
      at: event.occurredAt,
    })
  }

  private async waiting(event: WaitingForInstitution) {
    await this.notify({
      recipientType: 'DONOR',
      recipientId: event.batch.donorId,
      type: 'WAITING_FOR_INSTITUTION',
      title: 'Nenhuma instituição disponível agora',
      message: `Sua doação de ${describe(event.batch)} será oferecida assim que uma instituição puder recebê-la.`,
      batchId: event.batch.batchId,
      at: event.occurredAt,
    })
  }

  private async collected(event: DonationCollected) {
    const name = await this.institutionName(event.institutionId)

    await this.notify({
      recipientType: 'DONOR',
      recipientId: event.batch.donorId,
      type: 'DONATION_COLLECTED',
      title: 'Doação retirada',
      message: `${name} retirou sua doação de ${describe(event.batch)}. Obrigado por doar!`,
      batchId: event.batch.batchId,
      at: event.occurredAt,
    })
  }

  private async batchExpired(event: BatchExpired) {
    if (event.pendingInstitutionId) {
      await this.notify({
        recipientType: 'INSTITUTION',
        recipientId: event.pendingInstitutionId,
        type: 'OFFER_TIMED_OUT',
        title: 'Oferta encerrada',
        message: `A doação de ${describe(event.batch)} venceu antes da sua resposta.`,
        batchId: event.batch.batchId,
        at: event.occurredAt,
      })
    }

    await this.notify({
      recipientType: 'DONOR',
      recipientId: event.batch.donorId,
      type: 'BATCH_EXPIRED',
      title: 'Doação vencida',
      message: `A validade da sua doação de ${describe(event.batch)} passou antes de alguma instituição aceitar.`,
      batchId: event.batch.batchId,
      at: event.occurredAt,
    })
  }

  // ---------- Apoio ----------

  private async notify({ at, offerId, ...input }: NewNotification) {
    await this.notifications.create(
      Notification.create({ ...input, offerId: offerId ?? null, createdAt: at }),
    )
  }

  private async institutionName(id: string) {
    return (await this.institutions.findById(id))?.name ?? 'A instituição'
  }
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1)
}
