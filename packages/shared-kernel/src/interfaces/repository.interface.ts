export interface Repository<T, ID> {
  save(entity: T): Promise<T>;
  findById(id: ID): Promise<T | null>;
  delete(id: ID): Promise<void>;
}
