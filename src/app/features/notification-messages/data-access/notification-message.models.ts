/** Delivery status of an email/push message. */
export type AdminDeliveryStatus = 'Pending' | 'Sent' | 'Failed';

/** Target platform of a push message. */
export type AdminDevicePlatform = 'Android' | 'iOS';

/** Materialized email message as returned by `GET /messages/email` (camelCase, do not rename). */
export interface AdminEmailMessageDto {
  id: string; // uuid
  tenantId: string; // uuid
  to: string;
  toName?: string | null;
  subject: string;
  bodyHtml: string;
  priority: number;
  status: AdminDeliveryStatus;
  attempts: number;
  scheduledAtUtc?: string | null; // date-time
  sentAtUtc?: string | null; // date-time
  createdAtUtc: string; // date-time
}

/** Materialized push message as returned by `GET /messages/push`. */
export interface AdminPushMessageDto {
  id: string; // uuid
  tenantId: string; // uuid
  recipientUserId: string; // uuid
  title: string;
  body: string;
  targetUrl?: string | null;
  platform: AdminDevicePlatform;
  status: AdminDeliveryStatus;
  attempts: number;
  dedupHash: string;
  sentAtUtc?: string | null; // date-time
  createdAtUtc: string; // date-time
}

/** Materialized WhatsApp message as returned by `GET /messages/whatsapp`. */
export interface AdminWhatsAppMessageDto {
  id: string; // uuid
  tenantId: string; // uuid
  to: string;
  body: string;
  /** Twilio Content SID used for the send; null when the free-form body was sent. */
  contentSid?: string | null;
  status: AdminDeliveryStatus;
  attempts: number;
  scheduledAtUtc?: string | null; // date-time
  sentAtUtc?: string | null; // date-time
  createdAtUtc: string; // date-time
}

/** Materialized in-app notification as returned by `GET /messages/inapp`. */
export interface AdminInAppMessageDto {
  id: string; // uuid
  tenantId: string; // uuid
  recipientUserId: string; // uuid
  type: string;
  title: string;
  body: string;
  targetUrl?: string | null;
  isRead: boolean;
  readAtUtc?: string | null; // date-time
  triggeredByUserId?: string | null; // uuid
  createdAtUtc: string; // date-time
}

/**
 * Query filters for `GET /messages/email`. All optional; omit to skip the filter.
 * `from`/`to` are date strings (`YYYY-MM-DD`) matched against the scheduled/sent date.
 */
export interface EmailMessageFilters {
  status?: AdminDeliveryStatus;
  search?: string;
  recipient?: string;
  from?: string;
  to?: string;
}

/** Query filters for `GET /messages/push`. All optional; omit to skip the filter. */
export interface PushMessageFilters {
  status?: AdminDeliveryStatus;
  search?: string;
  recipientUserId?: string;
  from?: string;
  to?: string;
}

/** Query filters for `GET /messages/whatsapp`. All optional; omit to skip the filter. */
export interface WhatsAppMessageFilters {
  status?: AdminDeliveryStatus;
  search?: string;
  recipient?: string;
  from?: string;
  to?: string;
}

/** Query filters for `GET /messages/inapp`. All optional; omit to skip the filter. */
export interface InAppMessageFilters {
  search?: string;
  recipientUserId?: string;
  from?: string;
  to?: string;
}

/** Ordered list of delivery statuses, for populating selects. */
export const DELIVERY_STATUSES: readonly AdminDeliveryStatus[] = ['Pending', 'Sent', 'Failed'];

/** Spanish labels for delivery statuses. */
export const DELIVERY_STATUS_LABELS: Record<AdminDeliveryStatus, string> = {
  Pending: 'Pendiente',
  Sent: 'Enviado',
  Failed: 'Fallido',
};

/** Badge classes for delivery statuses. */
export const DELIVERY_STATUS_BADGE: Record<AdminDeliveryStatus, string> = {
  Pending: 'badge bg-yellow-lt',
  Sent: 'badge bg-green-lt',
  Failed: 'badge bg-red-lt',
};

/** Badge classes for device platforms. */
export const PLATFORM_BADGE: Record<AdminDevicePlatform, string> = {
  Android: 'badge bg-green-lt',
  iOS: 'badge bg-azure-lt',
};

/**
 * Response of `POST /messages/{channel}/{id}/requeue`. The requeue materializes a
 * *new* message queued for a fresh delivery attempt; `id` is that new message's id.
 */
export interface RequeueMessageResponse {
  id: string; // uuid
}
