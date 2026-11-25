import type { PostalCodeAddress, PostalCodeLookup } from '@/application/ports/address-services'
import { ExternalServiceUnavailableError } from '@/core/errors/external-service-unavailable-error'

interface ViaCepResponse {
  cep?: string
  logradouro?: string
  bairro?: string
  localidade?: string
  uf?: string
  erro?: boolean | string
}

interface ViaCepOptions {
  baseUrl?: string
  timeoutMs?: number
  fetchFn?: typeof fetch
}

/** Adaptador do ViaCEP (https://viacep.com.br): CEP → rua, bairro, cidade e UF. Gratuito, sem chave. */
export class ViaCepPostalCodeLookup implements PostalCodeLookup {
  private baseUrl: string
  private timeoutMs: number
  private fetchFn: typeof fetch

  constructor({ baseUrl = 'https://viacep.com.br/ws', timeoutMs = 5000, fetchFn = fetch }: ViaCepOptions = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, '')
    this.timeoutMs = timeoutMs
    this.fetchFn = fetchFn
  }

  async findByPostalCode(postalCode: string): Promise<PostalCodeAddress | null> {
    let body: ViaCepResponse

    try {
      const response = await this.fetchFn(`${this.baseUrl}/${postalCode}/json/`, {
        signal: AbortSignal.timeout(this.timeoutMs),
      })

      // O ViaCEP responde 400 para formato inválido; aqui o CEP já chega com 8 dígitos.
      if (response.status === 400) return null
      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      body = (await response.json()) as ViaCepResponse
    } catch (error) {
      throw Object.assign(new ExternalServiceUnavailableError('viacep'), { cause: error })
    }

    if (body.erro === true || body.erro === 'true' || !body.localidade || !body.uf) {
      return null
    }

    return {
      postalCode,
      street: body.logradouro ?? '',
      district: body.bairro ?? '',
      city: body.localidade,
      state: body.uf,
    }
  }
}
