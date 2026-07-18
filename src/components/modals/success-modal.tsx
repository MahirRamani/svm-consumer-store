// components/pos/success-modal.tsx
"use client";

import { useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle, Printer, X } from 'lucide-react';
import { toast } from 'sonner';

interface TransactionData {
  student: string;
  amount: number;
  remainingBalance: number;
  _id: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
}

interface SuccessModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transactionData: TransactionData | null;
  onClose: () => void;
}

export default function SuccessModal({ open, onOpenChange, transactionData, onClose }: SuccessModalProps) {
  const currentDate = useMemo(() => new Date(), []);

  const formattedDate = useMemo(() => {
    return currentDate.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }, [currentDate]);

  const formattedTime = useMemo(() => {
    return currentDate.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [currentDate]);

  const handlePrintReceipt = useCallback(() => {
    if (!transactionData) return;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Receipt - ${transactionData._id}</title>
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { 
                font-family: 'Courier New', monospace; 
                padding: 20px; 
                line-height: 1.6;
                background: white;
              }
              .receipt { 
                max-width: 350px; 
                margin: 0 auto; 
                border: 2px solid #000;
                padding: 20px;
              }
              .header { 
                text-align: center; 
                border-bottom: 2px dashed #000;
                padding-bottom: 15px;
                margin-bottom: 15px;
              }
              .header h1 { 
                font-size: 24px; 
                font-weight: bold;
                margin-bottom: 5px;
              }
              .header p { 
                font-size: 12px; 
                color: #666;
              }
              .section { 
                margin: 15px 0; 
                padding: 10px 0;
              }
              .section-title {
                font-weight: bold;
                font-size: 14px;
                margin-bottom: 8px;
                text-transform: uppercase;
              }
              .row { 
                display: flex; 
                justify-content: space-between; 
                margin: 5px 0;
                font-size: 13px;
              }
              .items { 
                border-top: 1px dashed #000;
                border-bottom: 1px dashed #000;
                padding: 10px 0;
                margin: 15px 0;
              }
              .item { 
                margin: 8px 0;
                padding: 5px 0;
              }
              .item-name { 
                font-size: 13px;
                margin-bottom: 3px;
              }
              .item-details {
                font-size: 11px;
                color: #666;
                display: flex;
                justify-content: space-between;
              }
              .total { 
                border-top: 2px solid #000;
                border-bottom: 2px solid #000;
                padding: 10px 0;
                margin: 15px 0;
                font-weight: bold;
                font-size: 16px;
              }
              .footer { 
                text-align: center; 
                margin-top: 20px;
                padding-top: 15px;
                border-top: 2px dashed #000;
                font-size: 12px;
              }
              .bold { font-weight: bold; }
              @media print {
                body { padding: 0; }
                .receipt { border: none; }
              }
            </style>
          </head>
          <body>
            <div class="receipt">
              <div class="header">
                <h1>CONSUMER STORE</h1>
                <p>Official Receipt</p>
              </div>
              
              <div class="section">
                <div class="row">
                  <span>Transaction ID:</span>
                  <span class="bold">${transactionData._id}</span>
                </div>
                <div class="row">
                  <span>Date:</span>
                  <span>${formattedDate}</span>
                </div>
                <div class="row">
                  <span>Time:</span>
                  <span>${formattedTime}</span>
                </div>
              </div>

              <div class="section">
                <div class="section-title">Customer Details</div>
                <div class="row">
                  <span>Student:</span>
                  <span class="bold">${transactionData.student}</span>
                </div>
              </div>

              <div class="items">
                <div class="section-title">Items Purchased</div>
                ${transactionData.items
                  .map(
                    (item) => `
                  <div class="item">
                    <div class="item-name">${item.name}</div>
                    <div class="item-details">
                      <span>${item.quantity} × ₹${item.price.toFixed(2)}</span>
                      <span class="bold">₹${(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                  </div>
                `
                  )
                  .join("")}
              </div>

              <div class="section">
                <div class="total">
                  <div class="row">
                    <span>TOTAL AMOUNT:</span>
                    <span>₹${transactionData.amount.toFixed(2)}</span>
                  </div>
                </div>
                <div class="row bold">
                  <span>Remaining Balance:</span>
                  <span>₹${transactionData.remainingBalance.toFixed(2)}</span>
                </div>
              </div>

              <div class="footer">
                <p>Thank you for your purchase!</p>
                <p style="margin-top: 10px;">Visit us again soon</p>
              </div>
            </div>
            <script>
              window.onload = function() { window.print(); }
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  }, [transactionData, formattedDate, formattedTime]);

  if (!transactionData) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center text-green-600">
            <CheckCircle className="w-6 h-6 mr-2" />
            Transaction Successful
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Transaction Summary */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="text-center">
              <p className="text-sm text-gray-600">Transaction ID</p>
              <p className="font-mono font-bold text-lg">#TXN{transactionData._id}</p>
              <p className="text-xs text-gray-500 mt-1">
                {formattedDate} • {formattedTime}
              </p>
            </div>
          </div>

          {/* Student Info */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Student:</span>
              <span className="font-medium">{transactionData.student}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Amount Charged:</span>
              <span className="font-bold text-red-600">₹{transactionData.amount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Remaining Balance:</span>
              <span className="font-bold text-green-600">₹{transactionData.remainingBalance.toFixed(2)}</span>
            </div>
          </div>

          {/* Items List */}
          <div className="border-t pt-4">
            <p className="font-medium text-gray-900 mb-2">Items Purchased:</p>
            <div className="space-y-1 max-h-36 overflow-y-auto">
              {transactionData.items.map((item, index) => (
                <div key={index} className="flex justify-between text-sm">
                  <span className="text-gray-700">
                    {item.name} × {item.quantity}
                  </span>
                  <span className="font-medium text-gray-900">₹{(item.price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4">
            <Button onClick={handlePrintReceipt} variant="outline" className="flex-1">
              <Printer className="w-4 h-4 mr-2" />
              Print
            </Button>
            <Button onClick={onClose} className="flex-1 bg-green-500 hover:bg-green-600 text-white">
              <X className="w-4 h-4 mr-2" />
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}