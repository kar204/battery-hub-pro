-- Add missing columns for service ticket resolution
ALTER TABLE public.service_tickets
ADD COLUMN resolution_notes text;

ALTER TABLE public.service_tickets
ADD COLUMN service_price numeric(10,2);

ALTER TABLE public.service_tickets
ADD COLUMN payment_method text;