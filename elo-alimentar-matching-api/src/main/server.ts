import { env } from '@/infra/env'
import { prisma } from '@/infra/database/prisma/client'
import { PrismaDonorsRepository } from '@/infra/database/prisma/repositories/prisma-donors-repository'
import { PrismaFoodBatchesRepository } from '@/infra/database/prisma/repositories/prisma-food-batches-repository'
import { PrismaInstitutionsRepository } from '@/infra/database/prisma/repositories/prisma-institutions-repository'
import { PrismaNotificationsRepository } from '@/infra/database/prisma/repositories/prisma-notifications-repository'
import { makeApp } from './make-app'

const { app } = makeApp({
  batchesRepository: new PrismaFoodBatchesRepository(prisma),
  institutionsRepository: new PrismaInstitutionsRepository(prisma),
  donorsRepository: new PrismaDonorsRepository(prisma),
  notificationsRepository: new PrismaNotificationsRepository(prisma),
  offerTimeoutMinutes: env.OFFER_TIMEOUT_MINUTES,
  offerQueueIntervalMs: env.OFFER_QUEUE_INTERVAL_MS,
  geocoderUserAgent: env.GEOCODER_USER_AGENT,
})

app
  .listen({ port: env.PORT })
  .then(() => console.log(`Elo Alimentar (PostgreSQL) em http://localhost:${env.PORT}`))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
