BEGIN;
-- Prevent concurrent deletes from cascading into assignment/history rows.
DO $$
DECLARE fk record;
BEGIN
  FOR fk IN
    SELECT c.conname, c.conrelid::regclass AS child_table, pg_get_constraintdef(c.oid) AS definition
    FROM pg_constraint c
    WHERE c.contype = 'f' AND c.confdeltype = 'c'
      AND c.confrelid IN ('public.stores'::regclass, 'public.branches'::regclass)
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', fk.child_table, fk.conname);
    EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I %s', fk.child_table, fk.conname,
                   replace(fk.definition, 'ON DELETE CASCADE', 'ON DELETE RESTRICT'));
  END LOOP;
END $$;
COMMIT;
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint WHERE contype = 'f'
AND confrelid IN ('public.stores'::regclass, 'public.branches'::regclass);
