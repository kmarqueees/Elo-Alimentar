export type FoodType =
  | 'HORTIFRUTI'
  | 'PANIFICADOS'
  | 'PRATOS_PRONTOS'
  | 'LATICINIOS'
  | 'CARNES'
  | 'NAO_PERECIVEIS'
export type StorageCondition = 'REFRIGERATED' | 'FROZEN' | 'DRY'
/** AVAILABLE: sem oferta ativa · OFFERED: oferecido, aguardando resposta · RESERVED: aceito */
export type BatchStatus = 'AVAILABLE' | 'OFFERED' | 'RESERVED' | 'COLLECTED' | 'EXPIRED'
export type OfferStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED'
export type StrategyKey = 'multicriteria' | 'distance'

export interface BatchAddress {
  street: string
  number: string
  complement: string | null
  district: string | null
  city: string
  state: string
  /** Com máscara: 69005-040. */
  postalCode: string | null
  /** Endereço completo numa linha, pronto para exibir. */
  formatted: string
}

export interface AddressInput {
  street: string
  number: string
  complement?: string | null
  district?: string | null
  city: string
  state: string
  postalCode?: string | null
}

/** Resultado da busca por CEP (ViaCEP): sem coordenadas. */
export interface PostalCodeAddress {
  postalCode: string
  street: string
  district: string
  city: string
  state: string
}

/** Endereço encontrado no mapa (Nominatim). */
export interface GeocodedAddress {
  label: string
  latitude: number
  longitude: number
  street: string | null
  number: string | null
  district: string | null
  city: string | null
  state: string | null
  postalCode: string | null
}

export type NotificationType =
  | 'OFFER_RECEIVED'
  | 'OFFER_REMINDER'
  | 'OFFER_TIMED_OUT'
  | 'OFFER_ACCEPTED'
  | 'OFFER_DECLINED'
  | 'OFFER_EXPIRED'
  | 'WAITING_FOR_INSTITUTION'
  | 'DONATION_COLLECTED'
  | 'BATCH_EXPIRED'

export interface AppNotification {
  id: string
  type: NotificationType
  title: string
  message: string
  batchId: string | null
  offerId: string | null
  createdAt: string
  readAt: string | null
}

export interface Batch {
  id: string
  donorId: string
  foodType: FoodType
  quantityKg: number
  expiresAt: string
  storageCondition: StorageCondition
  latitude: number
  longitude: number
  address: BatchAddress | null
  status: BatchStatus
  createdAt: string
}

export interface Institution {
  id: string
  name: string
  latitude: number
  longitude: number
  hasRefrigeration: boolean
  /** Capacidade total de armazenamento (kg). */
  storageCapacityKg: number
  /** Pessoas atendidas por dia (0 = não informado). */
  peopleServed: number
  dailyConsumptionKg: number
  /** Estoque estimado agora: último informado − consumo + doações retiradas. */
  estimatedStockKg: number
  /** Para quantos dias o estoque dá (null se o consumo não é conhecido). */
  stockDays: number | null
  stockUpdatedAt: string
  acceptedFoodTypes: FoodType[]
  validated: boolean
}

export interface RankItem {
  position: number
  institution: { id: string; name: string }
  score: number
  distanceKm: number
  travelMinutes: number
  /** need = necessidade da instituição (1 = estoque acabando). */
  criteria: { proximity: number; urgency: number; need: number; compatibility: number }
}

export interface MatchesResponse {
  strategy: StrategyKey
  now: string
  hoursUntilExpiry: number
  batch: Batch
  ranking: RankItem[]
}

/** Oferta de um lote a uma instituição (visão do doador, com a nota do ranking). */
export interface Offer {
  id: string
  batchId: string
  institutionId: string
  score: number
  status: OfferStatus
  createdAt: string
  expiresAt: string
  respondedAt: string | null
}

/** Visão da instituição: a oferta sem a nota, junto com o lote. */
export interface InstitutionOffer {
  offer: Omit<Offer, 'score'>
  batch: Batch
}

