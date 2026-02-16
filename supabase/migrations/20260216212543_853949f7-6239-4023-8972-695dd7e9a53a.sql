
-- Add category to products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'Battery';

-- Create shop_stock table (mirrors warehouse_stock but for the shop)
CREATE TABLE public.shop_stock (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(product_id)
);

ALTER TABLE public.shop_stock ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view shop stock" ON public.shop_stock FOR SELECT USING (true);
CREATE POLICY "Admin and counter staff can manage shop stock" ON public.shop_stock FOR ALL USING (
  has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'counter_staff'::app_role) OR has_role(auth.uid(), 'warehouse_staff'::app_role)
);

-- Create shop_sales table
CREATE TABLE public.shop_sales (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_name text NOT NULL,
  sold_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.shop_sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view sales" ON public.shop_sales FOR SELECT USING (true);
CREATE POLICY "Admin and counter staff can create sales" ON public.shop_sales FOR INSERT WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'counter_staff'::app_role)
);

-- Create shop_sale_items table
CREATE TABLE public.shop_sale_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_id uuid NOT NULL REFERENCES public.shop_sales(id) ON DELETE CASCADE,
  product_type text NOT NULL DEFAULT 'Battery',
  model_number text NOT NULL,
  price numeric NULL,
  product_id uuid REFERENCES public.products(id),
  quantity integer NOT NULL DEFAULT 1,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.shop_sale_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view sale items" ON public.shop_sale_items FOR SELECT USING (true);
CREATE POLICY "Admin and counter staff can create sale items" ON public.shop_sale_items FOR INSERT WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'counter_staff'::app_role)
);

-- Create scrap_entries table
CREATE TABLE public.scrap_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_name text NOT NULL,
  scrap_item text NOT NULL,
  scrap_model text NOT NULL,
  scrap_value numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'IN',
  marked_out_at timestamp with time zone NULL,
  marked_out_by uuid NULL,
  recorded_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.scrap_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view scrap" ON public.scrap_entries FOR SELECT USING (true);
CREATE POLICY "Admin and counter staff can create scrap" ON public.scrap_entries FOR INSERT WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'counter_staff'::app_role)
);
CREATE POLICY "Admin and counter staff can update scrap" ON public.scrap_entries FOR UPDATE USING (
  has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'counter_staff'::app_role)
);

-- Initialize shop_stock for existing products
INSERT INTO public.shop_stock (product_id, quantity)
SELECT id, 0 FROM public.products
ON CONFLICT (product_id) DO NOTHING;

-- Create trigger to auto-create shop_stock when a product is added
CREATE OR REPLACE FUNCTION public.create_shop_stock_for_product()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.shop_stock (product_id, quantity) VALUES (NEW.id, 0) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER create_shop_stock_on_product
  AFTER INSERT ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.create_shop_stock_for_product();

-- Function to transfer stock from warehouse to shop on warehouse OUT to SHOP
CREATE OR REPLACE FUNCTION public.transfer_to_shop_on_warehouse_out()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.transaction_type = 'OUT' AND NEW.source = 'SHOP' THEN
    INSERT INTO public.shop_stock (product_id, quantity)
    VALUES (NEW.product_id, NEW.quantity)
    ON CONFLICT (product_id) DO UPDATE SET quantity = shop_stock.quantity + NEW.quantity, updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER transfer_stock_to_shop
  AFTER INSERT ON public.stock_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.transfer_to_shop_on_warehouse_out();
