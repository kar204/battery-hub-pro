-- Add new roles for SP Battery and SP Invertor
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'sp_battery';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'sp_invertor';

-- Add new columns for dual-assignment and separate resolution tracking
ALTER TABLE public.service_tickets 
ADD COLUMN IF NOT EXISTS assigned_to_battery uuid,
ADD COLUMN IF NOT EXISTS assigned_to_invertor uuid,
ADD COLUMN IF NOT EXISTS battery_rechargeable boolean,
ADD COLUMN IF NOT EXISTS battery_resolved boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS battery_price numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS battery_resolved_by uuid,
ADD COLUMN IF NOT EXISTS battery_resolved_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS invertor_resolved boolean,
ADD COLUMN IF NOT EXISTS invertor_price numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS invertor_resolved_by uuid,
ADD COLUMN IF NOT EXISTS invertor_resolved_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS invertor_issue_description text;

-- Update the status logic: ticket is RESOLVED when both applicable parts are resolved
-- The application will handle this logic based on whether invertor_model is present

-- Create a function to calculate total service price
CREATE OR REPLACE FUNCTION public.calculate_total_service_price(ticket_row service_tickets)
RETURNS numeric
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(ticket_row.battery_price, 0) + COALESCE(ticket_row.invertor_price, 0);
$$;

COMMENT ON COLUMN public.service_tickets.assigned_to_battery IS 'SP Battery assigned to handle battery service';
COMMENT ON COLUMN public.service_tickets.assigned_to_invertor IS 'SP Invertor assigned to handle invertor service';
COMMENT ON COLUMN public.service_tickets.battery_rechargeable IS 'Whether battery is rechargeable (Yes/No from SP Battery)';
COMMENT ON COLUMN public.service_tickets.battery_resolved IS 'Whether battery part is resolved by SP Battery';
COMMENT ON COLUMN public.service_tickets.battery_price IS 'Price for battery service';
COMMENT ON COLUMN public.service_tickets.invertor_resolved IS 'Whether invertor part is resolved by SP Invertor';
COMMENT ON COLUMN public.service_tickets.invertor_price IS 'Price for invertor service';
COMMENT ON COLUMN public.service_tickets.invertor_issue_description IS 'Issue description from SP Invertor';