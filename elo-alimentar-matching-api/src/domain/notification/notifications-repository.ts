import type { Notification } from './notification'

export interface NotificationsRepository {
  findById(id: string): Promise<Notification | null>
  /** Mais recentes primeiro. */
  findManyByRecipient(recipientId: string, limit: number): Promise<Notification[]>
  findManyUnreadByRecipient(recipientId: string): Promise<Notification[]>
  countUnread(recipientId: string): Promise<number>
  create(notification: Notification): Promise<void>
  save(notification: Notification): Promise<void>
}
