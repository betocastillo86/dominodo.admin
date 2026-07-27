export interface RequestCategoryDto {
  id: string;
  code: string;
  name: string;
  description: string;
  isActive: boolean;
}

export interface CreateRequestCategoryRequest {
  code: string;
  name: string;
  description?: string | null;
  isActive: boolean;
}

/** `code` is immutable — omitted from the update body. */
export interface UpdateRequestCategoryRequest {
  name: string;
  description?: string | null;
  isActive: boolean;
}
