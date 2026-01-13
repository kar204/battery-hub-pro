export type AppRole = 'admin' | 'counter_staff' | 'service_agent' | 'warehouse_staff' | 'procurement_staff';

export type ServiceStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

export type TransactionType = 'IN' | 'OUT';

export type StockSource = 'SHOP' | 'SUPPLIER' | 'WAREHOUSE';

export interface Profile {
  id: string;
  user_id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}

export interface ServiceTicket {
  id: string;
  customer_name: string;
  customer_phone: string;
  battery_model: string;
  issue_description: string;
  status: ServiceStatus;
  assigned_to: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ServiceLog {
  id: string;
  ticket_id: string;
  action: string;
  notes: string | null;
  user_id: string;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  model: string;
  capacity: string | null;
  price: number;
  created_at: string;
  updated_at: string;
}

export interface WarehouseStock {
  id: string;
  product_id: string;
  quantity: number;
  updated_at: string;
  product?: Product;
}

export interface StockTransaction {
  id: string;
  product_id: string;
  quantity: number;
  transaction_type: TransactionType;
  source: StockSource;
  handled_by: string;
  remarks: string | null;
  created_at: string;
  product?: Product;
}
