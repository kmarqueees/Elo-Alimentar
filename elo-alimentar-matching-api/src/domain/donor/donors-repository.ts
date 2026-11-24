/** Porta mínima para o contexto de usuários: só precisamos saber se o doador existe. */
export interface DonorsRepository {
  exists(donorId: string): Promise<boolean>
}
