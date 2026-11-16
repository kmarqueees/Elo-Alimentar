import type { FoodType, StorageCondition, BatchStatus } from './api'

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
  AVAILABLE: 'Disponível',
  RESERVED: 'Reservado',
  COLLECTED: 'Retirado',
  EXPIRED: 'Expirado',
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
