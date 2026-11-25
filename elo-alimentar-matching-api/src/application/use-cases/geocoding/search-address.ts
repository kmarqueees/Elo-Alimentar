import type { GeocodedAddress, Geocoder } from '../../ports/address-services'

const MIN_QUERY_LENGTH = 3

/** Converte o endereço digitado em pontos no mapa (para posicionar o marcador). */
export class SearchAddressUseCase {
  constructor(private geocoder: Geocoder) {}

  async execute({ query }: { query: string }): Promise<{ results: GeocodedAddress[] }> {
    const text = query.trim().replace(/\s+/g, ' ')

    if (text.length < MIN_QUERY_LENGTH) {
      return { results: [] }
    }

    return { results: await this.geocoder.search(text) }
  }
}
