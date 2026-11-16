export type FoodType =
  | 'HORTIFRUTI'
  | 'PANIFICADOS'
  | 'PRATOS_PRONTOS'
  | 'LATICINIOS'
  | 'CARNES'
  | 'NAO_PERECIVEIS'
export type StorageCondition = 'REFRIGERATED' | 'FROZEN' | 'DRY'
export type BatchStatus = 'AVAILABLE' | 'RESERVED' | 'COLLECTED' | 'EXPIRED'
export type ReservationStatus = 'PENDING' | 'CONFIRMED' | 'EXPIRED' | 'CANCELLED'
export type StrategyKey = 'multicriteria' | 'distance'

export interface Batch {
  id: string
  donorId: string
  foodType: FoodType
  quantityKg: number
  expiresAt: string
  storageCondition: StorageCondition
  latitude: number
  longitude: number
  status: BatchStatus
  createdAt: string
}

export interface Institution {
  id: string
  name: string
  latitude: number
  longitude: number
  hasRefrigeration: boolean
  availableCapacityKg: number
  acceptedFoodTypes: FoodType[]
  validated: boolean
}

export interface RankItem {
  position: number
  institution: { id: string; name: string }
  score: number
  distanceKm: number
  travelMinutes: number
  criteria: { proximity: number; urgency: number; compatibility: number }
}

export interface MatchesResponse {
  strategy: StrategyKey
  now: string
  hoursUntilExpiry: number
  batch: Batch
  ranking: RankItem[]
}

export interface Reservation {
  id: string
  batchId: string
  institutionId: string
  score: number
  status: ReservationStatus
  createdAt: string
  expiresAt: string
  confirmedAt: string | null
}

export interface StrategySummary {
  strategy: string
  collectedBatches: number
  totalBatches: number
  collectionRatePercent: number
  firstChoiceViablePercent: number
  averageAttempts: number | null
  averageMinutesToPickup: number | null
}

export interface ComparisonResponse {
  baseline: string
  strategies: StrategySummary[]
  timeReductionPercent: number | null
  commonCollectedBatches: number
  note: string
}

export interface CreateBatchBody {
  donorId: string
  foodType: FoodType
  quantityKg: number
  expiresAt: string
  storageCondition: StorageCondition
  latitude: number
  longitude: number
}

export const DEMO_DONOR_ID = '00000000-0000-4000-8000-000000000001'

const DEFAULT_API = import.meta.env.VITE_API_URL ?? 'http://localhost:3333'

export function getApiUrl(): string {
  try {
    return (localStorage.getItem('elo.api') ?? DEFAULT_API).replace(/\/$/, '')
  } catch {
    return DEFAULT_API
  }
}

export function setApiUrl(url: string) {
  try {
    localStorage.setItem('elo.api', url.trim() || DEFAULT_API)
  } catch {}
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

const MESSAGES: Record<string, string> = {
  'Batch is not available for matching.': 'Este lote não está mais disponível (já foi reservado ou retirado).',
  'Institution is not eligible for this batch.': 'Esta instituição não atende às regras do lote (refrigeração, raio ou validade) ou já foi recusada nele.',
  'Reservation is not in a state that allows this action.': 'A reserva não está em um estado que permita esta ação.',
  'Reservation has expired.': 'O prazo de confirmação desta reserva acabou.',
  'Resource not found.': 'Não encontrado.',
  'Batch expiration date must be in the future.': 'A validade precisa ser uma data futura.',
  'Batch quantity must be greater than zero.': 'A quantidade precisa ser maior que zero.',
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response

  try {
    response = await fetch(getApiUrl() + path, init)
  } catch {
    throw new ApiError('Não consegui falar com a API. Ela está no ar?', 0)
  }

  const body = (await response.json().catch(() => ({}))) as { message?: string }

  if (!response.ok) {
    const raw = body.message ?? `Erro ${response.status}`

    throw new ApiError(MESSAGES[raw] ?? raw, response.status)
  }

  return body as T
}

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
  body: body === undefined ? undefined : JSON.stringify(body),
})

export const api = {
  health: () => request<{ status: string }>('/health'),
  listBatches: (status: BatchStatus | 'ALL' = 'ALL') =>
    request<{ batches: Batch[] }>(`/batches?status=${status}`).then((r) => r.batches),
  getBatch: (id: string) => request<{ batch: Batch }>(`/batches/${id}`).then((r) => r.batch),
  createBatch: (body: CreateBatchBody) =>
    request<{ batch: Batch }>('/batches', json('POST', body)).then((r) => r.batch),
  listInstitutions: () =>
    request<{ institutions: Institution[] }>('/institutions').then((r) => r.institutions),
  matches: (batchId: string, strategy: StrategyKey) =>
    request<MatchesResponse>(`/batches/${batchId}/matches?strategy=${strategy}`),
  comparison: () => request<ComparisonResponse>('/comparison'),
  reservations: (batchId: string) =>
    request<{ reservations: Reservation[] }>(`/batches/${batchId}/reservations`).then(
      (r) => r.reservations,
    ),
  reserve: (batchId: string, institutionId: string) =>
    request<{ reservation: Reservation }>(
      `/batches/${batchId}/reservations`,
      json('POST', { institutionId }),
    ).then((r) => r.reservation),
  confirm: (id: string) => request(`/reservations/${id}/confirm`, json('PATCH')),
  reject: (id: string) => request(`/reservations/${id}/reject`, json('PATCH')),
  pickup: (id: string) => request(`/reservations/${id}/pickup`, json('PATCH')),
}
