import type { AdvanceOfferQueueUseCase } from '@/application/use-cases/offers/advance-offer-queue'

interface AdvanceOfferQueueJobOptions {
  useCase: AdvanceOfferQueueUseCase
  clock: () => Date
  intervalMs: number
}

/**
 * Faz a fila de ofertas andar periodicamente (expira ofertas sem resposta,
 * oferece à próxima instituição, vence lotes). Roda uma vez na hora e depois
 * a cada intervalo. Devolve a função que para o job.
 */
export function startAdvanceOfferQueueJob({
  useCase,
  clock,
  intervalMs,
}: AdvanceOfferQueueJobOptions) {
  const run = () => {
    useCase.execute({ now: clock() }).catch((error) => console.error(error))
  }

  run()

  const timer = setInterval(run, intervalMs)

  timer.unref()

  return () => clearInterval(timer)
}
