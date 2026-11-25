export interface RepositoryContext {
  uid?: string;
  email?: string | null;
}

export interface BaseRepository<
  TEntity,
  TCreateInput = Partial<TEntity>,
  TUpdateInput = Partial<TEntity>,
  TFilter = Record<string, unknown>,
  TListResult = TEntity[],
> {
  readonly entityName: string;
  findById(id: string, context?: RepositoryContext): Promise<TEntity | null>;
  findAll(filters?: TFilter, context?: RepositoryContext): Promise<TListResult>;
  create(data: TCreateInput, context?: RepositoryContext): Promise<TEntity>;
  update(
    id: string,
    data: TUpdateInput,
    context?: RepositoryContext
  ): Promise<TEntity>;
  delete(id: string, context?: RepositoryContext): Promise<void>;
}
