export type ApartmentType = 'Apartment' | 'House' | 'Commercial' | 'Parking' | 'Storage';
export type ApartmentStatus = 'Occupied' | 'Vacant';

/** Apartment as returned by `GET /apartments` (camelCase, do not rename). */
export interface ApartmentDto {
  id: string;
  tenantId: string;
  tower?: string | null;
  number: string;
  type: ApartmentType;
  status: ApartmentStatus;
}

/** Apartment detail as returned by `GET /apartments/{id}`. */
export interface ApartmentDetailDto {
  id: string;
  tenantId: string;
  tower?: string | null;
  number: string;
  type: ApartmentType;
  status: ApartmentStatus;
  attributes?: string | null;
}

export interface CreateApartmentRequest {
  number: string;
  type: ApartmentType;
  tower?: string | null;
  attributes?: string | null;
}

export interface UpdateApartmentRequest {
  number: string;
  type: ApartmentType;
  tower?: string | null;
  attributes?: string | null;
}

export const APARTMENT_TYPE_LABELS: Record<ApartmentType, string> = {
  Apartment: 'Apartamento',
  House: 'Casa',
  Commercial: 'Local comercial',
  Parking: 'Parqueadero',
  Storage: 'Depósito',
};

export const APARTMENT_STATUS_LABELS: Record<ApartmentStatus, string> = {
  Occupied: 'Ocupado',
  Vacant: 'Disponible',
};

export const APARTMENT_STATUS_BADGES: Record<ApartmentStatus, string> = {
  Occupied: 'badge bg-blue-lt',
  Vacant: 'badge bg-green-lt',
};

export type ResidentRelationType = 'Owner' | 'Renter';

/** Resident as returned by `GET /apartments/{apartmentId}/residents` (camelCase, do not rename). */
export interface ResidentDto {
  id: string;
  apartmentId: string;
  userId: string;
  relationType: string;
  livesHere: boolean;
  startDate?: string | null;
  endDate?: string | null;
  isActive: boolean;
}

export const RESIDENT_RELATION_LABELS: Record<string, string> = {
  Owner: 'Propietario',
  Renter: 'Arrendatario',
};
