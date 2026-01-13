import { AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { WarehouseStock } from '@/types/database';

interface LowStockAlertProps {
  items: WarehouseStock[];
}

export function LowStockAlert({ items }: LowStockAlertProps) {
  return (
    <Card className="border-destructive/30 bg-destructive/5">
      <CardHeader className="flex flex-row items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-destructive" />
        <CardTitle className="text-lg">Low Stock Alerts</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            All stock levels are healthy
          </p>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div 
                key={item.id} 
                className="flex items-center justify-between p-3 rounded-lg bg-background border border-destructive/20"
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
      </CardContent>
    </Card>
  );
}
