import { ServiceTicket } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import { useRef } from 'react';

interface PrintTicketProps {
  ticket: ServiceTicket;
  profileName: string;
}

export function PrintTicket({ ticket, profileName }: PrintTicketProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
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
              text-align: center;
              border-bottom: 2px solid #333;
              padding-bottom: 15px;
              margin-bottom: 20px;
            }
            .header h1 {
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
            .footer {
              margin-top: 30px;
              border-top: 1px solid #ddd;
              padding-top: 15px;
              font-size: 12px;
              color: #888;
            }
            .signature-line {
              margin-top: 50px;
              display: flex;
              justify-content: space-between;
            }
            .signature-box {
              width: 200px;
              border-top: 1px solid #333;
              padding-top: 5px;
              text-align: center;
              font-size: 12px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>SERVICE TICKET</h1>
            <div class="ticket-number">${ticket.ticket_number}</div>
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
          <div class="signature-line">
            <div class="signature-box">Customer Signature</div>
            <div class="signature-box">Staff Signature</div>
          </div>
          <div class="footer">
            Created: ${new Date(ticket.created_at).toLocaleString('en-IN')}
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
