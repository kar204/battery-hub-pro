
-- Update shop_sales INSERT policy to include seller
DROP POLICY IF EXISTS "Admin and counter staff can create sales" ON public.shop_sales;
CREATE POLICY "Admin, counter staff and seller can create sales"
  ON public.shop_sales FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'counter_staff'::app_role) OR
    has_role(auth.uid(), 'seller'::app_role)
  );

-- Update shop_sale_items INSERT policy to include seller
DROP POLICY IF EXISTS "Admin and counter staff can create sale items" ON public.shop_sale_items;
CREATE POLICY "Admin, counter staff and seller can create sale items"
  ON public.shop_sale_items FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'counter_staff'::app_role) OR
    has_role(auth.uid(), 'seller'::app_role)
  );

-- Update shop_stock management policy to include seller
DROP POLICY IF EXISTS "Admin and counter staff can manage shop stock" ON public.shop_stock;
CREATE POLICY "Admin, counter staff, warehouse and seller can manage shop stock"
  ON public.shop_stock FOR ALL
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'counter_staff'::app_role) OR
    has_role(auth.uid(), 'warehouse_staff'::app_role) OR
    has_role(auth.uid(), 'seller'::app_role)
  );

-- Update scrap INSERT policy to include scrap_manager
DROP POLICY IF EXISTS "Admin and counter staff can create scrap" ON public.scrap_entries;
CREATE POLICY "Admin, counter staff and scrap_manager can create scrap"
  ON public.scrap_entries FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'counter_staff'::app_role) OR
    has_role(auth.uid(), 'scrap_manager'::app_role)
  );

-- Update scrap UPDATE policy to include scrap_manager
DROP POLICY IF EXISTS "Admin and counter staff can update scrap" ON public.scrap_entries;
CREATE POLICY "Admin, counter staff and scrap_manager can update scrap"
  ON public.scrap_entries FOR UPDATE
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'counter_staff'::app_role) OR
    has_role(auth.uid(), 'scrap_manager'::app_role)
  );
