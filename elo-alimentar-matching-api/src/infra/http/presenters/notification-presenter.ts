import type { Notification } from '@/domain/notification/notification'

export function presentNotification(notification: Notification) {
  return {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    batchId: notification.batchId,
    offerId: notification.offerId,
    createdAt: notification.createdAt,
    readAt: notification.readAt,
  }
}
