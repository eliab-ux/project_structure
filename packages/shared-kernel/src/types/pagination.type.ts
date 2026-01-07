export interface PaginationParams {
  page: number;
  limit: number;
  orderBy?: string;
  orderDirection?: 'ASC' | 'DESC';
}

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

export class Pagination {
  static create(page: number = 1, limit: number = 10): PaginationParams {
    return {
      page: Math.max(1, page),
      limit: Math.min(Math.max(1, limit), 100),
    };
  }

  static createResult<T>(
    data: T[],
    total: number,
    params: PaginationParams,
  ): PaginatedResult<T> {
    const totalPages = Math.ceil(total / params.limit);

    return {
      data,
      meta: {
        total,
        page: params.page,
        limit: params.limit,
        totalPages,
        hasNext: params.page < totalPages,
        hasPrevious: params.page > 1,
      },
    };
  }
}
