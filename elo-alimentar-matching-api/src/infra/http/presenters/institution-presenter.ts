import type { Institution } from '@/domain/institution/institution'

const round = (value: number, digits: number) => {
  const factor = 10 ** digits

  return Math.round(value * factor) / factor
}

/** Estoque e dias de estoque são estimados no instante `now`. */
export function presentInstitution(institution: Institution, now: Date) {
  const stockDays = institution.stockDays(now)

  return {
    id: institution.id,
    name: institution.name,
    latitude: institution.latitude,
    longitude: institution.longitude,
    hasRefrigeration: institution.hasRefrigeration,
    storageCapacityKg: institution.storageCapacityKg,
    peopleServed: institution.peopleServed,
    dailyConsumptionKg: round(institution.dailyConsumptionKg(), 1),
    estimatedStockKg: round(institution.estimatedStockKg(now), 1),
    /** null quando o consumo é desconhecido (pessoas atendidas = 0). */
    stockDays: Number.isFinite(stockDays) ? round(stockDays, 1) : null,
    stockUpdatedAt: institution.stockUpdatedAt,
    acceptedFoodTypes: institution.acceptedFoodTypes,
    validated: institution.validated,
  }
}
