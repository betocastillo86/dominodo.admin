/** Lifecycle status of an announcement. */
export type AnnouncementStatus = 'Draft' | 'Published' | 'Archived';

/** Target audience scope of an announcement. */
export type AudienceType = 'AllTenant' | 'ByTower' | 'ByApartments';

/** Announcement as returned by `GET /announcements` (camelCase, do not rename). */
export interface AnnouncementDto {
  id: string;
  tenantId: string;
  title: string;
  categoryId: string | null;
  priority: number;
  status: AnnouncementStatus;
  audienceType: AudienceType;
  publishedAtUtc: string | null;
  expiresAtUtc: string | null;
}

/** Announcement detail as returned by `GET /announcements/{id}`. */
export interface AnnouncementDetailDto {
  id: string;
  tenantId: string;
  title: string;
  body: string;
  categoryId: string | null;
  priority: number;
  status: AnnouncementStatus;
  audienceType: AudienceType;
  audienceFilter: string | null;
  publishedAtUtc: string | null;
  expiresAtUtc: string | null;
  publishedByUserId: string | null;
  createdAtUtc: string;
  updatedAtUtc: string | null;
  createdBy: string | null;
  updatedBy: string | null;
}

export interface CreateAnnouncementRequest {
  title: string;
  body: string;
  priority: number;
  audienceType: AudienceType;
  audienceFilter?: string | null;
  categoryId?: string | null;
  expiresAtUtc?: string | null;
}

export interface UpdateAnnouncementRequest {
  title: string;
  body: string;
  priority: number;
  audienceType: AudienceType;
  audienceFilter?: string | null;
  categoryId?: string | null;
  expiresAtUtc?: string | null;
}
