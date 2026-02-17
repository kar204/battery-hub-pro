-- ============================================
-- FULL DATABASE MIGRATION SCRIPT
-- Replicate this database in a new Supabase project
-- ============================================

-- 1. CREATE ENUMS
CREATE TYPE public.app_role AS ENUM (
  'admin',
  'counter_staff',
  'service_agent',
  'warehouse_staff',
  'procurement_staff',
  'sp_battery',
  'sp_invertor',
  'seller',
  'scrap_manager'
);

CREATE TYPE public.service_status AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');
CREATE TYPE public.stock_source AS ENUM ('SHOP', 'SUPPLIER', 'WAREHOUSE');
CREATE TYPE public.transaction_type AS ENUM ('IN', 'OUT');

-- 2. CREATE TABLES

-- Products
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  model TEXT NOT NULL,
  capacity TEXT,
  category TEXT NOT NULL DEFAULT 'Battery',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Profiles
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User Roles
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Service Tickets
CREATE TABLE public.service_tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_number TEXT,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  battery_model TEXT NOT NULL,
  issue_description TEXT NOT NULL,
  invertor_model TEXT,
  invertor_issue_description TEXT,
  status public.service_status NOT NULL DEFAULT 'OPEN',
  assigned_to UUID,
  assigned_to_battery UUID,
  assigned_to_invertor UUID,
  created_by UUID NOT NULL,
  battery_price NUMERIC DEFAULT 0,
  battery_rechargeable BOOLEAN,
  battery_resolved BOOLEAN DEFAULT false,
  battery_resolved_by UUID,
  battery_resolved_at TIMESTAMPTZ,
  invertor_resolved BOOLEAN,
  invertor_price NUMERIC DEFAULT 0,
  invertor_resolved_by UUID,
  invertor_resolved_at TIMESTAMPTZ,
  service_price NUMERIC,
  resolution_notes TEXT,
  payment_method TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Service Logs
CREATE TABLE public.service_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES public.service_tickets(id),
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Warehouse Stock
CREATE TABLE public.warehouse_stock (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL UNIQUE REFERENCES public.products(id),
  quantity INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Shop Stock
CREATE TABLE public.shop_stock (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL UNIQUE REFERENCES public.products(id),
  quantity INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Shop Sales
CREATE TABLE public.shop_sales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_name TEXT NOT NULL,
  sold_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Shop Sale Items
CREATE TABLE public.shop_sale_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_id UUID NOT NULL REFERENCES public.shop_sales(id),
  product_id UUID REFERENCES public.products(id),
  product_type TEXT NOT NULL DEFAULT 'Battery',
  model_number TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  price NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Stock Transactions
CREATE TABLE public.stock_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id),
  quantity INTEGER NOT NULL,
  transaction_type public.transaction_type NOT NULL,
  source public.stock_source NOT NULL,
  handled_by UUID NOT NULL,
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Scrap Entries
CREATE TABLE public.scrap_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_name TEXT NOT NULL,
  scrap_item TEXT NOT NULL,
  scrap_model TEXT NOT NULL,
  scrap_value NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'IN',
  recorded_by UUID NOT NULL,
  marked_out_by UUID,
  marked_out_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. FUNCTIONS

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)), NEW.email);
  RETURN NEW;
END;
$$;

-- Trigger for new user profile
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Generate ticket number
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
  SELECT COALESCE(MAX(CAST(SUBSTRING(ticket_number FROM 8 FOR 4) AS INTEGER)), 0) + 1
  INTO seq_num
  FROM public.service_tickets
  WHERE ticket_number LIKE prefix || year_month || '%';
  new_number := prefix || year_month || LPAD(seq_num::text, 4, '0');
  NEW.ticket_number := new_number;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_ticket_number
  BEFORE INSERT ON public.service_tickets
  FOR EACH ROW EXECUTE FUNCTION public.generate_ticket_number();

-- Transfer warehouse OUT to shop stock
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

CREATE TRIGGER on_warehouse_stock_out
  AFTER INSERT ON public.stock_transactions
  FOR EACH ROW EXECUTE FUNCTION public.transfer_to_shop_on_warehouse_out();

-- Auto-create shop stock row for new products
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

CREATE TRIGGER on_product_created_shop_stock
  AFTER INSERT ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.create_shop_stock_for_product();

