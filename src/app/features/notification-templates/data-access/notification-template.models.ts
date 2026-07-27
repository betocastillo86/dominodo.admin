/** Notification event a template is bound to. Immutable — set by the backend. */
export type AdminNotificationType =
  | 'Welcome'
  | 'RequestOpened'
  | 'RequestUpdated'
  | 'RequestClosed'
  | 'DeliveryReceived'
  | 'VisitRegistered'
  | 'Announcement'
  | 'UserInvited'
  | 'MembershipInvited';

/**
 * A placeholder available to a template's channel content, as returned by
 * `GET /notification-templates/{id}` (camelCase, do not rename). Informative
 * only — used to help authors build the template text; not editable.
 */
export interface AdminNotificationParameterDto {
  key: string;
  description: string;
  required: boolean;
}

/**
 * Notification template as returned by `GET /notification-templates` and
 * `GET /notification-templates/{id}` (camelCase, do not rename). List and
 * detail share the same shape, except `parameters` is only populated on detail.
 */
export interface AdminNotificationTemplateDto {
  id: string; // uuid
  tenantId?: string | null; // uuid; null → global template
  type: AdminNotificationType; // immutable identity of the template
  name: string;
  description?: string | null;
  emailEnabled: boolean;
  pushEnabled: boolean;
  inAppEnabled: boolean;
  emailSubject?: string | null;
  emailBodyHtml?: string | null; // rendered/edited via WYSIWYG
  inAppText?: string | null;
  pushText?: string | null;
  isActive: boolean;
  localization?: string | null;
  parameters?: AdminNotificationParameterDto[]; // detail only; informative
}

/** Spanish labels for each notification type, for use in lists and the form. */
export const NOTIFICATION_TYPE_LABELS: Record<AdminNotificationType, string> = {
  Welcome: 'Bienvenida',
  RequestOpened: 'Solicitud abierta',
  RequestUpdated: 'Solicitud actualizada',
  RequestClosed: 'Solicitud cerrada',
  DeliveryReceived: 'Entrega recibida',
  VisitRegistered: 'Visita registrada',
  Announcement: 'Anuncio',
  UserInvited: 'Usuario invitado',
  MembershipInvited: 'Membresía invitada',
};

/** Ordered list of notification types, for populating selects. */
export const NOTIFICATION_TYPES: readonly AdminNotificationType[] = [
  'Welcome',
  'RequestOpened',
  'RequestUpdated',
  'RequestClosed',
  'DeliveryReceived',
  'VisitRegistered',
  'Announcement',
  'UserInvited',
  'MembershipInvited',
];

/**
 * Body for `PUT /notification-templates/{id}`. Note `type` (and `id`/`tenantId`)
 * are NOT part of the request — the type is immutable on edit.
 */
export interface AdminUpdateNotificationTemplateRequest {
  name: string;
  description?: string | null;
  emailEnabled: boolean;
  pushEnabled: boolean;
  inAppEnabled: boolean;
  emailSubject?: string | null;
  emailBodyHtml?: string | null;
  inAppText?: string | null;
  pushText?: string | null;
  isActive: boolean;
  localization?: string | null;
}
