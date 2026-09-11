BEGIN;
-- Offices share existing location/branch relations, and are explicitly typed.
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS location_kind text NOT NULL DEFAULT 'STORE'
  CHECK (location_kind IN ('STORE','OFFICE'));
-- Leave historical rows untouched; old records retain their existing labels.
ALTER TABLE public.guest_attendances ADD COLUMN IF NOT EXISTS assignment_kind text
  CHECK (assignment_kind IN ('STORE','EVENT','OFFICE'));
COMMIT;
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema='public' AND
 ((table_name='stores' AND column_name='location_kind') OR
  (table_name='guest_attendances' AND column_name='assignment_kind'));
