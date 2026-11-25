import { env } from '@/infra/env'
import { InMemoryDonorsRepository } from '@/infra/database/in-memory/in-memory-donors-repository'
import { InMemoryFoodBatchesRepository } from '@/infra/database/in-memory/in-memory-food-batches-repository'
import { InMemoryInstitutionsRepository } from '@/infra/database/in-memory/in-memory-institutions-repository'
import { InMemoryNotificationsRepository } from '@/infra/database/in-memory/in-memory-notifications-repository'
import {
  SCENARIO_NOW,
  batchFromScenario,
  generateScenario,
  institutionFromScenario,
} from '@/simulation/scenario'
import { makeApp } from './make-app'

const batchesRepository = new InMemoryFoodBatchesRepository()
const institutionsRepository = new InMemoryInstitutionsRepository()
const donorsRepository = new InMemoryDonorsRepository()
const notificationsRepository = new InMemoryNotificationsRepository()

async function main() {
  const { institutions, batches } = generateScenario(42)
  const now = new Date()

  for (const institution of institutions) {
    await institutionsRepository.create(institutionFromScenario(institution, now))
  }

  const shiftMs = now.getTime() - SCENARIO_NOW.getTime()

  for (const [index, batch] of batches.entries()) {
    await batchesRepository.create(
      batchFromScenario(
        {
          ...batch,
          donorId: `00000000-0000-4000-8000-${String((index % 4) + 1).padStart(12, '0')}`,
          expiresAt: new Date(batch.expiresAt.getTime() + shiftMs),
        },
        now,
      ),
    )
  }

  const { app } = makeApp({
    batchesRepository,
    institutionsRepository,
    donorsRepository,
    notificationsRepository,
    offerTimeoutMinutes: env.OFFER_TIMEOUT_MINUTES,
    offerQueueIntervalMs: env.OFFER_QUEUE_INTERVAL_MS,
    geocoderUserAgent: env.GEOCODER_USER_AGENT,
  })

  await app.listen({ port: env.PORT })

  console.log(`Elo Alimentar (EM MEMÓRIA, sem banco) em http://localhost:${env.PORT}`)
  console.log(
    `Cenário carregado: ${institutions.length} instituições e ${batches.length} lotes. Dados somem ao reiniciar.`,
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
