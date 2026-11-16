import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify'
import { ZodError } from 'zod'
import { BatchAlreadyExpiredError } from '@/use-cases/errors/batch-already-expired-error'
import { BatchNotAvailableError } from '@/use-cases/errors/batch-not-available-error'
import { InvalidBatchQuantityError } from '@/use-cases/errors/invalid-batch-quantity-error'
import { InvalidCapacityError } from '@/use-cases/errors/invalid-capacity-error'
import { InstitutionNotEligibleError } from '@/use-cases/errors/institution-not-eligible-error'
import { InvalidReservationStateError } from '@/use-cases/errors/invalid-reservation-state-error'
import { ReservationExpiredError } from '@/use-cases/errors/reservation-expired-error'
import { InvalidCoordinatesError } from '@/use-cases/errors/invalid-coordinates-error'
import { ResourceNotFoundError } from '@/use-cases/errors/resource-not-found-error'

type ErrorClass = abstract new (...args: never[]) => Error

const STATUS_BY_DOMAIN_ERROR: [ErrorClass, number][] = [
  [BatchAlreadyExpiredError, 400],
  [InvalidBatchQuantityError, 400],
  [InvalidCapacityError, 400],
  [InvalidCoordinatesError, 400],
  [ResourceNotFoundError, 404],
  [BatchNotAvailableError, 409],
  [InstitutionNotEligibleError, 409],
  [InvalidReservationStateError, 409],
  [ReservationExpiredError, 409],
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

  const domainError = STATUS_BY_DOMAIN_ERROR.find(
    ([ErrorType]) => error instanceof ErrorType,
  )

  if (domainError) {
    return reply.status(domainError[1]).send({ message: error.message })
  }

  const statusCode = (error as { statusCode?: number }).statusCode

  if (statusCode && statusCode >= 400 && statusCode < 500) {
    return reply.status(statusCode).send({ message: error.message })
  }

  console.error(error)

  return reply.status(500).send({ message: 'Internal server error.' })
}
