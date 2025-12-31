"use client";

import { useState, useCallback } from "react";
import ProductNavigation from "@/components/admin/pos/product-navigation";
import ShoppingCart from "@/components/admin/pos/shopping-cart";
import StudentLookup from "@/components/admin/pos/student-lookup";
import type { CartItem, Student } from "@/types/pos";

export default function PosPage() {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [navigationResetTrigger, setNavigationResetTrigger] = useState(0);

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
    setNavigationResetTrigger(prev => prev + 1);
  }, []);

  return (
    // Add h-screen and overflow-hidden to lock viewport
    <div className="h-screen overflow-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-2 p-4 h-full">
        {/* Left Side - Add flex, h-full, overflow-hidden */}
        <div className="lg:col-span-3 flex flex-col h-full overflow-hidden">
          <ProductNavigation onAddToCart={handleAddToCart} cartItems={cartItems} resetTrigger={navigationResetTrigger}/>
        </div>

        {/* Right Side - Add flex, h-full, overflow-hidden */}
        <div className="lg:col-span-1 flex flex-col h-full overflow-hidden space-y-2">
          {/* Student Lookup - stays fixed */}
          <div className="flex-shrink-0">
            <StudentLookup
              selectedStudent={selectedStudent}
              onStudentSelect={setSelectedStudent}
            />
          </div>

          {/* Shopping Cart - takes remaining space, scrolls internally */}
          <div className="flex-1 min-h-0">
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
    </div>
  );
}

// // app/pos/page.tsx
// "use client";

// import { useState, useCallback } from "react";
// import ProductNavigation from "@/components/admin/pos/product-navigation";
// import ShoppingCart from "@/components/admin/pos/shopping-cart";
// import StudentLookup from "@/components/admin/pos/student-lookup";
// import type { CartItem, Student } from "@/types/pos";

// export default function PosPage() {
//   const [cartItems, setCartItems] = useState<CartItem[]>([]);
//   const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

//   const handleAddToCart = useCallback((newItem: CartItem) => {
//     if (!newItem.productId) {
//       console.error("Cannot add item without productId:", newItem);
//       return;
//     }

//     setCartItems((prevItems) => {
//       const itemId = newItem.productId;
//       const existingItemIndex = prevItems.findIndex(
//         (item) => item.productId === itemId
//       );

//       if (existingItemIndex >= 0) {
//         const updatedItems = [...prevItems];
//         const existingItem = updatedItems[existingItemIndex];
//         const newQuantity = existingItem.quantity + newItem.quantity;

//         if (newQuantity <= existingItem.stock) {
//           updatedItems[existingItemIndex] = {
//             ...existingItem,
//             quantity: newQuantity,
//           };
//           return updatedItems;
//         } else {
//           console.warn("Cannot add more items - stock limit reached");
//           return prevItems;
//         }
//       } else {
//         return [...prevItems, newItem];
//       }
//     });
//   }, []);

//   const handleUpdateQuantity = useCallback(
//     (itemId: string, newQuantity: number) => {
//       if (newQuantity <= 0) {
//         setCartItems((prevItems) =>
//           prevItems.filter((item) => item.productId !== itemId)
//         );
//         return;
//       }

//       setCartItems((prevItems) =>
//         prevItems.map((item) => {
//           if (item.productId === itemId) {
//             if (newQuantity <= item.stock) {
//               return { ...item, quantity: newQuantity };
//             }
//             return item;
//           }
//           return item;
//         })
//       );
//     },
//     []
//   );

//   const handleRemoveItem = useCallback((itemId: string) => {
//     setCartItems((prevItems) =>
//       prevItems.filter((item) => item.productId !== itemId)
//     );
//   }, []);

//   const handleClearCart = useCallback(() => {
//     setCartItems([]);
//   }, []);

//   const handleTransactionComplete = useCallback(() => {
//     setCartItems([]);
//     setSelectedStudent(null);
//   }, []);

//   return (
//     <div className="grid grid-cols-1 lg:grid-cols-4 gap-2 p-4">
//       {/* Left Side - Product Navigation (3 columns) */}
//       <div className="lg:col-span-3">
//         <ProductNavigation onAddToCart={handleAddToCart} cartItems={cartItems} />
//       </div>

