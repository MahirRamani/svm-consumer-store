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

// // components/pos/success-modal.tsx
// "use client";

// import { useMemo, useCallback } from 'react';
// import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
// import { Button } from '@/components/ui/button';
// import { Separator } from '@/components/ui/separator';
// import { Badge } from '@/components/ui/badge';
// import { ScrollArea } from '@/components/ui/scroll-area';
// import { CheckCircle2, Printer, X, Download, Clock, Calendar } from 'lucide-react';
// import { toast } from 'sonner';

// interface TransactionData {
//   student: string;
//   amount: number;
//   remainingBalance: number;
//   id: string;
//   items: Array<{
//     name: string;
//     quantity: number;
//     price: number;
//   }>;
// }

// interface SuccessModalProps {
//   open: boolean;
//   onOpenChange: (open: boolean) => void;
//   transactionData: TransactionData | null;
//   onClose: () => void;
// }

// export default function SuccessModal({ open, onOpenChange, transactionData, onClose }: SuccessModalProps) {
//   const currentDate = useMemo(() => new Date(), []);

//   const itemsCount = useMemo(() => {
//     if (!transactionData) return 0;
//     return transactionData.items.reduce((sum, item) => sum + item.quantity, 0);
//   }, [transactionData]);

//   const formattedDate = useMemo(() => {
//     return currentDate.toLocaleDateString("en-GB", {
//       day: "2-digit",
//       month: "short",
//       year: "numeric",
//     });
//   }, [currentDate]);

//   const formattedTime = useMemo(() => {
//     return currentDate.toLocaleTimeString("en-GB", {
//       hour: "2-digit",
//       minute: "2-digit",
//       second: "2-digit",
//     });
//   }, [currentDate]);

//   const handlePrintReceipt = useCallback(() => {
//     if (!transactionData) return;

//     const printWindow = window.open("", "_blank");
//     if (printWindow) {
//       printWindow.document.write(`
//         <!DOCTYPE html>
//         <html>
//           <head>
//             <title>Receipt - ${transactionData.id}</title>
//             <style>
//               * { margin: 0; padding: 0; box-sizing: border-box; }
//               body { 
//                 font-family: 'Courier New', monospace; 
//                 padding: 20px; 
//                 line-height: 1.6;
//                 background: white;
//               }
//               .receipt { 
//                 max-width: 350px; 
//                 margin: 0 auto; 
//                 border: 2px solid #000;
//                 padding: 20px;
//               }
//               .header { 
//                 text-align: center; 
//                 border-bottom: 2px dashed #000;
//                 padding-bottom: 15px;
//                 margin-bottom: 15px;
//               }
//               .header h1 { 
//                 font-size: 24px; 
//                 font-weight: bold;
//                 margin-bottom: 5px;
//               }
//               .header p { 
//                 font-size: 12px; 
//                 color: #666;
//               }
//               .section { 
//                 margin: 15px 0; 
//                 padding: 10px 0;
//               }
//               .section-title {
//                 font-weight: bold;
//                 font-size: 14px;
//                 margin-bottom: 8px;
//                 text-transform: uppercase;
//               }
//               .row { 
//                 display: flex; 
//                 justify-content: space-between; 
//                 margin: 5px 0;
//                 font-size: 13px;
//               }
//               .items { 
//                 border-top: 1px dashed #000;
//                 border-bottom: 1px dashed #000;
//                 padding: 10px 0;
//                 margin: 15px 0;
//               }
//               .item { 
//                 margin: 8px 0;
//                 padding: 5px 0;
//               }
//               .item-name { 
//                 font-size: 13px;
//                 margin-bottom: 3px;
//               }
//               .item-details {
//                 font-size: 11px;
//                 color: #666;
//                 display: flex;
//                 justify-content: space-between;
//               }
//               .total { 
//                 border-top: 2px solid #000;
//                 border-bottom: 2px solid #000;
//                 padding: 10px 0;
//                 margin: 15px 0;
//                 font-weight: bold;
//                 font-size: 16px;
//               }
//               .footer { 
//                 text-align: center; 
//                 margin-top: 20px;
//                 padding-top: 15px;
//                 border-top: 2px dashed #000;
//                 font-size: 12px;
//               }
//               .bold { font-weight: bold; }
//               .large { font-size: 16px; }
//               @media print {
//                 body { padding: 0; }
//                 .receipt { border: none; }
//               }
//             </style>
//           </head>
//           <body>
//             <div class="receipt">
//               <div class="header">
//                 <h1>HOSTEL STORE</h1>
//                 <p>Official Receipt</p>
//               </div>
              
