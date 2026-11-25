import { buildHttpApp } from '@/infra/http/app'
import { startAdvanceOfferQueueJob } from '@/infra/jobs/advance-offer-queue-job'
import { NominatimGeocoder } from '@/infra/geocoding/nominatim-geocoder'
import { ViaCepPostalCodeLookup } from '@/infra/geocoding/viacep-postal-code-lookup'
import { makeUseCases, type AddressServices, type Repositories } from './container'

export interface AppOptions extends Repositories {
  clock?: () => Date
  offerTimeoutMinutes?: number | undefined
  /** 0 desliga a varredura da fila de ofertas (útil em testes). */
  offerQueueIntervalMs?: number
  /** Busca de CEP e de endereço. Por padrão, ViaCEP e Nominatim. */
  addressServices?: AddressServices
  /** Identificação enviada ao Nominatim (obrigatória pela política de uso). */
  geocoderUserAgent?: string
}

export function makeApp({
  clock = () => new Date(),
  offerTimeoutMinutes,
  offerQueueIntervalMs = 0,
  addressServices,
  geocoderUserAgent = 'EloAlimentar/1.0',
  ...repositories
}: AppOptions) {
  const services = addressServices ?? {
    postalCodes: new ViaCepPostalCodeLookup(),
    geocoder: new NominatimGeocoder({ userAgent: geocoderUserAgent }),
  }
  const useCases = makeUseCases(repositories, services, { offerTimeoutMinutes })
  const app = buildHttpApp({ useCases, clock })

  if (offerQueueIntervalMs > 0) {
    let stop: (() => void) | undefined

    app.addHook('onReady', async () => {
      stop = startAdvanceOfferQueueJob({
        useCase: useCases.advanceOfferQueue,
        clock,
        intervalMs: offerQueueIntervalMs,
      })
    })

    app.addHook('onClose', async () => stop?.())
  }

  return { app, useCases }
}
