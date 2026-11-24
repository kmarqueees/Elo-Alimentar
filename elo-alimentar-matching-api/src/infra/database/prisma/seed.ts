import {
  SCENARIO_NOW,
  batchFromScenario,
  generateScenario,
  institutionFromScenario,
} from '@/simulation/scenario'
import { prisma } from './client'
import { PrismaFoodBatchesRepository } from './repositories/prisma-food-batches-repository'
import { PrismaInstitutionsRepository } from './repositories/prisma-institutions-repository'

const PLACEHOLDER_HASH = 'SEED_PLACEHOLDER_NOT_A_VALID_HASH'
const DONORS = 4

function demoDonorId(n: number) {
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Seed bloqueado em produção.')
  }

  await prisma.offer.deleteMany()
  await prisma.foodBatch.deleteMany()
  await prisma.institution.deleteMany()
  await prisma.user.deleteMany()

  await prisma.user.create({
    data: {
      name: 'Administrador',
      email: 'admin@elo-alimentar.test',
      password_hash: PLACEHOLDER_HASH,
      role: 'ADMIN',
    },
  })

  const donors = []

  for (let i = 1; i <= DONORS; i++) {
    donors.push(
      await prisma.user.create({
        data: {
          id: demoDonorId(i),
          name: `Doador ${i}`,
          email: `doador${i}@elo-alimentar.test`,
          password_hash: PLACEHOLDER_HASH,
          role: 'DONOR',
        },
      }),
    )
  }

  const { institutions, batches } = generateScenario(42)
  const institutionsRepository = new PrismaInstitutionsRepository(prisma)
  const batchesRepository = new PrismaFoodBatchesRepository(prisma)

  for (const institution of institutions) {
    await institutionsRepository.create(institutionFromScenario(institution))
  }

  const now = new Date()
  const shiftMs = now.getTime() - SCENARIO_NOW.getTime()

  for (const [index, batch] of batches.entries()) {
    await batchesRepository.create(
      batchFromScenario(
        {
          ...batch,
          expiresAt: new Date(batch.expiresAt.getTime() + shiftMs),
          donorId: donors[index % donors.length]!.id,
        },
        now,
      ),
    )
  }

  console.log(
    `Seed concluído: ${institutions.length} instituições, ${batches.length} lotes, ${DONORS} doadores e 1 administrador.`,
  )
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
