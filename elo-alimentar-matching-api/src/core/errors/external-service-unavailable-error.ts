/**
 * Um serviço externo (ex.: busca de CEP ou de endereço) não respondeu.
 * Não é erro de negócio: a HTTP devolve 503 e o usuário pode tentar de novo
 * ou marcar o local direto no mapa.
 */
export class ExternalServiceUnavailableError extends Error {
  constructor(readonly service: string) {
    super('Address service is unavailable right now.')
    this.name = 'ExternalServiceUnavailableError'
  }
}
