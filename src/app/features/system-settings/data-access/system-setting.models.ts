/** Value type of a system setting (camelCase, do not rename). */
export type SystemSettingValueType = 'String' | 'Int' | 'Bool' | 'Json';

/** System setting as returned by `GET /system-settings` and `GET /system-settings/{key}`. */
export interface SystemSettingDto {
  key: string;
  /** Null for global (Platform) rows; set only for tenant overrides. */
  tenantId: string | null;
  value: string;
  /** Typed as string per the API; narrowed to the union in the form. */
  valueType: string;
  updatedAtUtc: string;
}

/** `POST /system-settings` — `key` IS editable on create. */
export interface CreateSystemSettingRequest {
  key: string;
  value: string;
  valueType: SystemSettingValueType;
}

/** `PUT /system-settings/{key}` — `key` omitted → immutable on edit. */
export interface UpdateSystemSettingRequest {
  value: string;
  valueType: SystemSettingValueType;
}
