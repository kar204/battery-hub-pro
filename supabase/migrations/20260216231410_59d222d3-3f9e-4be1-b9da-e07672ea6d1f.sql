
-- Add new roles to the enum (must be separate transaction)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'seller';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'scrap_manager';
