import type { Notification } from '@/domain/notification/notification'
import type { NotificationsRepository } from '@/domain/notification/notifications-repository'

export class InMemoryNotificationsRepository implements NotificationsRepository {
  public items: Notification[] = []

  async findById(id: string) {
    return this.items.find((item) => item.id === id) ?? null
  }

  async findManyByRecipient(recipientId: string, limit: number) {
    return this.items
      .filter((item) => item.recipientId === recipientId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit)
  }

  async findManyUnreadByRecipient(recipientId: string) {
    return this.items.filter((item) => item.recipientId === recipientId && !item.isRead)
  }

  async countUnread(recipientId: string) {
    return (await this.findManyUnreadByRecipient(recipientId)).length
  }

  async create(notification: Notification) {
    this.items.push(notification)
  }

  async save(notification: Notification) {
    const index = this.items.findIndex((item) => item.id === notification.id)

    if (index >= 0) this.items[index] = notification
  }
}
