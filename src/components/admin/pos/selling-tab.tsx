// app/pos/page.tsx
"use client";

import { useState, useCallback } from "react";
import ProductGrid from "@/components/modals/product-grid";
import ShoppingCart from "@/components/modals/shopping-cart";
import StudentLookup from "@/components/modals/student-lookup";
import type { CartItem, Student } from "@/types/pos";

export default function PosPage() {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  const getCartItemId = useCallback((item: CartItem): string => {
    if (!item.subProductId) {
      console.error("CartItem missing subProductId:", item);
      throw new Error("All cart items must have a subProductId");
    }
    return item.subProductId;
  }, []);

  const handleAddToCart = useCallback((newItem: CartItem) => {
    if (!newItem.subProductId) {
      console.error("Cannot add item without subProductId:", newItem);
      return;
    }

    setCartItems(prevItems => {
      const itemId = newItem.subProductId;
      const existingItemIndex = prevItems.findIndex(item => item.subProductId === itemId);

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
        if (item.subProductId === itemId) {
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
      return prevItems.filter(item => item.subProductId !== itemId);
    });
  }, []);

  const handleClearCart = useCallback(() => {
    setCartItems([]);
  }, []);

  const handleTransactionComplete = useCallback(() => {
    setCartItems([]);
    setSelectedStudent(null);
  }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 p-0">
      <div className="lg:col-span-3">
        <StudentLookup 
          selectedStudent={selectedStudent} 
          onStudentSelect={setSelectedStudent} 
        />
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
  );
}