//       {/* Right Side - Student Lookup & Cart (1 column) */}
//       <div className="lg:col-span-1 space-y-2">
//         {/* Student Lookup */}
//         <StudentLookup
//           selectedStudent={selectedStudent}
//           onStudentSelect={setSelectedStudent}
//         />

//         {/* Shopping Cart */}
//         <ShoppingCart
//           selectedStudent={selectedStudent}
//           cartItems={cartItems}
//           onUpdateQuantity={handleUpdateQuantity}
//           onRemoveItem={handleRemoveItem}
//           onClearCart={handleClearCart}
//           onTransactionComplete={handleTransactionComplete}
//         />
//       </div>
//     </div>
//   );
// }


// // "use client";

// // import { useState, useCallback } from "react";
// // import ProductNavigation from "@/components/admin/pos/product-navigation";
// // import ShoppingCart from "@/components/admin/pos/shopping-cart";
// // import StudentLookup from "@/components/admin/pos/student-lookup";
// // import type { CartItem, Student } from "@/types/pos";

// // export default function PosPage() {
// //   const [cartItems, setCartItems] = useState<CartItem[]>([]);
// //   const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

// //   const handleAddToCart = useCallback((newItem: CartItem) => {
// //     if (!newItem.subProductId) {
// //       console.error("Cannot add item without subProductId:", newItem);
// //       return;
// //     }

// //     setCartItems((prevItems) => {
// //       const itemId = newItem.subProductId;
// //       const existingItemIndex = prevItems.findIndex(
// //         (item) => item.subProductId === itemId
// //       );

// //       if (existingItemIndex >= 0) {
// //         const updatedItems = [...prevItems];
// //         const existingItem = updatedItems[existingItemIndex];
// //         const newQuantity = existingItem.quantity + newItem.quantity;

// //         if (newQuantity <= existingItem.stock) {
// //           updatedItems[existingItemIndex] = {
// //             ...existingItem,
// //             quantity: newQuantity,
// //           };
// //           return updatedItems;
// //         } else {
// //           console.warn("Cannot add more items - stock limit reached");
// //           return prevItems;
// //         }
// //       } else {
// //         return [...prevItems, newItem];
// //       }
// //     });
// //   }, []);

// //   const handleUpdateQuantity = useCallback(
// //     (itemId: string, newQuantity: number) => {
// //       if (newQuantity <= 0) {
// //         setCartItems((prevItems) =>
// //           prevItems.filter((item) => item.subProductId !== itemId)
// //         );
// //         return;
// //       }

// //       setCartItems((prevItems) =>
// //         prevItems.map((item) => {
// //           if (item.subProductId === itemId) {
// //             if (newQuantity <= item.stock) {
// //               return { ...item, quantity: newQuantity };
// //             }
// //             return item;
// //           }
// //           return item;
// //         })
// //       );
// //     },
// //     []
// //   );

// //   const handleRemoveItem = useCallback((itemId: string) => {
// //     setCartItems((prevItems) =>
// //       prevItems.filter((item) => item.subProductId !== itemId)
// //     );
// //   }, []);

// //   const handleClearCart = useCallback(() => {
// //     setCartItems([]);
// //   }, []);

// //   const handleTransactionComplete = useCallback(() => {
// //     setCartItems([]);
// //     setSelectedStudent(null);
// //   }, []);

// //   return (
// //     <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 p-4">
// //       {/* Left Side - Product Navigation (3 columns) */}
// //       <div className="lg:col-span-3">
// //         <ProductNavigation onAddToCart={handleAddToCart} cartItems={cartItems} />
// //       </div>

// //       {/* Right Side - Student Lookup & Cart (1 column) */}
// //       <div className="lg:col-span-1 space-y-4">
// //         {/* Student Lookup - Now above cart */}
// //         <StudentLookup
// //           selectedStudent={selectedStudent}
// //           onStudentSelect={setSelectedStudent}
// //         />

// //         {/* Shopping Cart */}
// //         <ShoppingCart
// //           selectedStudent={selectedStudent}
// //           cartItems={cartItems}
// //           onUpdateQuantity={handleUpdateQuantity}
// //           onRemoveItem={handleRemoveItem}
// //           onClearCart={handleClearCart}
// //           onTransactionComplete={handleTransactionComplete}
// //         />
// //       </div>
// //     </div>
// //   );
// // }