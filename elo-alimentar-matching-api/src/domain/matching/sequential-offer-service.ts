import type { FoodBatch } from '../food-batch/food-batch'
import type { Institution } from '../institution/institution'
import type { EligibleInstitutionsRanker } from './eligible-institutions-ranker'

/**
 * Domain service da OFERTA SEQUENCIAL: o lote é oferecido a uma instituição
 * por vez, na ordem do ranking. A 1ª tem um prazo para aceitar; se recusar ou
 * não responder, o lote segue para a próxima, e assim por diante.
 *
 * É o mesmo processo modelado na simulação do TCC (src/simulation).
 */
export class SequentialOfferService {
  constructor(
    private ranker: EligibleInstitutionsRanker,
    private timeoutMinutes: number,
  ) {}

  /** Oferece à melhor instituição ainda não tentada. Devolve null se não houver. */
  offerToNext(batch: FoodBatch, institutions: Institution[], now: Date) {
    if (!batch.isAvailable || batch.isPastValidity(now)) {
      return null
    }

    const [best] = this.ranker.rank(batch, institutions, now)

    if (!best) {
      return null
    }

    return batch.offerTo({
      institutionId: best.institution.id,
      score: best.score,
      now,
      timeoutMinutes: this.timeoutMinutes,
    })
  }
}
