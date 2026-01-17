import { ServiceTicket } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';

interface PrintTicketProps {
  ticket: ServiceTicket;
  profileName: string;
}

export function PrintTicket({ ticket, profileName }: PrintTicketProps) {
  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const hasResolutionDetails = ticket.resolution_notes || 
      typeof ticket.service_price === 'number' || 
      ticket.payment_method;

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
              padding-top: 15px;
              border-top: 1px dashed #ccc;
            }
            .resolution-section h2 {
              font-size: 16px;
              margin: 0 0 15px 0;
              color: #333;
            }
            .price-highlight {
              font-size: 18px;
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
          </style>
        </head>
        <body>
          <div class="header">
            <div class="header-logo">
              <img src="/afsal-logo.png" alt="Afsal Traders logo" />
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
              <div class="label">Assigned To</div>
              <div class="value">${profileName}</div>
            </div>
          </div>
          <div class="section">
            <div class="label">Issue Description</div>
            <div class="value">${ticket.issue_description}</div>
          </div>
          ${hasResolutionDetails ? `
          <div class="resolution-section">
            <h2>Resolution Details</h2>
            <div class="grid">
              ${ticket.resolution_notes ? `
              <div class="section" style="grid-column: span 2;">
                <div class="label">Resolution Notes / Issue Brief</div>
                <div class="value">${ticket.resolution_notes}</div>
              </div>
              ` : ''}
              ${typeof ticket.service_price === 'number' ? `
              <div class="section">
                <div class="label">Service Price</div>
                <div class="value price-highlight">₹${ticket.service_price.toFixed(2)}</div>
              </div>
              ` : ''}
              ${ticket.payment_method ? `
              <div class="section">
                <div class="label">Payment Method</div>
                <div class="value"><span class="payment-badge">${ticket.payment_method}</span></div>
              </div>
              ` : ''}
            </div>
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