-- Updated at helper
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_service_tickets_updated_at BEFORE UPDATE ON public.service_tickets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_warehouse_stock_updated_at BEFORE UPDATE ON public.warehouse_stock FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_shop_stock_updated_at BEFORE UPDATE ON public.shop_stock FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Computed total service price
CREATE OR REPLACE FUNCTION public.calculate_total_service_price(ticket_row service_tickets)
RETURNS numeric
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT COALESCE(ticket_row.battery_price, 0) + COALESCE(ticket_row.invertor_price, 0);
$$;

-- Role helper functions
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.get_user_roles(_user_id uuid)
RETURNS SETOF app_role
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id
$$;

-- 4. ENABLE RLS ON ALL TABLES
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scrap_entries ENABLE ROW LEVEL SECURITY;

-- 5. RLS POLICIES

-- Products
CREATE POLICY "Authenticated users can view products" ON public.products FOR SELECT USING (true);
CREATE POLICY "Admins and procurement can manage products" ON public.products FOR ALL USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'procurement_staff'));
CREATE POLICY "Admins can delete products" ON public.products FOR DELETE USING (has_role(auth.uid(), 'admin'));

-- Profiles
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- User Roles
CREATE POLICY "Authenticated users can view roles" ON public.user_roles FOR SELECT USING (true);
CREATE POLICY "Admins can insert roles" ON public.user_roles FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update roles" ON public.user_roles FOR UPDATE USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete roles" ON public.user_roles FOR DELETE USING (has_role(auth.uid(), 'admin'));

-- Service Tickets
CREATE POLICY "Authenticated users can view tickets" ON public.service_tickets FOR SELECT USING (true);
CREATE POLICY "Counter staff and admins can create tickets" ON public.service_tickets FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'counter_staff'));
CREATE POLICY "Authenticated users can update tickets" ON public.service_tickets FOR UPDATE USING (true);
CREATE POLICY "Admins can delete tickets" ON public.service_tickets FOR DELETE USING (has_role(auth.uid(), 'admin'));

-- Service Logs
CREATE POLICY "Authenticated users can view logs" ON public.service_logs FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create logs" ON public.service_logs FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Warehouse Stock
CREATE POLICY "Authenticated users can view stock" ON public.warehouse_stock FOR SELECT USING (true);
CREATE POLICY "Warehouse and procurement staff can manage stock" ON public.warehouse_stock FOR ALL USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'warehouse_staff') OR has_role(auth.uid(), 'procurement_staff'));

-- Shop Stock
CREATE POLICY "Authenticated users can view shop stock" ON public.shop_stock FOR SELECT USING (true);
CREATE POLICY "Admin, counter staff, warehouse and seller can manage shop stock" ON public.shop_stock FOR ALL USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'counter_staff') OR has_role(auth.uid(), 'warehouse_staff') OR has_role(auth.uid(), 'seller'));

-- Shop Sales
CREATE POLICY "Authenticated users can view sales" ON public.shop_sales FOR SELECT USING (true);
CREATE POLICY "Admin, counter staff and seller can create sales" ON public.shop_sales FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'counter_staff') OR has_role(auth.uid(), 'seller'));

-- Shop Sale Items
CREATE POLICY "Authenticated users can view sale items" ON public.shop_sale_items FOR SELECT USING (true);
CREATE POLICY "Admin, counter staff and seller can create sale items" ON public.shop_sale_items FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'counter_staff') OR has_role(auth.uid(), 'seller'));

-- Stock Transactions
CREATE POLICY "Authenticated users can view transactions" ON public.stock_transactions FOR SELECT USING (true);
CREATE POLICY "Warehouse and procurement staff can create transactions" ON public.stock_transactions FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'warehouse_staff') OR has_role(auth.uid(), 'procurement_staff'));

-- Scrap Entries
CREATE POLICY "Authenticated users can view scrap" ON public.scrap_entries FOR SELECT USING (true);
CREATE POLICY "Admin, counter staff and scrap_manager can create scrap" ON public.scrap_entries FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'counter_staff') OR has_role(auth.uid(), 'scrap_manager'));
CREATE POLICY "Admin, counter staff and scrap_manager can update scrap" ON public.scrap_entries FOR UPDATE USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'counter_staff') OR has_role(auth.uid(), 'scrap_manager'));
