import type { DonationCollected } from '@/domain/food-batch/events/donation-collected'
import type { InstitutionsRepository } from '@/domain/institution/institutions-repository'

/** Quando uma doação é retirada, soma o peso dela ao estoque estimado da instituição. */
export class AddCollectedDonationToStock {
  constructor(private institutionsRepository: InstitutionsRepository) {}

  async handle(event: DonationCollected) {
    const institution = await this.institutionsRepository.findById(event.institutionId)

    if (!institution) {
      return
    }

    institution.receiveDonation(event.quantityKg, event.occurredAt)

    await this.institutionsRepository.save(institution)
  }
}
