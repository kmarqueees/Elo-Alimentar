import { buildHttpApp } from '@/infra/http/app'
import { startAdvanceOfferQueueJob } from '@/infra/jobs/advance-offer-queue-job'
import { makeUseCases, type Repositories } from './container'

export interface AppOptions extends Repositories {
  clock?: () => Date
  offerTimeoutMinutes?: number | undefined
  /** 0 desliga a varredura da fila de ofertas (útil em testes). */
  offerQueueIntervalMs?: number
}

export function makeApp({
  clock = () => new Date(),
  offerTimeoutMinutes,
  offerQueueIntervalMs = 0,
  ...repositories
}: AppOptions) {
  const useCases = makeUseCases(repositories, { offerTimeoutMinutes })
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