//               <div class="section">
//                 <div class="row">
//                   <span>Transaction ID:</span>
//                   <span class="bold">${transactionData.id}</span>
//                 </div>
//                 <div class="row">
//                   <span>Date:</span>
//                   <span>${formattedDate}</span>
//                 </div>
//                 <div class="row">
//                   <span>Time:</span>
//                   <span>${formattedTime}</span>
//                 </div>
//               </div>

//               <div class="section">
//                 <div class="section-title">Customer Details</div>
//                 <div class="row">
//                   <span>Student:</span>
//                   <span class="bold">${transactionData.student}</span>
//                 </div>
//               </div>

//               <div class="items">
//                 <div class="section-title">Items Purchased</div>
//                 ${transactionData.items
//                   .map(
//                     (item) => `
//                   <div class="item">
//                     <div class="item-name">${item.name}</div>
//                     <div class="item-details">
//                       <span>${item.quantity} × ₹${item.price.toFixed(2)}</span>
//                       <span class="bold">₹${(item.price * item.quantity).toFixed(2)}</span>
//                     </div>
//                   </div>
//                 `
//                   )
//                   .join("")}
//               </div>

//               <div class="section">
//                 <div class="row">
//                   <span>Total Items:</span>
//                   <span>${itemsCount}</span>
//                 </div>
//                 <div class="total">
//                   <div class="row">
//                     <span>TOTAL AMOUNT:</span>
//                     <span>₹${transactionData.amount.toFixed(2)}</span>
//                   </div>
//                 </div>
//                 <div class="row">
//                   <span>Previous Balance:</span>
//                   <span>₹${(transactionData.remainingBalance + transactionData.amount).toFixed(2)}</span>
//                 </div>
//                 <div class="row">
//                   <span>Amount Deducted:</span>
//                   <span>-₹${transactionData.amount.toFixed(2)}</span>
//                 </div>
//                 <div class="row bold">
//                   <span>Remaining Balance:</span>
//                   <span>₹${transactionData.remainingBalance.toFixed(2)}</span>
//                 </div>
//               </div>

//               <div class="footer">
//                 <p>Thank you for your purchase!</p>
//                 <p style="margin-top: 10px;">Visit us again soon</p>
//               </div>
//             </div>
//             <script>
//               window.onload = function() { window.print(); }
//             </script>
//           </body>
//         </html>
//       `);
//       printWindow.document.close();
//     }
//   }, [transactionData, formattedDate, formattedTime, itemsCount]);

//   const handleDownloadReceipt = useCallback(() => {
//     if (!transactionData) return;

//     const receiptText = `
// HOSTEL STORE - RECEIPT
// ${"=".repeat(40)}

// Transaction ID: ${transactionData.id}
// Date: ${formattedDate}
// Time: ${formattedTime}

// Student: ${transactionData.student}

// ITEMS PURCHASED:
// ${"-".repeat(40)}
// ${transactionData.items
//   .map((item) => `${item.name}\n  ${item.quantity} × ₹${item.price.toFixed(2)} = ₹${(item.price * item.quantity).toFixed(2)}`)
//   .join("\n\n")}

// ${"-".repeat(40)}
// Total Items: ${itemsCount}

// TOTAL AMOUNT: ₹${transactionData.amount.toFixed(2)}
// Remaining Balance: ₹${transactionData.remainingBalance.toFixed(2)}

// ${"=".repeat(40)}
// Thank you for your purchase!
//     `.trim();

//     const blob = new Blob([receiptText], { type: "text/plain" });
//     const url = URL.createObjectURL(blob);
//     const a = document.createElement("a");
//     a.href = url;
//     a.download = `receipt-${transactionData.id}-${Date.now()}.txt`;
//     document.body.appendChild(a);
//     a.click();
//     document.body.removeChild(a);
//     URL.revokeObjectURL(url);
//     toast.success("Receipt downloaded successfully!");
//   }, [transactionData, formattedDate, formattedTime, itemsCount]);

//   if (!transactionData) return null;

//   return (
//     <Dialog open={open} onOpenChange={onOpenChange}>
//       <DialogContent className="sm:max-w-lg">
//         {/* Screen reader only title - hidden visually but accessible */}
//         <DialogTitle className="sr-only">
//           Transaction Successful
//         </DialogTitle>

