import { useEffect, useState } from 'react';
import { Search, ShoppingCart, Package, Plus, Minus, X } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface ShopStockItem {
  id: string;
  product_id: string;
  quantity: number;
  updated_at: string;
  product?: {
    id: string;
    name: string;
    model: string;
    capacity: string | null;
    category: string;
  };
}

interface SaleItem {
  product_type: string;
  model_number: string;
  price: string;
  product_id: string | null;
  quantity: number;
}

export default function Shop() {
  const { user, hasAnyRole } = useAuth();
  const { toast } = useToast();
  const [shopStock, setShopStock] = useState<ShopStockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isSaleOpen, setIsSaleOpen] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [saleItems, setSaleItems] = useState<SaleItem[]>([{ product_type: 'Battery', model_number: '', price: '', product_id: null, quantity: 1 }]);
  const [products, setProducts] = useState<any[]>([]);

  const canRecordSale = hasAnyRole(['admin', 'counter_staff']);

  useEffect(() => {
    fetchData();
    const channel = supabase
      .channel('shop-stock-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shop_stock' }, () => fetchData())
      .subscribe();
    return () => { channel.unsubscribe(); };
  }, []);

  const fetchData = async () => {
    try {
      const [stockRes, productsRes] = await Promise.all([
        supabase.from('shop_stock').select('*, product:products(id, name, model, capacity, category)'),
        supabase.from('products').select('*'),
      ]);
      setShopStock((stockRes.data as ShopStockItem[]) || []);
      setProducts(productsRes.data || []);
    } catch (error) {
      console.error('Error fetching shop data:', error);
    } finally {
      setLoading(false);
    }
  };

  const addSaleItem = () => {
    setSaleItems([...saleItems, { product_type: 'Battery', model_number: '', price: '', product_id: null, quantity: 1 }]);
  };

  const removeSaleItem = (index: number) => {
    if (saleItems.length === 1) return;
    setSaleItems(saleItems.filter((_, i) => i !== index));
  };

  const updateSaleItem = (index: number, field: keyof SaleItem, value: string | number | null) => {
    const updated = [...saleItems];
    (updated[index] as any)[field] = value;
    setSaleItems(updated);
  };

  const handleRecordSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !customerName.trim()) {
      toast({ title: 'Customer name is required', variant: 'destructive' });
      return;
    }
    const validItems = saleItems.filter(item => item.model_number.trim());
    if (validItems.length === 0) {
      toast({ title: 'Add at least one item', variant: 'destructive' });
      return;
    }

    try {
      const { data: sale, error: saleError } = await supabase
        .from('shop_sales')
        .insert({ customer_name: customerName.trim(), sold_by: user.id })
        .select()
        .single();
      if (saleError) throw saleError;

      for (const item of validItems) {
        const { error: itemError } = await supabase.from('shop_sale_items').insert({
          sale_id: sale.id,
          product_type: item.product_type,
          model_number: item.model_number,
          price: item.price ? parseFloat(item.price) : null,
          product_id: item.product_id,
          quantity: item.quantity,
        });
        if (itemError) throw itemError;

        // Deduct from shop stock if linked to a product
        if (item.product_id) {
          const stockItem = shopStock.find(s => s.product_id === item.product_id);
          if (stockItem) {
            await supabase.from('shop_stock')
              .update({ quantity: Math.max(0, stockItem.quantity - item.quantity) })
              .eq('product_id', item.product_id);
          }
        }
      }

      toast({ title: 'Sale recorded successfully' });
      setIsSaleOpen(false);
      setCustomerName('');
      setSaleItems([{ product_type: 'Battery', model_number: '', price: '', product_id: null, quantity: 1 }]);
      fetchData();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'An error occurred';
      toast({ title: 'Error recording sale', description: msg, variant: 'destructive' });
    }
  };

  const totalStock = shopStock.reduce((sum, s) => sum + s.quantity, 0);

  const filterByCategory = (category: string) =>
    shopStock.filter(item =>
      item.product?.category === category &&
      (item.product?.name?.toLowerCase().includes(search.toLowerCase()) ||
       item.product?.model?.toLowerCase().includes(search.toLowerCase()))
    );

  const renderStockTable = (items: ShopStockItem[]) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Product</TableHead>
          <TableHead>Model</TableHead>
          <TableHead>Capacity</TableHead>
          <TableHead className="text-right">Qty</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.length === 0 ? (
          <TableRow>
            <TableCell colSpan={5} className="text-center text-muted-foreground py-8">No stock available</TableCell>
          </TableRow>
        ) : items.map(item => (
          <TableRow key={item.id}>
            <TableCell className="font-medium">{item.product?.name}</TableCell>
            <TableCell>{item.product?.model}</TableCell>
            <TableCell>{item.product?.capacity || '-'}</TableCell>
            <TableCell className="text-right font-medium">{item.quantity}</TableCell>
            <TableCell>
              {item.quantity === 0 ? (
                <Badge variant="destructive">Out of Stock</Badge>
              ) : item.quantity < 5 ? (
                <Badge variant="destructive">Low Stock</Badge>
              ) : (
                <Badge variant="outline" className="bg-chart-4/20 text-chart-4 border-chart-4/30">In Stock</Badge>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Shop</h1>
            <p className="text-muted-foreground">Manage shop stock and record sales</p>
          </div>
          {canRecordSale && (
            <Dialog open={isSaleOpen} onOpenChange={setIsSaleOpen}>
              <DialogTrigger asChild>
                <Button>
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Record Sale
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Record Sale</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleRecordSale} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Customer Name</Label>
                    <Input value={customerName} onChange={e => setCustomerName(e.target.value)} required />
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Items</Label>
                      <Button type="button" variant="outline" size="sm" onClick={addSaleItem}>
                        <Plus className="h-3 w-3 mr-1" /> Add Item
                      </Button>
                    </div>
                    {saleItems.map((item, idx) => (
                      <div key={idx} className="border rounded-md p-3 space-y-3 relative">
                        {saleItems.length > 1 && (
                          <Button type="button" variant="ghost" size="icon" className="absolute top-1 right-1 h-6 w-6" onClick={() => removeSaleItem(idx)}>
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Product Type</Label>
                            <Select value={item.product_type} onValueChange={v => updateSaleItem(idx, 'product_type', v)}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Battery">Battery</SelectItem>
                                <SelectItem value="Inverter">Inverter</SelectItem>
                                <SelectItem value="UPS">UPS</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Model Number</Label>
                            <Input value={item.model_number} onChange={e => updateSaleItem(idx, 'model_number', e.target.value)} required />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Price (Optional)</Label>
                            <Input type="number" value={item.price} onChange={e => updateSaleItem(idx, 'price', e.target.value)} placeholder="₹" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Quantity</Label>
                            <div className="flex items-center gap-1">
                              <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => updateSaleItem(idx, 'quantity', Math.max(1, item.quantity - 1))}>
                                <Minus className="h-3 w-3" />
                              </Button>
                              <Input type="number" min="1" value={item.quantity} onChange={e => updateSaleItem(idx, 'quantity', parseInt(e.target.value) || 1)} className="w-16 text-center h-8" />
                              <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => updateSaleItem(idx, 'quantity', item.quantity + 1)}>
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button type="submit" className="w-full">Record Sale</Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Stats */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Shop Stock</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{totalStock}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Battery Stock</CardTitle>
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{filterByCategory('Battery').reduce((s, i) => s + i.quantity, 0)}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Inverter/UPS Stock</CardTitle>
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{filterByCategory('Inverter').reduce((s, i) => s + i.quantity, 0) + filterByCategory('UPS').reduce((s, i) => s + i.quantity, 0)}</div></CardContent>
          </Card>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 max-w-md" />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-pulse text-muted-foreground">Loading shop stock...</div>
          </div>
        ) : (
          <Tabs defaultValue="all">
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="Battery">Batteries</TabsTrigger>
              <TabsTrigger value="Inverter">Inverters</TabsTrigger>
              <TabsTrigger value="UPS">UPS</TabsTrigger>
            </TabsList>
            <TabsContent value="all">
              <Card><CardContent className="pt-6">{renderStockTable(shopStock.filter(item =>
                item.product?.name?.toLowerCase().includes(search.toLowerCase()) ||
                item.product?.model?.toLowerCase().includes(search.toLowerCase())
              ))}</CardContent></Card>
            </TabsContent>
            <TabsContent value="Battery">
              <Card><CardContent className="pt-6">{renderStockTable(filterByCategory('Battery'))}</CardContent></Card>
            </TabsContent>
            <TabsContent value="Inverter">
              <Card><CardContent className="pt-6">{renderStockTable(filterByCategory('Inverter'))}</CardContent></Card>
            </TabsContent>
            <TabsContent value="UPS">
              <Card><CardContent className="pt-6">{renderStockTable(filterByCategory('UPS'))}</CardContent></Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AppLayout>
  );
}
