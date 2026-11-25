import type { Prisma, Notification as PrismaNotification } from '@prisma/client'
import { Notification } from '@/domain/notification/notification'

export class PrismaNotificationMapper {
  static toDomain(row: PrismaNotification) {
    return Notification.restore(
      {
        recipientType: row.recipient_type,
        recipientId: row.recipient_id,
        type: row.type,
        title: row.title,
        message: row.message,
        batchId: row.batch_id,
        offerId: row.offer_id,
        createdAt: row.created_at,
        readAt: row.read_at,
      },
      row.id,
    )
  }

  static toPersistence(notification: Notification): Prisma.NotificationUncheckedCreateInput {
    return {
      id: notification.id,
      recipient_type: notification.recipientType,
      recipient_id: notification.recipientId,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      batch_id: notification.batchId,
      offer_id: notification.offerId,
      created_at: notification.createdAt,
      read_at: notification.readAt,
    }
  }
}
