// app/pos/page.tsx
"use client";

import { useState, useCallback } from 'react';
import ProductNavigation from '@/components/seller/pos/product-navigation';
import ShoppingCart from '@/components/seller/pos/shopping-cart';
import StudentLookup from '@/components/seller/pos/student-lookup';
import type { CartItem, Student } from '@/types/seller/pos';

export default function PosPage() {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  const handleAddToCart = useCallback((newItem: CartItem) => {
    if (!newItem.productId) {
      console.error("Cannot add item without productId:", newItem);
      return;
    }

    setCartItems((prevItems) => {
      const itemId = newItem.productId;
      const existingItemIndex = prevItems.findIndex(
        (item) => item.productId === itemId
      );

      if (existingItemIndex >= 0) {
        const updatedItems = [...prevItems];
        const existingItem = updatedItems[existingItemIndex];
        const newQuantity = existingItem.quantity + newItem.quantity;

        if (newQuantity <= existingItem.stock) {
          updatedItems[existingItemIndex] = {
            ...existingItem,
            quantity: newQuantity,
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

  const handleUpdateQuantity = useCallback(
    (itemId: string, newQuantity: number) => {
      if (newQuantity <= 0) {
        setCartItems((prevItems) =>
          prevItems.filter((item) => item.productId !== itemId)
        );
        return;
      }

      setCartItems((prevItems) =>
        prevItems.map((item) => {
          if (item.productId === itemId) {
            if (newQuantity <= item.stock) {
              return { ...item, quantity: newQuantity };
            }
            return item;
          }
          return item;
        })
      );
    },
    []
  );

  const handleRemoveItem = useCallback((itemId: string) => {
    setCartItems((prevItems) =>
      prevItems.filter((item) => item.productId !== itemId)
    );
  }, []);

  const handleClearCart = useCallback(() => {
    setCartItems([]);
  }, []);

  const handleTransactionComplete = useCallback(() => {
    setCartItems([]);
    setSelectedStudent(null);
  }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 p-4">
      {/* Left Side - Product Navigation (3 columns) */}
      <div className="lg:col-span-3">
        <ProductNavigation onAddToCart={handleAddToCart} cartItems={cartItems} />
      </div>

      {/* Right Side - Student Lookup & Cart (1 column) */}
      <div className="lg:col-span-1 space-y-4">
        {/* Student Lookup */}
        <StudentLookup
          selectedStudent={selectedStudent}
          onStudentSelect={setSelectedStudent}
        />

        {/* Shopping Cart */}
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