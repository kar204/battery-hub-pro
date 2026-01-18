import { ServiceTicket } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';

interface PrintTicketProps {
  ticket: ServiceTicket;
  profileName: string;
  invertorProfileName?: string;
}

export function PrintTicket({ ticket, profileName, invertorProfileName }: PrintTicketProps) {
  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const hasBatteryResolution = ticket.battery_resolved;
    const hasInvertorResolution = ticket.invertor_model && ticket.invertor_resolved;
    const totalPrice = (ticket.battery_price || 0) + (ticket.invertor_price || 0);

    // Build absolute URL for the logo
    const logoUrl = `${window.location.origin}/afsal-logo.png`;

    printWindow.document.open();
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Service Ticket - ${ticket.ticket_number}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 20px;
              max-width: 800px;
              margin: 0 auto;
            }
            .header {
              display: flex;
              align-items: center;
              justify-content: space-between;
              border-bottom: 2px solid #333;
              padding-bottom: 15px;
              margin-bottom: 20px;
            }
            .header-logo {
              display: flex;
              align-items: center;
              justify-content: flex-start;
            }
            .header-logo img {
              height: 80px;
              width: 80px;
              object-fit: contain;
            }
            .header-text {
              text-align: right;
            }
            .header-text h1 {
              margin: 0;
              font-size: 24px;
            }
            .ticket-number {
              font-size: 18px;
              font-weight: bold;
              color: #666;
              margin-top: 10px;
            }
            .section {
              margin-bottom: 15px;
            }
            .label {
              font-weight: bold;
              color: #555;
              font-size: 12px;
              text-transform: uppercase;
            }
            .value {
              font-size: 14px;
              margin-top: 3px;
            }
            .grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 15px;
            }
            .resolution-section {
              margin-top: 20px;
              padding: 15px;
              border: 1px solid #ddd;
              border-radius: 8px;
              background: #f9f9f9;
            }
            .resolution-section h2 {
              font-size: 16px;
              margin: 0 0 15px 0;
              color: #333;
              border-bottom: 1px solid #ddd;
              padding-bottom: 8px;
            }
            .price-highlight {
              font-size: 18px;
              font-weight: bold;
              color: #2e7d32;
            }
            .total-section {
              margin-top: 20px;
              padding: 15px;
              background: #e8f5e9;
              border-radius: 8px;
              text-align: center;
            }
            .total-section .total-label {
              font-size: 14px;
              color: #555;
              margin-bottom: 5px;
            }
            .total-section .total-value {
              font-size: 24px;
              font-weight: bold;
              color: #2e7d32;
            }
            .payment-badge {
              display: inline-block;
              padding: 4px 12px;
              background: #e3f2fd;
              border-radius: 4px;
              font-weight: bold;
              color: #1565c0;
            }
            .footer {
              margin-top: 30px;
              border-top: 1px solid #ddd;
              padding-top: 15px;
              font-size: 12px;
              color: #888;
            }
            .status-badge {
              display: inline-block;
              padding: 4px 8px;
              border-radius: 4px;
              font-size: 12px;
              font-weight: bold;
            }
            .status-resolved { background: #e8f5e9; color: #2e7d32; }
            .status-pending { background: #fff3e0; color: #f57c00; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="header-logo">
              <img src="${logoUrl}" alt="Afsal Traders logo" />
            </div>
            <div class="header-text">
              <h1>SERVICE TICKET</h1>
              <div class="ticket-number">${ticket.ticket_number}</div>
            </div>
          </div>
          <div class="grid">
            <div class="section">
              <div class="label">Customer Name</div>
              <div class="value">${ticket.customer_name}</div>
            </div>
            <div class="section">
              <div class="label">Phone Number</div>
              <div class="value">${ticket.customer_phone}</div>
            </div>
            <div class="section">
              <div class="label">Battery Model</div>
              <div class="value">${ticket.battery_model}</div>
            </div>
            <div class="section">
              <div class="label">Invertor Model</div>
              <div class="value">${ticket.invertor_model || '-'}</div>
            </div>
            <div class="section">
              <div class="label">Status</div>
              <div class="value">${ticket.status.replace('_', ' ')}</div>
            </div>
            <div class="section">
              <div class="label">SP Battery</div>
              <div class="value">${profileName}</div>
            </div>
            ${ticket.invertor_model ? `
            <div class="section">
              <div class="label">SP Invertor</div>
              <div class="value">${invertorProfileName || 'Unassigned'}</div>
            </div>
            ` : ''}
          </div>
          <div class="section">
            <div class="label">Issue Description</div>
            <div class="value">${ticket.issue_description}</div>
          </div>
          
          ${hasBatteryResolution ? `
          <div class="resolution-section">
            <h2>🔋 Battery Service</h2>
            <div class="grid">
              <div class="section">
                <div class="label">Rechargeable</div>
                <div class="value">${ticket.battery_rechargeable ? 'Yes' : 'No'}</div>
              </div>
              <div class="section">
                <div class="label">Price</div>
                <div class="value price-highlight">₹${(ticket.battery_price || 0).toFixed(2)}</div>
              </div>
            </div>
          </div>
          ` : ''}
          
          ${hasInvertorResolution ? `
          <div class="resolution-section">
            <h2>⚡ Invertor Service</h2>
            <div class="grid">
              ${ticket.invertor_issue_description ? `
              <div class="section" style="grid-column: span 2;">
                <div class="label">Issue Description</div>
                <div class="value">${ticket.invertor_issue_description}</div>
              </div>
              ` : ''}
              <div class="section">
                <div class="label">Resolved</div>
                <div class="value">${ticket.invertor_resolved ? 'Yes' : 'No'}</div>
              </div>
              <div class="section">
                <div class="label">Price</div>
                <div class="value price-highlight">₹${(ticket.invertor_price || 0).toFixed(2)}</div>
              </div>
            </div>
          </div>
          ` : ''}
          
          ${(hasBatteryResolution || hasInvertorResolution) ? `
          <div class="total-section">
            <div class="total-label">TOTAL SERVICE AMOUNT</div>
            <div class="total-value">₹${totalPrice.toFixed(2)}</div>
            ${ticket.payment_method ? `
            <div style="margin-top: 10px;">
              <span class="payment-badge">Payment: ${ticket.payment_method}</span>
            </div>
            ` : ''}
          </div>
          ` : ''}
          
          <div class="footer">
            Created: ${new Date(ticket.created_at).toLocaleString('en-IN')}
            ${ticket.updated_at !== ticket.created_at ? ` | Updated: ${new Date(ticket.updated_at).toLocaleString('en-IN')}` : ''}
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };

  return (
    <Button variant="outline" size="sm" onClick={handlePrint}>
      <Printer className="h-4 w-4 mr-2" />
      Print
    </Button>
  );
}