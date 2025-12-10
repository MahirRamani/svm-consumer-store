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




// // app/pos/page.tsx
// "use client";

// import { useState, useCallback } from "react";
// import ProductGrid from "@/components/modals/product-grid";
// import ShoppingCart from "@/components/modals/shopping-cart";
// import StudentLookup from "@/components/modals/student-lookup";
// import type { CartItem, Student } from "@/types";

// export default function PosPage() {
//   const [cartItems, setCartItems] = useState<CartItem[]>([]);
//   const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

//   const getCartItemId = useCallback((item: CartItem): string => {
//     if (!item.subProductId) {
//       console.error("CartItem missing subProductId:", item);
//       throw new Error("All cart items must have a subProductId");
//     }
//     return item.subProductId;
//   }, []);

//   const handleAddToCart = useCallback((newItem: CartItem) => {
//     if (!newItem.subProductId) {
//       console.error("Cannot add item without subProductId:", newItem);
//       return;
//     }

//     setCartItems((prevItems) => {
//       const itemId = getCartItemId(newItem);
//       const existingItemIndex = prevItems.findIndex((item) => getCartItemId(item) === itemId);

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
//   }, [getCartItemId]);

//   const handleUpdateQuantity = useCallback((itemId: string, newQuantity: number) => {
//     if (newQuantity <= 0) {
//       handleRemoveItem(itemId);
//       return;
//     }

//     setCartItems((prevItems) =>
//       prevItems.map((item) => {
//         if (getCartItemId(item) === itemId) {
//           if (newQuantity <= item.stock) {
//             return { ...item, quantity: newQuantity };
//           } else {
//             console.warn("Cannot update quantity - exceeds stock limit");
//             return item;
//           }
//         }
//         return item;
//       })
//     );
//   }, [getCartItemId]);

//   const handleRemoveItem = useCallback((itemId: string) => {
//     setCartItems((prevItems) => prevItems.filter((item) => getCartItemId(item) !== itemId));
//   }, [getCartItemId]);

//   const handleClearCart = useCallback(() => {
//     setCartItems([]);
//   }, []);

//   const handleTransactionComplete = useCallback(() => {
//     setCartItems([]);
//     setSelectedStudent(null);
//   }, []);

//   return (
//     <div className="min-h-screen bg-gray-50 p-4">
//       <div className="max-w-[1800px] mx-auto">
//         <div className="mb-4">
//           <h1 className="text-3xl font-bold text-gray-900">Point of Sale</h1>
//           <p className="text-gray-600">Select products and complete transactions</p>
//         </div>

//         <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
//           <div className="lg:col-span-3 space-y-4">
//             <StudentLookup selectedStudent={selectedStudent} onStudentSelect={setSelectedStudent} />
//             <ProductGrid onAddToCart={handleAddToCart} />
//           </div>

//           <div className="lg:col-span-1">
//             <div className="sticky top-4">
//               <ShoppingCart
//                 selectedStudent={selectedStudent}
//                 cartItems={cartItems}
//                 onUpdateQuantity={handleUpdateQuantity}
//                 onRemoveItem={handleRemoveItem}
//                 onClearCart={handleClearCart}
//                 onTransactionComplete={handleTransactionComplete}
//               />
//             </div>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }



// // "use client";

// // import { useState, useCallback } from "react";
// // import ProductGrid from "@/components/modals/product-grid";
// // import ShoppingCart from "@/components/modals/shopping-cart";
// // import type { CartItem, Student } from "@/lib/types";
// // import StudentLookup from "@/components/modals/student-lookup";

// // export default function PosPage() {
// //   const [cartItems, setCartItems] = useState<CartItem[]>([]);
// //   const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

// //   const getCartItemId = (item: CartItem): string => {
// //     if (!item.subProductId) {
// //       console.error("CartItem missing subProductId:", item);
// //       throw new Error("All cart items must have a subProductId");
// //     }
// //     return item.subProductId;
// //   };

// //   const handleAddToCart = useCallback((newItem: CartItem) => {
// //     if (!newItem.subProductId) {
// //       console.error("Cannot add item without subProductId:", newItem);
// //       return;
// //     }

// //     setCartItems(prevItems => {
// //       const itemId = getCartItemId(newItem);
// //       const existingItemIndex = prevItems.findIndex(item => getCartItemId(item) === itemId);

// //       if (existingItemIndex >= 0) {
// //         const updatedItems = [...prevItems];
// //         const existingItem = updatedItems[existingItemIndex];
// //         const newQuantity = existingItem.quantity + newItem.quantity;
        
// //         if (newQuantity <= existingItem.stock) {
// //           updatedItems[existingItemIndex] = {
// //             ...existingItem,
// //             quantity: newQuantity
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

// //   const handleUpdateQuantity = useCallback((itemId: string, newQuantity: number) => {
// //     if (newQuantity <= 0) {
// //       handleRemoveItem(itemId);
// //       return;
// //     }

// //     setCartItems(prevItems => {
// //       return prevItems.map(item => {
// //         if (getCartItemId(item) === itemId) {
// //           if (newQuantity <= item.stock) {
// //             return { ...item, quantity: newQuantity };
// //           } else {
// //             console.warn("Cannot update quantity - exceeds stock limit");
// //             return item;
// //           }
// //         }
// //         return item;
// //       });
// //     });
// //   }, []);

// //   const handleRemoveItem = useCallback((itemId: string) => {
// //     setCartItems(prevItems => {
// //       return prevItems.filter(item => getCartItemId(item) !== itemId);
// //     });
// //   }, []);

// //   const handleClearCart = useCallback(() => {
// //     setCartItems([]);
// //   }, []);

// //   // Feature 3: Clear both cart and student selection after transaction
// //   const handleTransactionComplete = useCallback(() => {
// //     setCartItems([]);
// //     setSelectedStudent(null);
// //   }, []);

// //   return (
// //     <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 p-0">
// //       <div className="lg:col-span-3">
// //         <StudentLookup 
// //           selectedStudent={selectedStudent} 
// //           onStudentSelect={setSelectedStudent} 
// //         />
// //         <ProductGrid onAddToCart={handleAddToCart} />
// //       </div>

// //       <div className="lg:col-span-1">
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
