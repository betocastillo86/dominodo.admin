/** Lifecycle status of a knowledge resource. */
export type KnowledgeResourceStatus = 'Draft' | 'Published' | 'Archived';

/** Knowledge resource as returned by `GET /knowledge-resources` (camelCase, do not rename). */
export interface KnowledgeResourceDto {
  id: string;
  tenantId: string;
  title: string;
  category: string | null;
  status: KnowledgeResourceStatus;
  publishedAtUtc: string | null;
  updatedAtUtc: string | null;
}

/** Knowledge resource detail as returned by `GET /knowledge-resources/{id}`. */
export interface KnowledgeResourceDetailDto {
  id: string;
  tenantId: string;
  title: string;
  body: string;
  category: string | null;
  status: KnowledgeResourceStatus;
  publishedAtUtc: string | null;
  publishedByUserId: string | null;
  createdAtUtc: string;
  updatedAtUtc: string | null;
  createdBy: string | null;
  updatedBy: string | null;
}

/** `POST /knowledge-resources` — always creates a Draft; status is not part of the body. */
export interface CreateKnowledgeResourceRequest {
  title: string;
  body: string;
  category?: string | null;
}

/** `PUT /knowledge-resources/{id}` — edits fields and drives the lifecycle via `status`. */
export interface UpdateKnowledgeResourceRequest {
  title: string;
  body: string;
  category?: string | null;
  status: KnowledgeResourceStatus;
}

export const KNOWLEDGE_RESOURCE_STATUS_LABELS: Record<KnowledgeResourceStatus, string> = {
  Draft: 'Borrador',
  Published: 'Publicado',
  Archived: 'Archivado',
};

export const KNOWLEDGE_RESOURCE_STATUS_BADGES: Record<KnowledgeResourceStatus, string> = {
  Draft: 'badge bg-secondary-lt',
  Published: 'badge bg-green-lt',
  Archived: 'badge bg-red-lt',
};
