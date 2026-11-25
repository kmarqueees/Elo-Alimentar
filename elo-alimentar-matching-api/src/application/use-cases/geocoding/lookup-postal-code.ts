import { ResourceNotFoundError } from '@/core/errors/resource-not-found-error'
import { normalizePostalCode } from '@/domain/shared/address'
import type { PostalCodeAddress, PostalCodeLookup } from '../../ports/address-services'

/** O doador digita o CEP e recebe rua, bairro, cidade e UF para completar o endereço. */
export class LookupPostalCodeUseCase {
  constructor(private postalCodes: PostalCodeLookup) {}

  async execute({ postalCode }: { postalCode: string }): Promise<{ address: PostalCodeAddress }> {
    const digits = normalizePostalCode(postalCode)
    const address = await this.postalCodes.findByPostalCode(digits)

    if (!address) {
      throw new ResourceNotFoundError()
    }

    return { address }
  }
}
