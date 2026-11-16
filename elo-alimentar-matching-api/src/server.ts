import 'dotenv/config'
import { prisma } from './lib/prisma'
import { buildApp } from './http/app'
import { PrismaFoodBatchesRepository } from './repositories/prisma/prisma-food-batches-repository'
import { PrismaReservationsRepository } from './repositories/prisma/prisma-reservations-repository'
import { PrismaInstitutionsRepository } from './repositories/prisma/prisma-institutions-repository'

const port = Number(process.env.PORT ?? 3333)

const app = buildApp({
  batchesRepository: new PrismaFoodBatchesRepository(prisma),
  institutionsRepository: new PrismaInstitutionsRepository(prisma),
  reservationsRepository: new PrismaReservationsRepository(prisma),
  reservationTimeoutMinutes: Number(process.env.RESERVATION_TIMEOUT_MINUTES ?? 30),
  reservationSweepIntervalMs: 15_000,
})

app
  .listen({ port })
  .then(() => console.log(`Elo Alimentar (PostgreSQL) em http://localhost:${port}`))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
