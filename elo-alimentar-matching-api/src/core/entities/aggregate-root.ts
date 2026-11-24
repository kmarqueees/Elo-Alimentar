import { Entity } from './entity'

/**
 * Raiz de agregado: a única porta de entrada para alterar o agregado.
 * Repositórios carregam e salvam agregados inteiros, nunca partes deles.
 */
export abstract class AggregateRoot<Props> extends Entity<Props> {}
