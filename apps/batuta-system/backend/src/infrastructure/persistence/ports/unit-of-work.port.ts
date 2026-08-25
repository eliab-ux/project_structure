export const UNIT_OF_WORK = Symbol('UNIT_OF_WORK');

/**
 * Transaction boundary for use cases. Use cases depend on this port — never on EntityManager
 * (Least Privilege, CLAUDE.md).
 */
export interface UnitOfWorkPort {
  execute<T>(work: () => Promise<T>): Promise<T>;
}
