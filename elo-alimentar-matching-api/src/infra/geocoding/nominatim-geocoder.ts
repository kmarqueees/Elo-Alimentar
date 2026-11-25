import type { GeocodedAddress, Geocoder } from '@/application/ports/address-services'
import { ExternalServiceUnavailableError } from '@/core/errors/external-service-unavailable-error'

interface NominatimItem {
  lat: string
  lon: string
  display_name: string
  address?: {
    road?: string
    pedestrian?: string
    house_number?: string
    suburb?: string
    neighbourhood?: string
    city_district?: string
    city?: string
    town?: string
    village?: string
    municipality?: string
    postcode?: string
    'ISO3166-2-lvl4'?: string
  }
}

interface NominatimOptions {
  baseUrl?: string
  /** Obrigatório pela política do Nominatim: identifique a aplicação (e um contato). */
  userAgent: string
  timeoutMs?: number
  /** Política de uso: no máximo 1 requisição por segundo. */
  minIntervalMs?: number
  cacheTtlMs?: number
  maxCacheEntries?: number
  fetchFn?: typeof fetch
}

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Adaptador do Nominatim (OpenStreetMap): endereço → coordenadas.
 * Gratuito, mas com política de uso (https://operations.osmfoundation.org/policies/nominatim/):
 * no máximo 1 requisição/s, User-Agent identificando a aplicação e cache dos resultados.
 */
export class NominatimGeocoder implements Geocoder {
  private baseUrl: string
  private userAgent: string
  private timeoutMs: number
  private minIntervalMs: number
  private cacheTtlMs: number
  private maxCacheEntries: number
  private fetchFn: typeof fetch

  private cache = new Map<string, { at: number; results: GeocodedAddress[] }>()
  /** Fila que garante o intervalo mínimo entre requisições. */
  private queue: Promise<unknown> = Promise.resolve()
  private lastRequestAt = 0

  constructor({
    baseUrl = 'https://nominatim.openstreetmap.org',
    userAgent,
    timeoutMs = 8000,
    minIntervalMs = 1000,
    cacheTtlMs = DAY_MS,
    maxCacheEntries = 500,
    fetchFn = fetch,
  }: NominatimOptions) {
    this.baseUrl = baseUrl.replace(/\/$/, '')
    this.userAgent = userAgent
    this.timeoutMs = timeoutMs
    this.minIntervalMs = minIntervalMs
    this.cacheTtlMs = cacheTtlMs
    this.maxCacheEntries = maxCacheEntries
    this.fetchFn = fetchFn
  }

  async search(query: string): Promise<GeocodedAddress[]> {
    const key = query.toLowerCase()
    const cached = this.cache.get(key)

    if (cached && Date.now() - cached.at < this.cacheTtlMs) {
      return cached.results
    }

    const results = await this.throttled(() => this.request(query))

    this.remember(key, results)

    return results
  }

  private async request(query: string) {
    const params = new URLSearchParams({
      q: query,
      format: 'jsonv2',
      addressdetails: '1',
      countrycodes: 'br',
      limit: '5',
      'accept-language': 'pt-BR',
    })

    let items: NominatimItem[]

    try {
      const response = await this.fetchFn(`${this.baseUrl}/search?${params}`, {
        headers: { 'User-Agent': this.userAgent },
        signal: AbortSignal.timeout(this.timeoutMs),
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      items = (await response.json()) as NominatimItem[]
    } catch (error) {
      throw Object.assign(new ExternalServiceUnavailableError('nominatim'), { cause: error })
    }

    return items.map(toGeocodedAddress)
  }

  /** Executa uma requisição por vez, respeitando o intervalo mínimo entre elas. */
  private throttled<T>(task: () => Promise<T>): Promise<T> {
    const run = async () => {
      const wait = this.lastRequestAt + this.minIntervalMs - Date.now()

      if (wait > 0) {
        await new Promise((resolve) => setTimeout(resolve, wait))
      }

      this.lastRequestAt = Date.now()

      return task()
    }

    const result = this.queue.then(run, run)

    this.queue = result.catch(() => undefined)

    return result
  }

  private remember(key: string, results: GeocodedAddress[]) {
    if (this.cache.size >= this.maxCacheEntries) {
      const oldest = this.cache.keys().next().value

      if (oldest !== undefined) this.cache.delete(oldest)
    }

    this.cache.set(key, { at: Date.now(), results })
  }
}

function toGeocodedAddress(item: NominatimItem): GeocodedAddress {
  const a = item.address ?? {}
  const iso = a['ISO3166-2-lvl4']
  const postcode = a.postcode?.replace(/\D/g, '') ?? ''

  return {
    label: item.display_name,
    latitude: Number(item.lat),
    longitude: Number(item.lon),
    street: a.road ?? a.pedestrian ?? null,
    number: a.house_number ?? null,
    district: a.suburb ?? a.neighbourhood ?? a.city_district ?? null,
    city: a.city ?? a.town ?? a.village ?? a.municipality ?? null,
    // "BR-AM" → "AM"
    state: iso?.startsWith('BR-') ? iso.slice(3) : null,
    postalCode: postcode.length === 8 ? postcode : null,
  }
}
