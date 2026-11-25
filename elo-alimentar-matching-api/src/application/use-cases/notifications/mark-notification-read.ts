import { ResourceNotFoundError } from '@/core/errors/resource-not-found-error'
import type { Notification } from '@/domain/notification/notification'
import type { NotificationsRepository } from '@/domain/notification/notifications-repository'

interface MarkNotificationReadUseCaseRequest {
  notificationId: string
  recipientId: string
  now: Date
}

export class MarkNotificationReadUseCase {
  constructor(private notifications: NotificationsRepository) {}

  async execute({
    notificationId,
    recipientId,
    now,
  }: MarkNotificationReadUseCaseRequest): Promise<{ notification: Notification }> {
    const notification = await this.notifications.findById(notificationId)

    if (!notification) {
      throw new ResourceNotFoundError()
    }

    notification.markAsReadBy(recipientId, now)

    await this.notifications.save(notification)

    return { notification }
  }
}
