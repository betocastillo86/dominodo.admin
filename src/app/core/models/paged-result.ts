/**
 * Standard paged envelope returned by the API for list endpoints.
 * Typed exactly as the API returns it (camelCase); do not rename fields.
 */
export interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}
