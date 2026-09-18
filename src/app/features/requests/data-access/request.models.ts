export type RequestType = 'Peticion' | 'Queja' | 'Reclamo' | 'Sugerencia' | 'Maintenance';
export type RequestStatus = 'New' | 'InProgress' | 'Resolved' | 'Closed';
export type RequestPriority = 'Low' | 'Medium' | 'High';
export type RequestVisibility = 'Private' | 'Public';
export type RequestUpdateType = 'Progress' | 'Comment' | 'Evidence' | 'Resolution';

/** Sort key accepted by `GET /requests` (`sortBy` query param). */
export type RequestSortBy = 'Date' | 'Priority' | 'Status';
/** Sort direction accepted by `GET /requests` (`direction` query param). */
export type SortDirection = 'Asc' | 'Desc';

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  New: 'Nuevo',
  InProgress: 'En progreso',
  Resolved: 'Resuelto',
  Closed: 'Cerrado',
};

export const REQUEST_TYPE_LABELS: Record<RequestType, string> = {
  Peticion: 'Petición',
  Queja: 'Queja',
  Reclamo: 'Reclamo',
  Sugerencia: 'Sugerencia',
  Maintenance: 'Mantenimiento',
};

export const REQUEST_PRIORITY_LABELS: Record<RequestPriority, string> = {
  Low: 'Baja',
  Medium: 'Media',
  High: 'Alta',
};

export const REQUEST_VISIBILITY_LABELS: Record<RequestVisibility, string> = {
  Private: 'Privada',
  Public: 'Pública',
};

export const REQUEST_UPDATE_TYPE_LABELS: Record<RequestUpdateType, string> = {
  Progress: 'Avance',
  Comment: 'Comentario',
  Evidence: 'Evidencia',
  Resolution: 'Resolución',
};

/** A request category (tenant-scoped catalog) as returned by `GET /request-categories`. */
export interface RequestCategoryDto {
  id: string;
  code: string;
  name: string;
  description: string;
  isActive: boolean;
}

/** Request as returned by `GET /requests` (camelCase, do not rename). */
export interface RequestDto {
  id: string;
  tenantId: string;
  code: string;
  type: string;
  categoryId: string;
  title: string;
  status: string;
  priority: string;
  visibility: string;
  createdByUserId: string;
  apartmentId: string | null;
  assignedToUserId: string | null;
  createdAtUtc: string; // date-time
  updatedAtUtc?: string | null; // date-time
  createdBy?: string | null;
  updatedBy?: string | null;
}

/** Request detail as returned by `GET /requests/{id}`. */
export interface RequestDetailDto {
  id: string;
  tenantId: string;
  code: string;
  type: string;
  categoryId: string;
  title: string;
  description: string;
  location: string | null;
  status: string;
  priority: string;
  visibility: string;
  createdByUserId: string;
  apartmentId: string | null;
  assignedToUserId: string | null;
  resolvedAtUtc: string | null;
  closedAtUtc: string | null;
  metadata: string | null;
  participants: RequestParticipantDto[];
  updates: RequestUpdateDto[];
  statusHistory: RequestStatusHistoryDto[];
}

export interface RequestParticipantDto {
  id: string;
  userId: string;
  participantType: string;
  source: string;
  joinedAtUtc: string;
}

export interface RequestUpdateDto {
  id: string;
  authorUserId: string;
  type: string;
  body: string | null;
  isInternal: boolean;
  createdAtUtc: string;
}

export interface RequestStatusHistoryDto {
  id: string;
  fromStatus: string;
  toStatus: string;
  changedByUserId: string;
  changedAtUtc: string;
  note: string | null;
}

/** `PUT /requests/{id}` */
export interface UpdateRequestRequest {
  type: RequestType;
  title: string;
  description: string;
  priority: RequestPriority;
  categoryId: string;
  location: string | null;
  metadata: string | null;
  visibility: RequestVisibility;
}

/** `PUT /requests/{id}/status` */
export interface ChangeRequestStatusRequest {
  status: RequestStatus;
  note: string | null;
}

/** `POST /requests/{id}/updates` */
export interface AddRequestUpdateRequest {
  type: RequestUpdateType;
  body: string | null;
  isInternal: boolean;
}

/** `POST /requests/{id}/participants` */
export interface AddRequestParticipantRequest {
  userId: string;
}

/** Attachment as returned by `GET /requests/{id}/attachments` and `POST /requests/{id}/attachments`. */
export interface RequestAttachmentDto {
  id: string;
  requestId: string;
  requestUpdateId: string | null;
  fileName: string;
  contentType: string;
  uploadedByUserId: string;
  createdAtUtc: string;
}

/** Response from `POST /requests/{id}/attachments/upload-url`. */
export interface RequestAttachmentUploadTicketDto {
  uploadUrl: string;
  key: string;
}

/** `POST /requests/{id}/attachments` — confirm an upload after the file was PUT to the signed URL. */
export interface ConfirmAttachmentRequest {
  key: string;
  fileName: string;
  contentType: string;
  requestUpdateId?: string | null;
}

/** Response from `GET /requests/{id}/attachments/{attachmentId}/download-url`. */
export interface AttachmentDownloadUrlDto {
  url: string;
  expiresAtUtc: string;
}
