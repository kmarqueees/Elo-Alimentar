import { FoodBatch, type RegisterFoodBatchInput } from '@/domain/food-batch/food-batch'
import {
  Institution,
  type RegisterInstitutionInput,
} from '@/domain/institution/institution'
import type { FoodType, StorageCondition } from '@/domain/shared/food'

const CENTER = { latitude: -3.119, longitude: -60.0217 }
const SPREAD_DEG = 0.09

export const SCENARIO_NOW = new Date('2026-10-16T12:00:00Z')

const INSTITUTION_NAMES = [
  'Cozinha Comunitária Esperança',
  'ONG Mesa Solidária',
  'Abrigo Nova Vida',
  'Banco de Alimentos Rio Negro',
  'Casa de Apoio Santa Luzia',
]

export const TOTAL_BATCHES = 20
export const TOTAL_INSTITUTIONS = 5
const INSTITUTIONS_WITH_REFRIGERATION = 2

function makeRandom(seed: number) {
  let a = seed >>> 0

  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pick<T>(random: () => number, items: T[]): T {
  return items[Math.floor(random() * items.length)]!
}

function randomPoint(random: () => number) {
  return {
    latitude: CENTER.latitude + (random() * 2 - 1) * SPREAD_DEG,
    longitude: CENTER.longitude + (random() * 2 - 1) * SPREAD_DEG,
  }
}

const ALL_FOOD_TYPES: FoodType[] = [
  'HORTIFRUTI',
  'PANIFICADOS',
  'PRATOS_PRONTOS',
  'LATICINIOS',
  'CARNES',
  'NAO_PERECIVEIS',
]

const FOOD_BY_STORAGE: Record<StorageCondition, FoodType[]> = {
  REFRIGERATED: ['HORTIFRUTI', 'LATICINIOS', 'PRATOS_PRONTOS'],
  FROZEN: ['CARNES'],
  DRY: ['PANIFICADOS', 'NAO_PERECIVEIS'],
}

const EXPIRY_HOURS = [1, 2, 3, 6, 12, 24, 48, 72]

export interface ScenarioInstitution extends RegisterInstitutionInput {
  acceptedFoodTypes: FoodType[]
  validated: boolean
}

export type ScenarioBatch = RegisterFoodBatchInput

export interface Scenario {
  institutions: ScenarioInstitution[]
  batches: ScenarioBatch[]
}

/** Cria a instituição pelo fluxo do domínio (cadastro + validação do admin). */
export function institutionFromScenario(data: ScenarioInstitution) {
  const institution = Institution.register(data)

  if (data.validated) {
    institution.validate()
  }

  return institution
}

/** Cria o lote pelo fluxo do domínio, como se cadastrado no instante `now`. */
export function batchFromScenario(data: ScenarioBatch, now: Date = SCENARIO_NOW) {
  return FoodBatch.register(data, now)
}

export function generateScenario(seed: number): Scenario {
  const random = makeRandom(seed)

  const institutions: ScenarioInstitution[] = []
  const batches: ScenarioBatch[] = []

  for (let i = 0; i < TOTAL_INSTITUTIONS; i++) {
    institutions.push({
      name: INSTITUTION_NAMES[i] ?? `Instituição ${i + 1}`,
      ...randomPoint(random),
      hasRefrigeration: i < INSTITUTIONS_WITH_REFRIGERATION,
      availableCapacityKg: Math.round(20 + random() * 130),
      acceptedFoodTypes: random() < 0.4 ? [] : [pick(random, ALL_FOOD_TYPES)],
      validated: true,
    })
  }

  for (let i = 0; i < TOTAL_BATCHES; i++) {
    const roll = random()
    const storageCondition: StorageCondition =
      roll < 0.45 ? 'REFRIGERATED' : roll < 0.55 ? 'FROZEN' : 'DRY'

    batches.push({
      donorId: `donor-${i + 1}`,
      foodType: pick(random, FOOD_BY_STORAGE[storageCondition]),
      quantityKg: Math.round(5 + random() * 55),
      expiresAt: new Date(
        SCENARIO_NOW.getTime() + pick(random, EXPIRY_HOURS) * 3600_000,
      ),
      storageCondition,
      ...randomPoint(random),
    })
  }

  return { institutions, batches }
}
