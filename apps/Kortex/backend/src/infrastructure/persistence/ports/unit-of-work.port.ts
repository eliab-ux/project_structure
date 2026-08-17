export const UNIT_OF_WORK = Symbol('UNIT_OF_WORK');

/**
 * Fronteira transacional dos use cases. Use case depende deste port — nunca do EntityManager
 * (Menor Privilégio, CLAUDE.md).
 */
export interface UnitOfWorkPort {
  execute<T>(work: () => Promise<T>): Promise<T>;
}
