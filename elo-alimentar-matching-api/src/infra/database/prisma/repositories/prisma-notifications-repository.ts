import type { PrismaClient } from '@prisma/client'
import type { Notification } from '@/domain/notification/notification'
import type { NotificationsRepository } from '@/domain/notification/notifications-repository'
import { PrismaNotificationMapper } from '../mappers/prisma-notification-mapper'

export class PrismaNotificationsRepository implements NotificationsRepository {
  constructor(private client: PrismaClient) {}

  async findById(id: string) {
    const row = await this.client.notification.findUnique({ where: { id } })

    return row ? PrismaNotificationMapper.toDomain(row) : null
  }

  async findManyByRecipient(recipientId: string, limit: number) {
    const rows = await this.client.notification.findMany({
      where: { recipient_id: recipientId },
      orderBy: { created_at: 'desc' },
      take: limit,
    })

    return rows.map(PrismaNotificationMapper.toDomain)
  }

  async findManyUnreadByRecipient(recipientId: string) {
    const rows = await this.client.notification.findMany({
      where: { recipient_id: recipientId, read_at: null },
    })

    return rows.map(PrismaNotificationMapper.toDomain)
  }

  async countUnread(recipientId: string) {
    return this.client.notification.count({ where: { recipient_id: recipientId, read_at: null } })
  }

  async create(notification: Notification) {
    await this.client.notification.create({ data: PrismaNotificationMapper.toPersistence(notification) })
  }

  async save(notification: Notification) {
    await this.client.notification.update({
      where: { id: notification.id },
      data: { read_at: notification.readAt },
    })
  }
}
