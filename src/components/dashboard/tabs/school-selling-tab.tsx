"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { User, Store, Info } from "lucide-react";
import { toast } from "sonner";
import type { CartItem, Student } from "@/types/pos";

// Import your actual components
import ProductGrid from "@/components/modals/product-grid";
import StudentLookup from "@/components/modals/student-lookup";
import ShoppingCart from "@/components/modals/shopping-cart";

// Define DirectSaleAccount type
interface DirectSaleAccount {
  id: string;
  name: string;
  type: string;
}

export default function PosPage() {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isDirectSaleMode, setIsDirectSaleMode] = useState<boolean>(false);

  // This would come from your settings/config
  const DIRECT_SALE_ACCOUNT: DirectSaleAccount = {
    id: "admin-direct-sales",
    name: "Direct Sales Account",
    type: "admin"
  };

  const getCartItemId = (item: CartItem): string => {
    if (!item.subProductId) {
      console.error("CartItem missing subProductId:", item);
      throw new Error("All cart items must have a subProductId");
    }
    return item.subProductId;
  };

  const handleAddToCart = useCallback((newItem: CartItem) => {
    if (!newItem.subProductId) {
      console.error("Cannot add item without subProductId:", newItem);
      return;
    }

    setCartItems(prevItems => {
      const itemId = getCartItemId(newItem);
      const existingItemIndex = prevItems.findIndex(item => getCartItemId(item) === itemId);

      if (existingItemIndex >= 0) {
        const updatedItems = [...prevItems];
        const existingItem = updatedItems[existingItemIndex];
        const newQuantity = existingItem.quantity + newItem.quantity;
        
        if (newQuantity <= existingItem.stock) {
          updatedItems[existingItemIndex] = {
            ...existingItem,
            quantity: newQuantity
          };
          return updatedItems;
        } else {
          console.warn("Cannot add more items - stock limit reached");
          return prevItems;
        }
      } else {
        return [...prevItems, newItem];
      }
    });
  }, []);

  const handleUpdateQuantity = useCallback((itemId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      handleRemoveItem(itemId);
      return;
    }

    setCartItems(prevItems => {
      return prevItems.map(item => {
        if (getCartItemId(item) === itemId) {
          if (newQuantity <= item.stock) {
            return { ...item, quantity: newQuantity };
          } else {
            console.warn("Cannot update quantity - exceeds stock limit");
            return item;
          }
        }
        return item;
      });
    });
  }, []);

  const handleRemoveItem = useCallback((itemId: string) => {
    setCartItems(prevItems => {
      return prevItems.filter(item => getCartItemId(item) !== itemId);
    });
  }, []);

  const handleClearCart = useCallback(() => {
    setCartItems([]);
  }, []);

  const handleTransactionComplete = useCallback(() => {
    setCartItems([]);
    setSelectedStudent(null);
  }, []);

  const handleToggleMode = useCallback((checked: boolean) => {
    if (cartItems.length > 0) {
      toast.error("Please clear the cart before switching modes");
      return;
    }
    
    setIsDirectSaleMode(checked);
    setSelectedStudent(null);
    
    if (checked) {
      toast.success("Direct Sale Mode activated - All sales will go to admin account");
    } else {
      toast.info("Student Mode activated - Select a student for transactions");
    }
  }, [cartItems.length]);

  return (
    <div className="space-y-4 p-6">
      {/* Mode Toggle Card */}
      <Card className="border-2 border-blue-200 bg-blue-50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Store className="w-5 h-5" />
              Transaction Mode
            </CardTitle>
            <Badge variant={isDirectSaleMode ? "default" : "secondary"} className="text-sm">
              {isDirectSaleMode ? "Direct Sales" : "Student Sales"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-white rounded-lg border">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${isDirectSaleMode ? 'bg-purple-100' : 'bg-blue-100'}`}>
                {isDirectSaleMode ? (
                  <Store className="w-5 h-5 text-purple-600" />
                ) : (
                  <User className="w-5 h-5 text-blue-600" />
                )}
              </div>
              <div>
                <Label htmlFor="mode-toggle" className="text-base font-medium cursor-pointer">
                  {isDirectSaleMode ? "Direct Sale Mode" : "Student Sale Mode"}
                </Label>
                <p className="text-sm text-gray-600">
                  {isDirectSaleMode 
                    ? "Sales go to admin account directly"
                    : "Sales linked to student accounts"
                  }
                </p>
              </div>
            </div>
            <Switch
              id="mode-toggle"
              checked={isDirectSaleMode}
              onCheckedChange={handleToggleMode}
              className="data-[state=checked]:bg-purple-600"
            />
          </div>

          {/* Info Banner */}
          <div className={`flex items-start gap-2 p-3 rounded-lg border ${
            isDirectSaleMode 
              ? 'bg-purple-50 border-purple-200' 
              : 'bg-blue-50 border-blue-200'
          }`}>
            <Info className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
              isDirectSaleMode ? 'text-purple-600' : 'text-blue-600'
            }`} />
            <div className="text-sm">
              {isDirectSaleMode ? (
                <>
                  <span className="font-medium">Direct Sale Mode:</span> All transactions will be recorded under{" "}
                  <span className="font-semibold text-purple-700">{DIRECT_SALE_ACCOUNT.name}</span>.
                  No student selection required.
                </>
              ) : (
                <>
                  <span className="font-medium">Student Sale Mode:</span> Search and select a student to complete transactions.
                  Sales will be linked to their account.
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {/* Conditionally show Student Lookup */}
          {!isDirectSaleMode && (
            <StudentLookup 
              selectedStudent={selectedStudent} 
              onStudentSelect={setSelectedStudent} 
            />
          )}
          
          {/* Show Direct Sale Account Info in Direct Mode */}
          {isDirectSaleMode && (
            <Card className="border-2 border-purple-200 bg-purple-50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="bg-purple-500 text-white w-12 h-12 rounded-full flex items-center justify-center">
                    <Store className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">{DIRECT_SALE_ACCOUNT.name}</h4>
                    <p className="text-sm text-gray-600">Admin Direct Sales Account</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <ProductGrid onAddToCart={handleAddToCart} />
        </div>

        <div className="lg:col-span-1">
          <ShoppingCart
            selectedStudent={selectedStudent}
            cartItems={cartItems}
            onUpdateQuantity={handleUpdateQuantity}
            onRemoveItem={handleRemoveItem}
            onClearCart={handleClearCart}
            onTransactionComplete={handleTransactionComplete}
          />
        </div>
      </div>
    </div>
  );
}