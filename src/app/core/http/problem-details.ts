/**
 * RFC 9457 Problem Details, as returned by the API on error.
 * See docs/architecture.md §3.
 */
export interface ProblemDetails {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  /** Field-level validation errors, when present. */
  errors?: ProblemDetailError[];
}

export interface ProblemDetailError {
  property: string;
  message: string;
}
