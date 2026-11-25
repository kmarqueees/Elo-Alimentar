import type {
  Prisma,
  FoodBatch as PrismaFoodBatch,
  Offer as PrismaOffer,
} from '@prisma/client'
import { FoodBatch } from '@/domain/food-batch/food-batch'
import { Offer } from '@/domain/food-batch/offer'
import { Address } from '@/domain/shared/address'
import { Coordinates } from '@/domain/shared/coordinates'

export type PrismaFoodBatchWithOffers = PrismaFoodBatch & {
  offers: PrismaOffer[]
}

/** Carrega sempre o agregado completo, com as ofertas em ordem de criação. */
export const includeOffers = {
  offers: { orderBy: { created_at: 'asc' } },
} satisfies Prisma.FoodBatchInclude

export class PrismaFoodBatchMapper {
  static toDomain(row: PrismaFoodBatchWithOffers) {
    return FoodBatch.restore(
      {
        donorId: row.donor_id,
        foodType: row.food_type,
        quantityKg: row.quantity_kg,
        expiresAt: row.expires_at,
        storageCondition: row.storage_condition,
        coordinates: Coordinates.create(row.latitude, row.longitude),
        address: addressFromRow(row),
        status: row.status,
        createdAt: row.created_at,
        offers: row.offers.map(PrismaOfferMapper.toDomain),
      },
      row.id,
    )
  }

  static toPersistence(batch: FoodBatch): Prisma.FoodBatchUncheckedCreateInput {
    return {
      id: batch.id,
      donor_id: batch.donorId,
      food_type: batch.foodType,
      quantity_kg: batch.quantityKg,
      expires_at: batch.expiresAt,
      storage_condition: batch.storageCondition,
      latitude: batch.latitude,
      longitude: batch.longitude,
      address_street: batch.address?.street ?? null,
      address_number: batch.address?.number ?? null,
      address_complement: batch.address?.complement ?? null,
      address_district: batch.address?.district ?? null,
      address_city: batch.address?.city ?? null,
      address_state: batch.address?.state ?? null,
      address_postal_code: batch.address?.postalCode ?? null,
      status: batch.status,
      created_at: batch.createdAt,
    }
  }
}

function addressFromRow(row: PrismaFoodBatch) {
  if (!row.address_street || !row.address_number || !row.address_city || !row.address_state) {
    return null
  }

  return Address.create({
    street: row.address_street,
    number: row.address_number,
    complement: row.address_complement,
    district: row.address_district,
    city: row.address_city,
    state: row.address_state,
    postalCode: row.address_postal_code,
  })
}

export class PrismaOfferMapper {
  static toDomain(row: PrismaOffer) {
    return Offer.restore(
      {
        batchId: row.batch_id,
        institutionId: row.institution_id,
        score: row.score,
        status: row.status,
        createdAt: row.created_at,
        expiresAt: row.expires_at,
        respondedAt: row.responded_at,
        remindedAt: row.reminded_at,
      },
      row.id,
    )
  }

  static toPersistence(offer: Offer): Prisma.OfferUncheckedCreateInput {
    return {
      id: offer.id,
      batch_id: offer.batchId,
      institution_id: offer.institutionId,
      score: offer.score,
      status: offer.status,
      created_at: offer.createdAt,
      expires_at: offer.expiresAt,
      responded_at: offer.respondedAt,
      reminded_at: offer.remindedAt,
    }
  }
}
