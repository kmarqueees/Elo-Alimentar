import type { NotificationsRepository } from '@/domain/notification/notifications-repository'

interface MarkAllNotificationsReadUseCaseRequest {
  recipientId: string
  now: Date
}

export class MarkAllNotificationsReadUseCase {
  constructor(private notifications: NotificationsRepository) {}

  async execute({
    recipientId,
    now,
  }: MarkAllNotificationsReadUseCaseRequest): Promise<{ markedCount: number }> {
    const unread = await this.notifications.findManyUnreadByRecipient(recipientId)

    for (const notification of unread) {
      notification.markAsReadBy(recipientId, now)
      await this.notifications.save(notification)
    }

    return { markedCount: unread.length }
  }
}
