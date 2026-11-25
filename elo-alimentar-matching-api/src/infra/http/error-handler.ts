import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify'
import { ZodError } from 'zod'
import {
  BusinessRuleViolationError,
  InvalidValueError,
  NotAllowedError,
} from '@/core/errors/domain-error'
import { ExternalServiceUnavailableError } from '@/core/errors/external-service-unavailable-error'
import { ResourceNotFoundError } from '@/core/errors/resource-not-found-error'

type ErrorClass = abstract new (...args: never[]) => Error

/**
 * Mapeia por categoria: um erro novo de domínio já sai com o status certo
 * sem precisar ser registrado aqui.
 */
const STATUS_BY_ERROR_CATEGORY: [ErrorClass, number][] = [
  [InvalidValueError, 400],
  [NotAllowedError, 403],
  [ResourceNotFoundError, 404],
  [BusinessRuleViolationError, 409],
]

export function errorHandler(
  error: FastifyError | Error,
  _request: FastifyRequest,
  reply: FastifyReply,
) {
  if (error instanceof ZodError) {
    return reply.status(400).send({
      message: 'Validation error.',
      issues: error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    })
  }

  const category = STATUS_BY_ERROR_CATEGORY.find(
    ([ErrorType]) => error instanceof ErrorType,
  )

  if (category) {
    return reply.status(category[1]).send({ message: error.message })
  }

  if (error instanceof ExternalServiceUnavailableError) {
    console.error(error)

    return reply.status(503).send({ message: error.message })
  }

  const statusCode = (error as { statusCode?: number }).statusCode

  if (statusCode && statusCode >= 400 && statusCode < 500) {
    return reply.status(statusCode).send({ message: error.message })
  }

  console.error(error)

  return reply.status(500).send({ message: 'Internal server error.' })
}
