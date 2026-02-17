import { AlertTriangle } from 'lucide-react';
import { WarehouseStock } from '@/types/database';

interface LowStockAlertProps {
  items: WarehouseStock[];
}

export function LowStockAlert({ items }: LowStockAlertProps) {
  return (
    <div className="glass-card rounded-2xl border-destructive/20">
      <div className="flex items-center gap-2 p-6 pb-3">
        <AlertTriangle className="h-5 w-5 text-destructive" />
        <h3 className="text-lg font-semibold">Low Stock Alerts</h3>
      </div>
      <div className="px-6 pb-6">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            All stock levels are healthy ✓
          </p>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div 
                key={item.id} 
                className="flex items-center justify-between p-3 rounded-xl bg-destructive/5 border border-destructive/15 transition-colors hover:bg-destructive/10"
              >
                <div>
                  <p className="font-medium text-sm">{item.product?.name || 'Unknown Product'}</p>
                  <p className="text-xs text-muted-foreground">{item.product?.model}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-destructive">{item.quantity}</span>
                  <span className="text-xs text-muted-foreground">units</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
