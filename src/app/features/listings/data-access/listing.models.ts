/** Type of listing: sale or rent. */
export type ListingKind = 'Sale' | 'Rent';

/** Publication status. */
export type ListingStatus = 'Active' | 'Withdrawn' | 'Closed';

/** Listing as returned by `GET /listings` (camelCase, do not rename). */
export interface ListingDto {
  id: string;
  tenantId: string;
  apartmentId: string;
  description?: string | null;
  kind: ListingKind;
  price?: number | null;
  contactPhone?: string | null;
  area?: number | null;
  bedrooms?: number | null;
  status: ListingStatus;
  publishedAtUtc: string;
  expiresAtUtc: string;
  createdByUserId: string;
  createdAtUtc: string;
  updatedAtUtc?: string | null;
}

export interface CreateListingRequest {
  apartmentId: string;
  description?: string | null;
  kind: ListingKind;
  price?: number | null;
  contactPhone?: string | null;
  area?: number | null;
  bedrooms?: number | null;
}

export interface EditListingRequest {
  description?: string | null;
  kind: ListingKind;
  price?: number | null;
  contactPhone?: string | null;
  area?: number | null;
  bedrooms?: number | null;
  status: ListingStatus;
}

export const LISTING_KIND_LABELS: Record<ListingKind, string> = {
  Sale: 'Venta',
  Rent: 'Arriendo',
};

export const LISTING_KIND_BADGES: Record<ListingKind, string> = {
  Sale: 'badge bg-blue-lt',
  Rent: 'badge bg-green-lt',
};

export const LISTING_STATUS_LABELS: Record<ListingStatus, string> = {
  Active: 'Activo',
  Withdrawn: 'Retirado',
  Closed: 'Cerrado',
};

export const LISTING_STATUS_BADGES: Record<ListingStatus, string> = {
  Active: 'badge bg-green-lt',
  Withdrawn: 'badge bg-yellow-lt',
  Closed: 'badge bg-red-lt',
};
