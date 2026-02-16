import { useEffect, useState } from 'react';
import { Search, ShoppingCart, Package, Plus, Minus, X, History } from 'lucide-react';
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
import { format } from 'date-fns';

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
  product_id: string;
  price: string;
  quantity: number;
}

interface SaleRecord {
  id: string;
  customer_name: string;
  sold_by: string;
  created_at: string;
  items?: SaleItemRecord[];
}

interface SaleItemRecord {
  id: string;
  product_type: string;
  model_number: string;
  price: number | null;
  quantity: number;
  product_id: string | null;
}

export default function Shop() {
  const { user, hasAnyRole } = useAuth();
  const { toast } = useToast();
  const [shopStock, setShopStock] = useState<ShopStockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isSaleOpen, setIsSaleOpen] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [saleItems, setSaleItems] = useState<SaleItem[]>([{ product_type: 'Battery', product_id: '', price: '', quantity: 1 }]);
  const [salesHistory, setSalesHistory] = useState<SaleRecord[]>([]);

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
      const [stockRes, salesRes] = await Promise.all([
        supabase.from('shop_stock').select('*, product:products(id, name, model, capacity, category)'),
        supabase.from('shop_sales').select('*').order('created_at', { ascending: false }).limit(50),
      ]);
      const stockData = (stockRes.data as ShopStockItem[]) || [];
      setShopStock(stockData);

      // Fetch sale items for each sale
      const sales = (salesRes.data as SaleRecord[]) || [];
      if (sales.length > 0) {
        const saleIds = sales.map(s => s.id);
        const { data: itemsData } = await supabase
          .from('shop_sale_items')
          .select('*')
          .in('sale_id', saleIds);

        const itemsBySale: Record<string, SaleItemRecord[]> = {};
        (itemsData || []).forEach((item: any) => {
          if (!itemsBySale[item.sale_id]) itemsBySale[item.sale_id] = [];
          itemsBySale[item.sale_id].push(item);
        });

        sales.forEach(sale => {
          sale.items = itemsBySale[sale.id] || [];
        });
      }
      setSalesHistory(sales);
    } catch (error) {
      console.error('Error fetching shop data:', error);
    } finally {
      setLoading(false);
    }
  };

  const addSaleItem = () => {
    setSaleItems([...saleItems, { product_type: 'Battery', product_id: '', price: '', quantity: 1 }]);
  };

  const removeSaleItem = (index: number) => {
    if (saleItems.length === 1) return;
    setSaleItems(saleItems.filter((_, i) => i !== index));
  };

  const updateSaleItem = (index: number, field: keyof SaleItem, value: string | number) => {
    const updated = [...saleItems];
    (updated[index] as any)[field] = value;
    // When product changes, auto-set the product_type
    if (field === 'product_id') {
      const stock = shopStock.find(s => s.product_id === value);
      if (stock?.product?.category) {
        updated[index].product_type = stock.product.category;
      }
    }
    setSaleItems(updated);
  };

  // Filter available stock by product type for the dropdown
  const getAvailableProducts = (productType: string) => {
    return shopStock.filter(s => s.product?.category === productType && s.quantity > 0);
  };

  const handleRecordSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !customerName.trim()) {
      toast({ title: 'Customer name is required', variant: 'destructive' });
      return;
    }
    const validItems = saleItems.filter(item => item.product_id);
    if (validItems.length === 0) {
      toast({ title: 'Select at least one product', variant: 'destructive' });
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
        const stockItem = shopStock.find(s => s.product_id === item.product_id);
        const modelNumber = stockItem?.product ? `${stockItem.product.name} - ${stockItem.product.model}` : '';

        const { error: itemError } = await supabase.from('shop_sale_items').insert({
          sale_id: sale.id,
          product_type: item.product_type,
          model_number: modelNumber,
          price: item.price ? parseFloat(item.price) : null,
          product_id: item.product_id,
          quantity: item.quantity,
        });
        if (itemError) throw itemError;

        // Deduct from shop stock
        if (stockItem) {
          await supabase.from('shop_stock')
            .update({ quantity: Math.max(0, stockItem.quantity - item.quantity) })
            .eq('product_id', item.product_id);
        }
      }

      toast({ title: 'Sale recorded successfully' });
      setIsSaleOpen(false);
      setCustomerName('');
      setSaleItems([{ product_type: 'Battery', product_id: '', price: '', quantity: 1 }]);
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
                        <div className="space-y-1">
                          <Label className="text-xs">Product Type</Label>
                          <Select value={item.product_type} onValueChange={v => {
                            updateSaleItem(idx, 'product_type', v);
                            updateSaleItem(idx, 'product_id', '');
                          }}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Battery">Battery</SelectItem>
                              <SelectItem value="Inverter">Inverter</SelectItem>
                              <SelectItem value="UPS">UPS</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Product (from stock)</Label>
                          <Select value={item.product_id} onValueChange={v => updateSaleItem(idx, 'product_id', v)}>
                            <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                            <SelectContent>
                              {getAvailableProducts(item.product_type).map(s => (
                                <SelectItem key={s.product_id} value={s.product_id}>
                                  {s.product?.name} - {s.product?.model} (Qty: {s.quantity})
                                </SelectItem>
                              ))}
                              {getAvailableProducts(item.product_type).length === 0 && (
                                <div className="px-2 py-1.5 text-sm text-muted-foreground">No stock available</div>
                              )}
                            </SelectContent>
                          </Select>
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
              <TabsTrigger value="all">All Stock</TabsTrigger>
              <TabsTrigger value="Battery">Batteries</TabsTrigger>
              <TabsTrigger value="Inverter">Inverters</TabsTrigger>
              <TabsTrigger value="UPS">UPS</TabsTrigger>
              <TabsTrigger value="history">
                <History className="h-3 w-3 mr-1" />
                Sales History
              </TabsTrigger>
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
            <TabsContent value="history">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <History className="h-5 w-5" />
                    Sales History
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Items</TableHead>
                        <TableHead className="text-right">Total (₹)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {salesHistory.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground py-8">No sales recorded yet</TableCell>
                        </TableRow>
                      ) : salesHistory.map(sale => {
                        const total = (sale.items || []).reduce((s, i) => s + (i.price || 0) * i.quantity, 0);
                        return (
                          <TableRow key={sale.id}>
                            <TableCell>{format(new Date(sale.created_at), 'dd/MM/yyyy HH:mm')}</TableCell>
                            <TableCell className="font-medium">{sale.customer_name}</TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                {(sale.items || []).map(item => (
                                  <div key={item.id} className="text-sm">
                                    <Badge variant="outline" className="mr-1 text-xs">{item.product_type}</Badge>
                                    {item.model_number} × {item.quantity}
                                    {item.price ? ` — ₹${item.price.toLocaleString('en-IN')}` : ''}
                                  </div>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {total > 0 ? `₹${total.toLocaleString('en-IN')}` : '-'}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AppLayout>
  );
}
