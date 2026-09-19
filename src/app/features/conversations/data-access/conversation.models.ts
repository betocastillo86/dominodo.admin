/** Author of a persisted turn (`SharedDomiChatRole`). */
export type DomiChatRole = 'Unknown' | 'User' | 'Assistant' | 'System';

export const CHAT_ROLE_LABELS: Record<DomiChatRole, string> = {
  Unknown: 'Desconocido',
  User: 'Usuario',
  Assistant: 'Domi',
  System: 'Sistema',
};

export const CHAT_ROLE_BADGE: Record<DomiChatRole, string> = {
  Unknown: 'badge bg-secondary-lt',
  User: 'badge bg-blue-lt',
  Assistant: 'badge bg-purple-lt',
  System: 'badge bg-secondary-lt',
};

/**
 * Conversation as returned by `GET /chat-simulation/conversations` (camelCase, do not rename).
 * `resetAfterTurn` is the highest turn archived by an operator reset (`0` = never reset):
 * the default transcript/decision view starts AFTER that cut. A conversation is also cut
 * into **episodes**; `turnNumber` stays monotonic across them, so the episode is what
 * separates one stretch of the conversation from the next.
 */
export interface ConversationSummaryDto {
  conversationId: string;
  senderId: string;
  tenantSlug: string;
  createdAtUtc: string;
  updatedAtUtc: string | null;
  resetAfterTurn: number;
  /** Episode the conversation is currently on; a reset opens the next one. */
  currentEpisode: number;
  messageCount: number;
  decisionCount: number;
  lastTurnAtUtc: string | null;
  userId: string | null;
  hasLiveSession: boolean;
}

/**
 * `GET /chat-simulation/conversations/{id}`. `sessionState` is Domi's live session as it
 * redacted it (tokens blanked, turns dropped) and is null once the transcript outlived
 * its session, so its shape is opaque to the panel.
 */
export interface ConversationDetailDto {
  conversation: ConversationSummaryDto;
  sessionState: unknown | null;
  sessionTurnCount: number | null;
}

export interface ConversationMessageDto {
  id: string;
  turnNumber: number;
  episode: number;
  role: DomiChatRole;
  text: string;
  createdAtUtc: string;
  correlationId: string | null;
}

/** One upstream call the agent made while resolving a turn. */
export interface ToolCallDto {
  tool: string;
  endpoint: string;
  outcome: string;
}

/** The agent's decision trail for a single turn. */
export interface DecisionRecordDto {
  id: string;
  turnNumber: number;
  episode: number;
  /** Message the decision resolved; a turn yields one row per contributor. */
  messageId: string;
  /** Order of this record inside its turn. */
  sequence: number;
  contributor: string;
  sourceState: string | null;
  targetState: string | null;
  resultKind: string | null;
  intent: string | null;
  categoryCode: string | null;
  confidence: number | null;
  route: string | null;
  toolCalls: ToolCallDto[];
  correlationId: string | null;
  createdAtUtc: string;
}

/**
 * One episode of a conversation, from `GET …/conversations/{id}/episodes` (oldest first).
 * The index is grouped from the transcript and does **not** honour the reset cut — the
 * episodes that already ended are the point — so it can list episodes the default
 * transcript view hides. Episode numbers are 1-based.
 */
export interface ConversationEpisodeDto {
  episode: number;
  firstTurnNumber: number;
  lastTurnNumber: number;
  firstAtUtc: string;
  lastAtUtc: string;
  messageCount: number;
  decisionCount: number;
}

/** Query params shared by the transcript and the decision trail of one conversation. */
export interface ConversationTurnFilters {
  /** Lifts the reset cut and returns the whole audit trail. */
  includeBeforeReset?: boolean;
  /** Narrows the page to one episode; composes with the cut instead of lifting it. */
  episode?: number | null;
}

/** Query params accepted by the conversations list (all optional, all cross-tenant). */
export interface ConversationFilters {
  /** Phone fragment; the API matches it as a substring. */
  senderId?: string;
  /** Exact tenant slug (alias), not the tenant id. */
  tenant?: string;
  /** ISO date-time, inclusive lower bound of `createdAtUtc`. */
  from?: string;
  /** ISO date-time, inclusive upper bound of `createdAtUtc`. */
  to?: string;
}
