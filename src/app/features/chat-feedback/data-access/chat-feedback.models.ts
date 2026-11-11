/**
 * One question Domi deflected, with the resident's verdict, as returned by
 * `GET /chat-feedback` (camelCase, do not rename). `asked` says whether Domi asked the
 * resident to rate it; `wasHelpful` stays null until the resident answers.
 */
export interface ChatFeedbackItemDto {
  id: string;
  conversationId: string;
  /** Episode of the conversation the question was asked in (1-based). */
  episode: number;
  tenantSlug: string;
  senderId: string;
  question: string;
  asked: boolean;
  wasHelpful: boolean | null;
  comment: string | null;
  correlationId: string | null;
  createdAtUtc: string;
  updatedAtUtc: string | null;
}

/**
 * Totals of `GET /chat-feedback/summary` for the same tenant/date scope as the list.
 * The rates are null — never 0 — when their denominator is zero.
 */
export interface ChatFeedbackSummaryDto {
  tenant: string | null;
  from: string | null;
  to: string | null;
  deflections: number;
  asked: number;
  answered: number;
  helpful: number;
  notHelpful: number;
  /** `asked - answered`. */
  unanswered: number;
  responseRate: number | null;
  helpfulRate: number | null;
}

/** `SharedSortDirection`; the list orders by `createdAtUtc`. */
export type SortDirection = 'Asc' | 'Desc';

/** Filters shared by the list and the summary (all optional, all cross-tenant). */
export interface ChatFeedbackScope {
  /** Exact tenant slug (alias), not the tenant id. */
  tenant?: string;
  /** ISO date-time, inclusive lower bound of `createdAtUtc`. */
  from?: string;
  /** ISO date-time, inclusive upper bound of `createdAtUtc`. */
  to?: string;
}

/** Query params accepted by the list on top of the scope. */
export interface ChatFeedbackFilters extends ChatFeedbackScope {
  wasHelpful?: boolean;
  /** Whether the resident gave a verdict at all. */
  answered?: boolean;
  direction?: SortDirection;
}