export interface CreateBatchBody {
  donorId: string
  foodType: FoodType
  quantityKg: number
  expiresAt: string
  storageCondition: StorageCondition
  latitude: number
  longitude: number
  address?: AddressInput
}

/** Endereço da API, definido por VITE_API_URL no build. */
const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:3333').replace(/\/$/, '')

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

const MESSAGES: Record<string, string> = {
  'Batch is not available for matching.': 'Este lote não está mais disponível (já foi aceito, retirado ou venceu).',
  'Offer is not in a state that allows this action.': 'Esta oferta não está em um estado que permita esta ação.',
  'Offer has expired.': 'O prazo para responder a esta oferta acabou. O lote seguiu para a próxima instituição.',
  'This offer was made to another institution.': 'Esta oferta foi feita para outra instituição.',
  'This notification belongs to someone else.': 'Esta notificação pertence a outra conta.',
  'Resource not found.': 'Não encontrado.',
  'Batch expiration date must be in the future.': 'A validade precisa ser uma data futura.',
  'Batch quantity must be greater than zero.': 'A quantidade precisa ser maior que zero.',
  'Address must include street, number, city and a valid state (UF).': 'Preencha rua, número, cidade e UF do endereço de retirada.',
  'Postal code (CEP) must have 8 digits.': 'O CEP precisa ter 8 dígitos.',
  'Address service is unavailable right now.': 'A busca de endereço está fora do ar agora. Marque o local direto no mapa.',
  'Stock must be zero or more kilograms.': 'Informe um estoque de zero ou mais quilos.',
  'Storage capacity must be greater than zero.': 'A capacidade de armazenamento precisa ser maior que zero.',
  'People served per day must be a whole number greater than zero.': 'Informe quantas pessoas a instituição atende por dia.',
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response

  try {
    response = await fetch(API_URL + path, init)
  } catch {
    throw new ApiError('Não foi possível conectar ao servidor. Tente novamente em instantes.', 0)
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
  notifications: (recipientId: string) =>
    request<{ notifications: AppNotification[]; unreadCount: number }>(
      `/notifications?recipientId=${encodeURIComponent(recipientId)}`,
    ),
  markNotificationRead: (id: string, recipientId: string) =>
    request(`/notifications/${id}/read`, json('PATCH', { recipientId })),
  markAllNotificationsRead: (recipientId: string) =>
    request('/notifications/read-all', json('PATCH', { recipientId })),
  /** CEP → rua, bairro, cidade e UF. */
  lookupPostalCode: (cep: string) =>
    request<{ address: PostalCodeAddress }>(`/geocoding/postal-code/${encodeURIComponent(cep)}`).then((r) => r.address),
  /** Endereço digitado → pontos no mapa. */
  searchAddress: (query: string) =>
    request<{ results: GeocodedAddress[] }>(`/geocoding/search?q=${encodeURIComponent(query)}`).then((r) => r.results),
  /** Instituição informa o estoque real; o sistema volta a estimar a partir dele. */
  updateStock: (institutionId: string, stockKg: number) =>
    request<{ institution: Institution }>(`/institutions/${institutionId}/stock`, json('PATCH', { stockKg })).then(
      (r) => r.institution,
    ),
  /** Doador: histórico de ofertas do lote. */
  batchOffers: (batchId: string) =>
    request<{ offers: Offer[] }>(`/batches/${batchId}/offers`).then((r) => r.offers),
  /** Instituição: ofertas que ela recebeu. */
  institutionOffers: (institutionId: string) =>
    request<{ offers: InstitutionOffer[] }>(`/institutions/${institutionId}/offers`).then(
      (r) => r.offers,
    ),
  accept: (offerId: string, institutionId: string) =>
    request(`/offers/${offerId}/accept`, json('PATCH', { institutionId })),
  decline: (offerId: string, institutionId: string) =>
    request(`/offers/${offerId}/decline`, json('PATCH', { institutionId })),
  pickup: (offerId: string, institutionId: string) =>
    request(`/offers/${offerId}/pickup`, json('PATCH', { institutionId })),
}