//         <div className="space-y-4">
//           {/* Success Animation */}
//           <div className="flex flex-col items-center text-center py-4">
//             <div className="relative">
//               <div className="absolute inset-0 bg-green-100 rounded-full animate-ping opacity-75" />
//               <div className="relative w-20 h-20 bg-gradient-to-br from-green-100 to-green-200 rounded-full flex items-center justify-center">
//                 <CheckCircle2 className="w-12 h-12 text-green-600" />
//               </div>
//             </div>
//             <h2 className="text-2xl font-bold text-gray-900 mt-4 mb-2">Transaction Successful!</h2>
//             <p className="text-gray-600">Your transaction has been completed successfully</p>
//           </div>

//           {/* Transaction ID Badge */}
//           <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border-2 border-green-200">
//             <div className="text-center">
//               <p className="text-xs text-gray-600 mb-1">Transaction ID</p>
//               <p className="font-mono font-bold text-xl text-green-700">{transactionData.id}</p>
//               <div className="flex items-center justify-center gap-4 mt-2 text-xs text-gray-600">
//                 <span className="flex items-center gap-1">
//                   <Calendar className="w-3 h-3" />
//                   {formattedDate}
//                 </span>
//                 <span className="flex items-center gap-1">
//                   <Clock className="w-3 h-3" />
//                   {formattedTime}
//                 </span>
//               </div>
//             </div>
//           </div>

//           {/* Student & Amount Summary */}
//           <div className="grid grid-cols-2 gap-3">
//             <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
//               <p className="text-xs text-gray-600 mb-1">Student</p>
//               <p className="font-semibold text-gray-900 truncate">{transactionData.student}</p>
//             </div>
//             <div className="p-3 bg-red-50 rounded-lg border border-red-200">
//               <p className="text-xs text-gray-600 mb-1">Amount Deducted</p>
//               <p className="font-bold text-red-600">₹{transactionData.amount.toFixed(2)}</p>
//             </div>
//           </div>

//           {/* Balance Info */}
//           <div className="p-4 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg border border-gray-200">
//             <div className="space-y-2 text-sm">
//               <div className="flex justify-between">
//                 <span className="text-gray-600">Previous Balance:</span>
//                 <span className="font-medium">₹{(transactionData.remainingBalance + transactionData.amount).toFixed(2)}</span>
//               </div>
//               <div className="flex justify-between text-red-600">
//                 <span>Deducted:</span>
//                 <span className="font-medium">-₹{transactionData.amount.toFixed(2)}</span>
//               </div>
//               <Separator />
//               <div className="flex justify-between items-center">
//                 <span className="font-semibold text-gray-900">Remaining Balance:</span>
//                 <div className="flex items-center gap-2">
//                   <span className="text-xl font-bold text-green-600">₹{transactionData.remainingBalance.toFixed(2)}</span>
//                   {transactionData.remainingBalance < 100 && (
//                     <Badge variant="destructive" className="text-xs">
//                       Low
//                     </Badge>
//                   )}
//                 </div>
//               </div>
//             </div>
//           </div>

//           {/* Items List */}
//           <div className="space-y-2">
//             <div className="flex items-center justify-between">
//               <h4 className="font-semibold text-gray-900 text-sm">Purchased Items</h4>
//               <Badge variant="secondary">{itemsCount} items</Badge>
//             </div>
//             <ScrollArea className="max-h-48 pr-4">
//               <div className="space-y-2">
//                 {transactionData.items.map((item, index) => (
//                   <div
//                     key={index}
//                     className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-200"
//                   >
//                     <div className="flex-1 min-w-0">
//                       <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
//                       <p className="text-xs text-gray-600">
//                         {item.quantity} × ₹{item.price.toFixed(2)}
//                       </p>
//                     </div>
//                     <span className="font-bold text-sm ml-2">₹{(item.price * item.quantity).toFixed(2)}</span>
//                   </div>
//                 ))}
//               </div>
//             </ScrollArea>
//           </div>

//           {/* Action Buttons */}
//           <div className="grid grid-cols-2 gap-3 pt-2">
//             <Button variant="outline" onClick={handlePrintReceipt} className="flex-1">
//               <Printer className="w-4 h-4 mr-2" />
//               Print
//             </Button>
//             <Button variant="outline" onClick={handleDownloadReceipt} className="flex-1">
//               <Download className="w-4 h-4 mr-2" />
//               Download
//             </Button>
//           </div>

//           <Button onClick={onClose} className="w-full bg-green-500 hover:bg-green-600 text-white">
//             <X className="w-4 h-4 mr-2" />
//             Close & New Transaction
//           </Button>
//         </div>
//       </DialogContent>
//     </Dialog>
//   );
// }