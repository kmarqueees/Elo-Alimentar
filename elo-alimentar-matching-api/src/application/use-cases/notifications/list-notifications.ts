import type { Notification } from '@/domain/notification/notification'
import type { NotificationsRepository } from '@/domain/notification/notifications-repository'

interface ListNotificationsUseCaseRequest {
  recipientId: string
  limit?: number
}

interface ListNotificationsUseCaseResponse {
  notifications: Notification[]
  unreadCount: number
}

/** Notificações de uma instituição ou doador, das mais recentes para as mais antigas. */
export class ListNotificationsUseCase {
  constructor(private notifications: NotificationsRepository) {}

  async execute({
    recipientId,
    limit = 30,
  }: ListNotificationsUseCaseRequest): Promise<ListNotificationsUseCaseResponse> {
    const [notifications, unreadCount] = await Promise.all([
      this.notifications.findManyByRecipient(recipientId, limit),
      this.notifications.countUnread(recipientId),
    ])

    return { notifications, unreadCount }
  }
}
