-- Fix the mutable search_path warning on the set_updated_at trigger function.
-- CREATE OR REPLACE preserves the existing trigger dependency.

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $func$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$func$;
