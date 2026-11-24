import { CompareStrategiesUseCase } from '@/application/evaluation/compare-strategies'
import { DistanceOnlyStrategy } from '@/domain/matching/strategies/distance-only-strategy'
import { MultiCriteriaStrategy } from '@/domain/matching/strategies/multi-criteria-strategy'
import { InMemoryFoodBatchesRepository } from '@/infra/database/in-memory/in-memory-food-batches-repository'
import { InMemoryInstitutionsRepository } from '@/infra/database/in-memory/in-memory-institutions-repository'
import {
  SCENARIO_NOW,
  TOTAL_BATCHES,
  TOTAL_INSTITUTIONS,
  batchFromScenario,
  generateScenario,
  institutionFromScenario,
} from './scenario'

async function runScenario(seed: number) {
  const { institutions, batches } = generateScenario(seed)
  const batchesRepository = new InMemoryFoodBatchesRepository()
  const institutionsRepository = new InMemoryInstitutionsRepository()

  for (const institution of institutions) {
    await institutionsRepository.create(institutionFromScenario(institution))
  }

  for (const batch of batches) {
    await batchesRepository.create(batchFromScenario(batch))
  }

  const useCase = new CompareStrategiesUseCase(
    batchesRepository,
    institutionsRepository,
    [new DistanceOnlyStrategy(), new MultiCriteriaStrategy()],
  )

  return useCase.execute({ now: SCENARIO_NOW })
}

const pct = (value: number) => `${(value * 100).toFixed(1)}%`
const min = (value: number | null) =>
  value === null ? '—' : `${value.toFixed(1)} min`

async function main() {
  const main = await runScenario(42)

  console.log('='.repeat(72))
  console.log(
    `CENÁRIO PRINCIPAL — ${TOTAL_BATCHES} lotes, ${TOTAL_INSTITUTIONS} instituições (2 com refrigeração), semente 42`,
  )
  console.log('='.repeat(72))

  for (const s of main.summaries) {
    console.log(`\n${s.strategy}`)
    console.log(`  Lotes aproveitados:        ${s.collectedBatches}/${s.totalBatches} (${pct(s.collectionRate)})`)
    console.log(`  1ª indicação era viável:   ${pct(s.firstChoiceViableRate)}`)
    console.log(`  Tentativas por lote:       ${s.averageAttempts?.toFixed(2) ?? '—'}`)
    console.log(`  Tempo médio até retirada:  ${min(s.averageMinutesToPickup)}`)
  }

  console.log(
    `\nRedução do tempo até a retirada (só lotes retirados pelas duas estratégias, n=${main.commonCollectedBatches}): ` +
      (main.timeReductionPercent === null ? '—' : `${main.timeReductionPercent.toFixed(1)}%`),
  )

  const RUNS = 500
  const acc = {
    base: { rate: 0, viable: 0 },
    multi: { rate: 0, viable: 0 },
    reduction: [] as number[],
  }

  for (let seed = 1; seed <= RUNS; seed++) {
    const r = await runScenario(seed)
    const [base, multi] = r.summaries as [typeof r.summaries[0], typeof r.summaries[0]]

    acc.base.rate += base.collectionRate
    acc.base.viable += base.firstChoiceViableRate
    acc.multi.rate += multi.collectionRate
    acc.multi.viable += multi.firstChoiceViableRate

    if (r.timeReductionPercent !== null) {
      acc.reduction.push(r.timeReductionPercent)
    }
  }

  const meanReduction =
    acc.reduction.reduce((s, v) => s + v, 0) / (acc.reduction.length || 1)

  console.log('\n' + '='.repeat(72))
  console.log(`REPETIÇÃO — ${RUNS} cenários aleatórios (sementes 1 a ${RUNS}), mesmas premissas`)
  console.log('='.repeat(72))
  console.log(`Somente distância:  aproveitamento médio ${pct(acc.base.rate / RUNS)}, 1ª indicação viável ${pct(acc.base.viable / RUNS)}`)
  console.log(`Multicritério:      aproveitamento médio ${pct(acc.multi.rate / RUNS)}, 1ª indicação viável ${pct(acc.multi.viable / RUNS)}`)
  console.log(`Redução média do tempo até a retirada: ${meanReduction.toFixed(1)}% (em ${acc.reduction.length}/${RUNS} cenários com lotes em comum)`)
  console.log(
    '\nObs.: dados sintéticos e tempo modelado (timeout de 30 min por tentativa inviável).',
  )
}

main()
