/** Body for `POST /chat-simulation` (camelCase, do not rename). */
export interface AdminSimulateChatRequest {
  phone: string;
  text: string;
}

/** Response of `POST /chat-simulation`. */
export interface AdminSimulateChatResponse {
  reply: string;
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
}
