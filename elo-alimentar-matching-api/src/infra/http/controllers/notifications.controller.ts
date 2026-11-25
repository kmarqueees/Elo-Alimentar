import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { HttpDependencies } from '../http-dependencies'
import { presentNotification } from '../presenters/notification-presenter'
import { idParams } from './schemas'

/**
 * Login ainda é de demonstração: o destinatário se identifica na requisição.
 * Com autenticação, recipientId passa a vir do usuário logado.
 */
const listQuery = z.object({
  recipientId: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
})
const recipientBody = z.object({ recipientId: z.string().min(1) })

export function notificationsController(app: FastifyInstance, { useCases, clock }: HttpDependencies) {
  app.get('/notifications', async (request) => {
    const { recipientId, limit } = listQuery.parse(request.query)

    const { notifications, unreadCount } = await useCases.listNotifications.execute({ recipientId, limit })

    return { notifications: notifications.map(presentNotification), unreadCount }
  })

  app.patch('/notifications/:id/read', async (request) => {
    const { id } = idParams.parse(request.params)
    const { recipientId } = recipientBody.parse(request.body)

    const { notification } = await useCases.markNotificationRead.execute({
      notificationId: id,
      recipientId,
      now: clock(),
    })

    return { notification: presentNotification(notification) }
  })

  app.patch('/notifications/read-all', async (request) => {
    const { recipientId } = recipientBody.parse(request.body)

    return useCases.markAllNotificationsRead.execute({ recipientId, now: clock() })
  })
}
