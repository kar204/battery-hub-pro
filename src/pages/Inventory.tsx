import { useEffect, useState } from 'react';
import { Plus, Search, Package, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { Product, WarehouseStock, TransactionType, StockSource } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

export default function Inventory() {
  const { user, hasAnyRole } = useAuth();
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [stock, setStock] = useState<WarehouseStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [isStockTransferOpen, setIsStockTransferOpen] = useState(false);

  // Product form
  const [productForm, setProductForm] = useState({
    name: '',
    model: '',
    capacity: '',
    price: '',
  });

  // Stock transfer form
  const [transferForm, setTransferForm] = useState({
    product_id: '',
    quantity: '',
    transaction_type: '' as TransactionType | '',
    source: '' as StockSource | '',
    remarks: '',
  });

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel('inventory-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'warehouse_stock' }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, []);

  const fetchData = async () => {
    try {
      const [productsRes, stockRes] = await Promise.all([
        supabase.from('products').select('*').order('name'),
        supabase.from('warehouse_stock').select('*, product:products(*)'),
      ]);

      setProducts((productsRes.data as Product[]) || []);
      setStock((stockRes.data as WarehouseStock[]) || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { data: product, error: productError } = await supabase
        .from('products')
        .insert({
          name: productForm.name,
          model: productForm.model,
          capacity: productForm.capacity || null,
          price: parseFloat(productForm.price) || 0,
        })
        .select()
        .single();

      if (productError) throw productError;

      // Create initial stock entry
      const { error: stockError } = await supabase
        .from('warehouse_stock')
        .insert({
          product_id: product.id,
          quantity: 0,
        });

      if (stockError) throw stockError;

      toast({ title: 'Product added successfully' });
      setIsAddProductOpen(false);
      setProductForm({ name: '', model: '', capacity: '', price: '' });
      fetchData();
    } catch (error: any) {
      toast({ title: 'Error adding product', description: error.message, variant: 'destructive' });
    }
  };

  const handleStockTransfer = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user || !transferForm.product_id || !transferForm.transaction_type || !transferForm.source) return;

    const quantity = parseInt(transferForm.quantity);
    if (isNaN(quantity) || quantity <= 0) {
      toast({ title: 'Invalid quantity', variant: 'destructive' });
      return;
    }

    try {
      // Create transaction record
      const { error: transError } = await supabase.from('stock_transactions').insert({
        product_id: transferForm.product_id,
        quantity,
        transaction_type: transferForm.transaction_type,
        source: transferForm.source,
        handled_by: user.id,
        remarks: transferForm.remarks || null,
      });

      if (transError) throw transError;

      // Update stock quantity
      const currentStock = stock.find(s => s.product_id === transferForm.product_id);
      const currentQty = currentStock?.quantity || 0;
      const newQty = transferForm.transaction_type === 'IN' 
        ? currentQty + quantity 
        : Math.max(0, currentQty - quantity);

      if (currentStock) {
        const { error: updateError } = await supabase
          .from('warehouse_stock')
          .update({ quantity: newQty })
          .eq('id', currentStock.id);

        if (updateError) throw updateError;
      }

      toast({ 
        title: `Stock ${transferForm.transaction_type === 'IN' ? 'added' : 'removed'} successfully`,
        description: `${quantity} units ${transferForm.transaction_type === 'IN' ? 'added to' : 'removed from'} inventory`
      });
      setIsStockTransferOpen(false);
      setTransferForm({ product_id: '', quantity: '', transaction_type: '', source: '', remarks: '' });
      fetchData();
    } catch (error: any) {
      toast({ title: 'Error processing transfer', description: error.message, variant: 'destructive' });
    }
  };

  const filteredStock = stock.filter(item =>
    item.product?.name?.toLowerCase().includes(search.toLowerCase()) ||
    item.product?.model?.toLowerCase().includes(search.toLowerCase())
  );

  const canManageProducts = hasAnyRole(['admin', 'procurement_staff']);
  const canManageStock = hasAnyRole(['admin', 'warehouse_staff', 'procurement_staff']);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Inventory</h1>
            <p className="text-muted-foreground">Manage warehouse stock and products</p>
          </div>
          <div className="flex gap-2">
            {canManageProducts && (
              <Dialog open={isAddProductOpen} onOpenChange={setIsAddProductOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Product
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Product</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleAddProduct} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="product-name">Product Name</Label>
                      <Input
                        id="product-name"
                        value={productForm.name}
                        onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="product-model">Model</Label>
                        <Input
                          id="product-model"
                          value={productForm.model}
                          onChange={(e) => setProductForm({ ...productForm, model: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="product-capacity">Capacity</Label>
                        <Input
                          id="product-capacity"
                          value={productForm.capacity}
                          onChange={(e) => setProductForm({ ...productForm, capacity: e.target.value })}
                          placeholder="e.g., 12V 100Ah"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="product-price">Price (₹)</Label>
                      <Input
                        id="product-price"
                        type="number"
                        step="0.01"
                        value={productForm.price}
                        onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                        required
                      />
                    </div>
                    <Button type="submit" className="w-full">Add Product</Button>
                  </form>
                </DialogContent>
              </Dialog>
            )}
            {canManageStock && (
              <Dialog open={isStockTransferOpen} onOpenChange={setIsStockTransferOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Package className="h-4 w-4 mr-2" />
                    Stock Transfer
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Stock Transfer</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleStockTransfer} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Product</Label>
                      <Select 
                        value={transferForm.product_id} 
                        onValueChange={(value) => setTransferForm({ ...transferForm, product_id: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select product" />
                        </SelectTrigger>
                        <SelectContent>
                          {products.map((product) => (
                            <SelectItem key={product.id} value={product.id}>
                              {product.name} - {product.model}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Transaction Type</Label>
                        <Select 
                          value={transferForm.transaction_type} 
                          onValueChange={(value) => setTransferForm({ ...transferForm, transaction_type: value as TransactionType })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="IN">Stock In</SelectItem>
                            <SelectItem value="OUT">Stock Out</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Source</Label>
                        <Select 
                          value={transferForm.source} 
                          onValueChange={(value) => setTransferForm({ ...transferForm, source: value as StockSource })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select source" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="SUPPLIER">Supplier</SelectItem>
                            <SelectItem value="WAREHOUSE">Warehouse</SelectItem>
                            <SelectItem value="SHOP">Shop</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="quantity">Quantity</Label>
                      <Input
                        id="quantity"
                        type="number"
                        min="1"
                        value={transferForm.quantity}
                        onChange={(e) => setTransferForm({ ...transferForm, quantity: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="remarks">Remarks (Optional)</Label>
                      <Textarea
                        id="remarks"
                        value={transferForm.remarks}
                        onChange={(e) => setTransferForm({ ...transferForm, remarks: e.target.value })}
                      />
                    </div>
                    <Button type="submit" className="w-full">Process Transfer</Button>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 max-w-md"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-pulse text-muted-foreground">Loading inventory...</div>
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Current Stock</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead>Capacity</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Total Value</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStock.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        No products in inventory
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredStock.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.product?.name}</TableCell>
                        <TableCell>{item.product?.model}</TableCell>
                        <TableCell>{item.product?.capacity || '-'}</TableCell>
                        <TableCell className="text-right">₹{Number(item.product?.price || 0).toLocaleString('en-IN')}</TableCell>
                        <TableCell className="text-right font-medium">{item.quantity}</TableCell>
                        <TableCell className="text-right">
                          ₹{(item.quantity * Number(item.product?.price || 0)).toLocaleString('en-IN')}
                        </TableCell>
                        <TableCell>
                          {item.quantity < 5 ? (
                            <Badge variant="destructive" className="gap-1">
                              <ArrowDownCircle className="h-3 w-3" />
                              Low Stock
                            </Badge>
                          ) : item.quantity < 20 ? (
                            <Badge variant="secondary" className="gap-1">
                              Medium
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1 bg-chart-4/20 text-chart-4 border-chart-4/30">
                              <ArrowUpCircle className="h-3 w-3" />
                              In Stock
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
