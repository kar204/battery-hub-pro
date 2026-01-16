-- Add invertor_model column to service_tickets
ALTER TABLE public.service_tickets 
ADD COLUMN invertor_model text;

-- Add unique ticket_number column for customer ID
ALTER TABLE public.service_tickets
ADD COLUMN ticket_number text UNIQUE;

-- Create function to generate ticket number
CREATE OR REPLACE FUNCTION public.generate_ticket_number()
RETURNS TRIGGER AS $$
DECLARE
  new_number text;
  year_month text;
  seq_num integer;
BEGIN
  year_month := TO_CHAR(NOW(), 'YYMM');
  
  -- Get the next sequence number for this month
  SELECT COALESCE(MAX(CAST(SUBSTRING(ticket_number FROM 5 FOR 4) AS INTEGER)), 0) + 1
  INTO seq_num
  FROM public.service_tickets
  WHERE ticket_number LIKE 'SRV' || year_month || '%';
  
  new_number := 'SRV' || year_month || LPAD(seq_num::text, 4, '0');
  NEW.ticket_number := new_number;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger to auto-generate ticket number
CREATE TRIGGER generate_ticket_number_trigger
BEFORE INSERT ON public.service_tickets
FOR EACH ROW
EXECUTE FUNCTION public.generate_ticket_number();

-- Add DELETE policy for admins on service_tickets
CREATE POLICY "Admins can delete tickets" 
ON public.service_tickets 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add DELETE policy for admins on products
CREATE POLICY "Admins can delete products" 
ON public.products 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));