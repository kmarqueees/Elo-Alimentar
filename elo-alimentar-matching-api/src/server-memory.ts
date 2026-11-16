import { buildApp } from './http/app'
import { InMemoryFoodBatchesRepository } from './repositories/in-memory/in-memory-food-batches-repository'
import { InMemoryReservationsRepository } from './repositories/in-memory/in-memory-reservations-repository'
import { InMemoryInstitutionsRepository } from './repositories/in-memory/in-memory-institutions-repository'
import { SCENARIO_NOW, generateScenario } from './simulation/scenario'

const port = Number(process.env.PORT ?? 3333)

const batchesRepository = new InMemoryFoodBatchesRepository()
const institutionsRepository = new InMemoryInstitutionsRepository()
const reservationsRepository = new InMemoryReservationsRepository(batchesRepository)

async function main() {
  const { institutions, batches } = generateScenario(42)

  for (const institution of institutions) {
    await institutionsRepository.create(institution)
  }

  const shiftMs = Date.now() - SCENARIO_NOW.getTime()

  for (const [index, batch] of batches.entries()) {
    await batchesRepository.create({
      ...batch,
      donorId: `00000000-0000-4000-8000-${String((index % 4) + 1).padStart(12, '0')}`,
      expiresAt: new Date(batch.expiresAt.getTime() + shiftMs),
    })
  }

  const app = buildApp({
    batchesRepository,
    institutionsRepository,
    reservationsRepository,
    reservationTimeoutMinutes: Number(process.env.RESERVATION_TIMEOUT_MINUTES ?? 30),
    reservationSweepIntervalMs: 15_000,
  })

  await app.listen({ port })

  console.log(`Elo Alimentar (EM MEMÓRIA, sem banco) em http://localhost:${port}`)
  console.log(
    `Cenário carregado: ${institutions.length} instituições e ${batches.length} lotes. Dados somem ao reiniciar.`,
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
