export type UUID = string;

export type AuditFields = {
  created_at: string;
  updated_at: string;
  created_by: UUID | null;
  updated_by: UUID | null;
};
