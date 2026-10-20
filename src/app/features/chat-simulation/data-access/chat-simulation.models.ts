/** Body for `POST /chat-simulation` (camelCase, do not rename). */
export interface AdminSimulateChatRequest {
  phone: string;
  text: string | null;
  media?: AdminChatMediaRef[];
}

/**
 * A file already uploaded through `POST /chat-simulation/media`. `url` is Domi's own pointer
 * (`domi-testchat:…`), NOT something the browser can fetch — the preview comes from the local
 * `File`, never from this (Domi ADR-0012 §18).
 */
export interface AdminChatMediaRef {
  url: string;
  contentType: string;
}

/** Response of `POST /chat-simulation/media`. The pointer expires. */
export interface AdminChatMediaResponse extends AdminChatMediaRef {
  expiresAtUtc: string;
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
export const CHAT_MEDIA_REJECTED = 'Chat.MediaRejected';

/** What the simulator accepts, mirroring Domi's `Attachments` limits so the operator is told early. */
export const CHAT_MEDIA_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
];

export const CHAT_MEDIA_MAX_BYTES = 5 * 1024 * 1024;

/** Attachments one turn may carry; the API refuses the sixth. */
export const CHAT_MEDIA_MAX_FILES = 5;

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
  /** Local previews of the files the operator attached; object URLs, revoked when the thread resets. */
  attachments?: ChatAttachmentPreview[];
}

export interface ChatAttachmentPreview {
  name: string;
  contentType: string;
  /** `null` for anything that is not an image — a PDF renders as a chip, not a thumbnail. */
  objectUrl: string | null;
}

/**
 * A file sitting in the composer, waiting for the turn that uploads and sends it. The `File`
 * never reaches a bubble: once the turn goes out only its `preview` survives, so the thread
 * holds no file handles.
 */
export interface PendingAttachment {
  id: string;
  file: File;
  preview: ChatAttachmentPreview;
}

/**
 * What the thread renders: bubbles plus the marker for the cut. `archived` is pre-computed
 * rather than derived in the template because it is not simply "behind the cut": a thread
 * that lies *entirely* behind it is the conversation the operator just had, and the marker
 * closing it already says so — dimming all of it would contrast it against nothing.
 */
export type ChatThreadItem =
  | { kind: 'message'; id: string; message: ChatBubble; archived: boolean }
  | { kind: 'reset'; id: string; turnNumber: number };
