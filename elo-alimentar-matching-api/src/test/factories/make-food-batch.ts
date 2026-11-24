import { FoodBatch, type BatchStatus } from '@/domain/food-batch/food-batch'
import type { Offer } from '@/domain/food-batch/offer'
import { Coordinates } from '@/domain/shared/coordinates'
import type { FoodType, StorageCondition } from '@/domain/shared/food'

export interface MakeFoodBatchOverrides {
  id?: string
  donorId?: string
  foodType?: FoodType
  quantityKg?: number
  expiresAt?: Date
  storageCondition?: StorageCondition
  latitude?: number
  longitude?: number
  status?: BatchStatus
  createdAt?: Date
  offers?: Offer[]
}

/**
 * Lote pronto para testes, montado como se viesse do banco: não valida a
 * data de validade contra o relógio real (os cenários usam datas fixas).
 */
export function makeFoodBatch({
  id,
  latitude = -3.1,
  longitude = -60.0,
  ...overrides
}: MakeFoodBatchOverrides = {}) {
  return FoodBatch.restore(
    {
      donorId: 'donor-01',
      foodType: 'HORTIFRUTI',
      quantityKg: 18,
      expiresAt: new Date('2026-10-16T14:00:00Z'),
      storageCondition: 'REFRIGERATED',
      status: 'AVAILABLE',
      createdAt: new Date('2026-10-16T10:00:00Z'),
      offers: [],
      ...overrides,
      coordinates: Coordinates.create(latitude, longitude),
    },
    id ?? crypto.randomUUID(),
  )
}
