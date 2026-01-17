-- Add resolution and payment fields to service_tickets
ALTER TABLE public.service_tickets
ADD COLUMN resolution_notes text,
ADD COLUMN service_price numeric(10,2),
ADD COLUMN payment_method text;

