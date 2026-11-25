import { describe, expect, it, vi } from 'vitest'
import { ExternalServiceUnavailableError } from '@/core/errors/external-service-unavailable-error'
import { NominatimGeocoder } from './nominatim-geocoder'
import { ViaCepPostalCodeLookup } from './viacep-postal-code-lookup'

/** fetch simulado: nenhum teste acessa a internet. */
function fakeFetch(body: unknown, status = 200) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch & ReturnType<typeof vi.fn>
}

describe('ViaCepPostalCodeLookup', () => {
  it('converte a resposta do ViaCEP', async () => {
    const fetchFn = fakeFetch({
      cep: '69005-040',
      logradouro: 'Avenida Eduardo Ribeiro',
      bairro: 'Centro',
      localidade: 'Manaus',
      uf: 'AM',
    })
    const sut = new ViaCepPostalCodeLookup({ fetchFn })

    expect(await sut.findByPostalCode('69005040')).toEqual({
      postalCode: '69005040',
      street: 'Avenida Eduardo Ribeiro',
      district: 'Centro',
      city: 'Manaus',
      state: 'AM',
    })
    expect(fetchFn.mock.calls[0]![0]).toBe('https://viacep.com.br/ws/69005040/json/')
  })

  it('devolve null para CEP inexistente', async () => {
    expect(await new ViaCepPostalCodeLookup({ fetchFn: fakeFetch({ erro: true }) }).findByPostalCode('00000000')).toBeNull()
    expect(await new ViaCepPostalCodeLookup({ fetchFn: fakeFetch({ erro: 'true' }) }).findByPostalCode('00000000')).toBeNull()
  })

  it('serviço fora do ar vira ExternalServiceUnavailableError', async () => {
    const down = vi.fn(async () => {
      throw new TypeError('fetch failed')
    }) as unknown as typeof fetch

    await expect(new ViaCepPostalCodeLookup({ fetchFn: down }).findByPostalCode('69005040')).rejects.toBeInstanceOf(
      ExternalServiceUnavailableError,
    )
    await expect(
      new ViaCepPostalCodeLookup({ fetchFn: fakeFetch({}, 500) }).findByPostalCode('69005040'),
    ).rejects.toBeInstanceOf(ExternalServiceUnavailableError)
  })
})

describe('NominatimGeocoder', () => {
  const item = {
    lat: '-3.1316',
    lon: '-60.0234',
    display_name: 'Avenida Eduardo Ribeiro, 520, Centro, Manaus, Amazonas, 69005-040, Brasil',
    address: {
      road: 'Avenida Eduardo Ribeiro',
      house_number: '520',
      suburb: 'Centro',
      city: 'Manaus',
      postcode: '69005-040',
      'ISO3166-2-lvl4': 'BR-AM',
    },
  }

  it('converte o resultado e envia os parâmetros e a identificação exigidos', async () => {
    const fetchFn = fakeFetch([item])
    const sut = new NominatimGeocoder({ userAgent: 'EloAlimentar/teste', fetchFn, minIntervalMs: 0 })

    const [result] = await sut.search('Av. Eduardo Ribeiro, 520, Manaus')

    expect(result).toEqual({
      label: item.display_name,
      latitude: -3.1316,
      longitude: -60.0234,
      street: 'Avenida Eduardo Ribeiro',
      number: '520',
      district: 'Centro',
      city: 'Manaus',
      state: 'AM',
      postalCode: '69005040',
    })

    const [url, init] = fetchFn.mock.calls[0]! as [string, RequestInit]

    expect(url).toContain('countrycodes=br')
    expect(url).toContain('q=Av.+Eduardo+Ribeiro%2C+520%2C+Manaus')
    expect((init.headers as Record<string, string>)['User-Agent']).toBe('EloAlimentar/teste')
  })

  it('guarda em cache: a mesma busca não consulta o serviço de novo', async () => {
    const fetchFn = fakeFetch([item])
    const sut = new NominatimGeocoder({ userAgent: 'x', fetchFn, minIntervalMs: 0 })

    await sut.search('Rua A, Manaus')
    await sut.search('rua a, manaus')

    expect(fetchFn).toHaveBeenCalledTimes(1)
  })

  it('respeita o intervalo mínimo entre requisições (política de 1 por segundo)', async () => {
    const fetchFn = fakeFetch([])
    const sut = new NominatimGeocoder({ userAgent: 'x', fetchFn, minIntervalMs: 120 })

    const start = Date.now()

    await Promise.all([sut.search('busca um'), sut.search('busca dois')])

    expect(Date.now() - start).toBeGreaterThanOrEqual(110)
  })

  it('serviço fora do ar vira ExternalServiceUnavailableError', async () => {
    const sut = new NominatimGeocoder({ userAgent: 'x', fetchFn: fakeFetch({}, 503), minIntervalMs: 0 })

    await expect(sut.search('Rua A')).rejects.toBeInstanceOf(ExternalServiceUnavailableError)
  })
})
