import type { FoodType, StorageCondition, BatchStatus, OfferStatus } from './api'

export const FOOD_LABEL: Record<FoodType, string> = {
  HORTIFRUTI: 'Hortifruti',
  PANIFICADOS: 'Panificados',
  PRATOS_PRONTOS: 'Pratos prontos',
  LATICINIOS: 'Laticínios',
  CARNES: 'Carnes',
  NAO_PERECIVEIS: 'Não perecíveis',
}

export const FOOD_ICON: Record<FoodType, string> = {
  HORTIFRUTI: '🥦',
  PANIFICADOS: '🍞',
  PRATOS_PRONTOS: '🍲',
  LATICINIOS: '🧀',
  CARNES: '🥩',
  NAO_PERECIVEIS: '🥫',
}

export const STORAGE_LABEL: Record<StorageCondition, string> = {
  REFRIGERATED: 'Refrigerado',
  FROZEN: 'Congelado',
  DRY: 'Seco / ambiente',
}

export const STATUS_LABEL: Record<BatchStatus, string> = {
  AVAILABLE: 'Aguardando instituição',
  OFFERED: 'Oferecido',
  RESERVED: 'Aceito — aguardando retirada',
  COLLECTED: 'Retirado',
  EXPIRED: 'Vencido',
}

/** Status da oferta do ponto de vista da instituição que a recebeu. */
export const OFFER_LABEL: Record<OfferStatus, string> = {
  PENDING: 'Aguardando sua resposta',
  ACCEPTED: 'Aceita por você',
  DECLINED: 'Recusada por você',
  EXPIRED: 'Prazo esgotado',
}

const nf = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })

export const num = (value: number) => nf.format(value)
export const points = (score: number) => Math.round(score * 100)

export function hoursLeft(expiresAt: string, now = Date.now()) {
  return (new Date(expiresAt).getTime() - now) / 3_600_000
}

export function formatHours(hours: number) {
  if (hours <= 0) return 'vencido'
  if (hours < 1) return `${Math.round(hours * 60)} min`
  if (hours < 48) return `${num(hours)} h`
  return `${num(hours / 24)} dias`
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatCountdown(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(total / 60)
  const seconds = String(total % 60).padStart(2, '0')

  return `${minutes}:${seconds}`
}

/** Distância em linha reta entre dois pontos, em km (fórmula de haversine). */
export function distanceKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const rad = (deg: number) => (deg * Math.PI) / 180
  const dLat = rad(b.latitude - a.latitude)
  const dLng = rad(b.longitude - a.longitude)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2

  return 6371 * 2 * Math.asin(Math.sqrt(h))
}

export function formatDateTimeLong(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}
