BEGIN;
-- Change only the original guest submission/location CHECK.
-- Keep the unique submission key, foreign keys, and store/event exclusivity.
DO $$
DECLARE rule record; matched integer := 0;
BEGIN
  FOR rule IN
    SELECT conname, pg_get_expr(conbin, conrelid) AS expression
    FROM pg_constraint
    WHERE conrelid = 'public.guest_attendances'::regclass AND contype = 'c'
  LOOP
    IF regexp_replace(replace(rule.expression, '::text', ''), '[[:space:]()]', '', 'g') =
       'time_source=''LEGACY_DEVICE''ORsubmission_keyISNOTNULLANDstore_idISNOTNULLORevent_idISNOTNULL' THEN
      EXECUTE format('ALTER TABLE public.guest_attendances DROP CONSTRAINT %I', rule.conname);
      matched := matched + 1;
    END IF;
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.guest_attendances'::regclass
                 AND conname='guest_attendances_submission_required') THEN
    IF matched <> 1 THEN
      RAISE EXCEPTION 'Expected guest location constraint not found. No changes committed. Inspect table constraints first.';
    END IF;
    ALTER TABLE public.guest_attendances ADD CONSTRAINT guest_attendances_submission_required
      CHECK (time_source = 'LEGACY_DEVICE' OR submission_key IS NOT NULL);
  END IF;
END $$;
COMMIT;

-- Verify the resulting rules.
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.guest_attendances'::regclass AND contype = 'c';
