import { ServiceTicket, WarehouseStock, Product } from '@/types/database';

// CSV Export utility functions

export function downloadCSV(data: Record<string, unknown>[], filename: string) {
  if (data.length === 0) return;
  
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => {
        const value = row[header];
        // Handle special characters and wrap in quotes if needed
        if (value === null || value === undefined) return '';
        const stringValue = String(value);
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      }).join(',')
    )
  ].join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function formatTicketForExport(ticket: ServiceTicket, profileName: string) {
  const totalPrice = (ticket.battery_price || 0) + (ticket.invertor_price || 0);
  return {
    'Ticket Number': ticket.ticket_number || '',
    'Customer Name': ticket.customer_name,
    'Phone': ticket.customer_phone,
    'Battery Model': ticket.battery_model,
    'Invertor Model': ticket.invertor_model || '',
    'Issue': ticket.issue_description,
    'Status': ticket.status,
    'SP Battery': profileName,
    'Battery Rechargeable': ticket.battery_rechargeable === true ? 'Yes' : ticket.battery_rechargeable === false ? 'No' : '',
    'Battery Price': ticket.battery_price || 0,
    'Invertor Price': ticket.invertor_price || 0,
    'Total Price': totalPrice,
    'Payment Method': ticket.payment_method || '',
    'Created At': new Date(ticket.created_at).toLocaleString('en-IN'),
  };
}

export function formatStockForExport(item: WarehouseStock) {
  return {
    'Product': item.product?.name || '',
    'Model': item.product?.model || '',
    'Capacity': item.product?.capacity || '-',
    'Quantity': item.quantity,
    'Status': item.quantity < 5 ? 'Low Stock' : item.quantity < 20 ? 'Medium' : 'In Stock',
  };
}

interface DashboardStats {
  openTickets: number;
  inProgressTickets: number;
  closedToday: number;
  totalStock: number;
  lowStockCount: number;
}

export function formatDashboardStatsForExport(stats: DashboardStats, date: Date) {
  return [{
    'Report Date': date.toLocaleDateString('en-IN'),
    'Open Tickets': stats.openTickets,
    'In Progress': stats.inProgressTickets,
    'Closed Today': stats.closedToday,
    'Total Stock Units': stats.totalStock,
    'Low Stock Items': stats.lowStockCount,
  }];
}
