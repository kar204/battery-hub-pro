-- Update ticket number generation to use AFT prefix and correct sequence extraction
CREATE OR REPLACE FUNCTION public.generate_ticket_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  new_number text;
  year_month text;
  seq_num integer;
  prefix text := 'AFT';
BEGIN
  year_month := TO_CHAR(NOW(), 'YYMM');

  -- Get the next sequence number for this month (last 4 digits)
  SELECT COALESCE(MAX(CAST(SUBSTRING(ticket_number FROM 8 FOR 4) AS INTEGER)), 0) + 1
  INTO seq_num
  FROM public.service_tickets
  WHERE ticket_number LIKE prefix || year_month || '%';

  new_number := prefix || year_month || LPAD(seq_num::text, 4, '0');
  NEW.ticket_number := new_number;
  RETURN NEW;
END;
$$;

-- Attach trigger so ticket_number is always generated on insert
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_generate_ticket_number'
  ) THEN
    CREATE TRIGGER trg_generate_ticket_number
    BEFORE INSERT ON public.service_tickets
    FOR EACH ROW
    WHEN (NEW.ticket_number IS NULL)
    EXECUTE FUNCTION public.generate_ticket_number();
  END IF;
END;
$$;