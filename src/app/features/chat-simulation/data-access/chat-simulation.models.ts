/** Body for `POST /chat-simulation` (camelCase, do not rename). */
export interface AdminSimulateChatRequest {
  phone: string;
  text: string;
}

/** Response of `POST /chat-simulation`. */
export interface AdminSimulateChatResponse {
  reply: string;
}

export type ChatMessageRole = 'Unknown' | 'User' | 'Assistant' | 'System';

export interface ChatMessageResponse {
  turnNumber: number;
  role: ChatMessageRole;
  text: string;
  createdAtUtc: string;
  correlationId: string | null;
}

/**
 * One page of Domi's persisted transcript. `resetAfterTurn` is the highest turn that
 * belongs to a conversation the operator has since reset (`0` = never reset): the
 * default view starts AFTER that cut, so those turns are hidden even at `afterTurn=0`
 * unless `includeBeforeReset` is passed. Nothing is ever deleted.
 */
export interface ChatTranscriptResponse {
  conversationId: string | null;
  cursor: number;
  resetAfterTurn: number;
  messages: ChatMessageResponse[];
}

/** `title` of the ProblemDetails the API returns on the chat routes (it carries the error code). */
export const CHAT_NO_CONVERSATION = 'Chat.NoConversation';
export const CHAT_INVALID_PHONE = 'Chat.InvalidPhone';

/**
 * Why `DELETE /chat-simulation/{phone}` failed. `no-conversation` (404) is the benign
 * one: the number never wrote, so there was simply nothing to reset — not an incident.
 */
export type ChatResetFailureKind = 'no-conversation' | 'invalid-phone' | 'upstream' | 'unknown';

export interface ChatResetFailure {
  kind: ChatResetFailureKind;
  message: string;
}

/** Direction of a chat bubble relative to the operator simulating the user. */
export type ChatDirection = 'outgoing' | 'incoming';

/** Delivery state of an outgoing bubble; incoming bubbles are always `sent`. */
export type ChatBubbleStatus = 'sending' | 'sent' | 'error';

/**
 * Client-only view model for a rendered chat message. Not persisted anywhere:
 * these conversations live only in the component's signal state.
 */
export interface ChatBubble {
  id: string;
  direction: ChatDirection;
  text: string;
  sentAt: Date;
  status: ChatBubbleStatus;
  turnNumber?: number;
  role?: ChatMessageRole;
}

/**
 * What the thread renders: bubbles plus the marker for the reset cut. The marker only
 * appears when archived turns are on screen, i.e. when the full history is being shown.
 */
export type ChatThreadItem =
  | { kind: 'message'; id: string; message: ChatBubble }
  | { kind: 'reset'; id: string; turnNumber: number };
