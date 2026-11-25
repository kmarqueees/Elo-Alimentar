/**
 * Portas para serviços de endereço. A aplicação depende só destas interfaces;
 * os adaptadores concretos (ViaCEP, Nominatim) ficam em src/infra/geocoding
 * e podem ser trocados (ex.: Google) sem mexer nos casos de uso.
 */

/** Endereço devolvido a partir de um CEP. Não traz coordenadas. */
export interface PostalCodeAddress {
  postalCode: string
  street: string
  district: string
  city: string
  state: string
}

export interface PostalCodeLookup {
  /** null quando o CEP não existe. */
  findByPostalCode(postalCode: string): Promise<PostalCodeAddress | null>
}

/** Um endereço encontrado no mapa, com coordenadas. */
export interface GeocodedAddress {
  /** Texto completo para mostrar ao usuário. */
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

export interface Geocoder {
  /** Busca endereços no Brasil a partir de um texto livre (rua, número, bairro, cidade...). */
  search(query: string): Promise<GeocodedAddress[]>
}
