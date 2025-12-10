// components/pos/student-lookup.tsx
"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X, Loader2 } from 'lucide-react';
import { toast } from "sonner";
import type { Student, ApiResponse } from "@/types/pos";

interface StudentLookupProps {
  selectedStudent: Student | null;
  onStudentSelect: (student: Student | null) => void;
}

export default function StudentLookup({ selectedStudent, onStudentSelect }: StudentLookupProps) {
  const [rollNumber, setRollNumber] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  const searchStudent = useCallback(async () => {
    if (!rollNumber.trim()) {
      toast.error("Please enter a roll number");
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(`/api/students/${rollNumber.trim()}`);
      
      if (response.ok) {
        const result: ApiResponse<Student> = await response.json();
        
        if (result.success && result.data) {
          onStudentSelect(result.data);
          toast.success(`${result.data.name} selected successfully`);
        } else {
          toast.error("No student found with this roll number");
          onStudentSelect(null);
        }
      } else {
        const error = await response.json().catch(() => ({}));
        toast.error(error.error?.message || "No student found with this roll number");
        onStudentSelect(null);
      }
    } catch (error) {
      console.error("Search error:", error);
      toast.error("Failed to search for student");
      onStudentSelect(null);
    } finally {
      setIsSearching(false);
    }
  }, [rollNumber, onStudentSelect]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      searchStudent();
    }
  }, [searchStudent]);

  const handleClearInput = useCallback(() => {
    setRollNumber("");
  }, []);

  const clearSelectedStudent = useCallback(() => {
    onStudentSelect(null);
    setRollNumber("");
  }, [onStudentSelect]);

  return (
    <Card>
      <CardHeader className="mb-0">
        <CardTitle className="text-lg font-semibold text-gray-900 m-0 p-0">Student Lookup</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex space-x-2">
          <div className="relative flex-1">
            <Input
              placeholder="Enter roll number"
              value={rollNumber}
              onChange={(e) => setRollNumber(e.target.value)}
              onKeyPress={handleKeyPress}
              className="flex-1 text-lg pr-10"
              disabled={isSearching}
            />
            {rollNumber && (
              <button
                type="button"
                onClick={handleClearInput}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Clear search"
                disabled={isSearching}
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <Button
            onClick={searchStudent}
            disabled={isSearching || !rollNumber.trim()}
            className="bg-green-500 hover:bg-green-600 text-white px-6"
          >
            {isSearching ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <Search className="w-4 h-4 mr-2" />
                Search
              </>
            )}
          </Button>
        </div>

        {selectedStudent && (
          <div className="p-2 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="bg-green-500 text-white w-12 h-12 rounded-full flex items-center justify-center font-bold">
                  {selectedStudent.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">{selectedStudent.name}</h4>
                  <p className="text-sm text-gray-600">{selectedStudent.rollNumber}</p>
                  <p className="text-xs text-gray-500">{selectedStudent.standard} - {selectedStudent.year}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">Available Balance</p>
                <p className="text-2xl font-bold text-green-500">
                  ₹{selectedStudent.balance.toFixed(2)}
                </p>
                <Button
                  onClick={clearSelectedStudent}
                  variant="ghost"
                  size="sm"
                  className="mt-1 h-6 text-xs"
                >
                  Clear
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}





// // components/pos/student-lookup.tsx
// "use client";

// import { useState, useCallback, useEffect } from "react";
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// import { Input } from "@/components/ui/input";
// import { Button } from "@/components/ui/button";
// import { Badge } from "@/components/ui/badge";
// import { Search, X, User, Loader2, AlertCircle } from "lucide-react";
// import { useSearchStudent } from "@/hooks/use-transaction-mutations";
// import type { Student } from "@/types";

// interface StudentLookupProps {
//   selectedStudent: Student | null;
//   onStudentSelect: (student: Student | null) => void;
// }

// export default function StudentLookup({ selectedStudent, onStudentSelect }: StudentLookupProps) {
//   const [rollNumber, setRollNumber] = useState("");
//   const searchMutation = useSearchStudent();

//   // Reset input when student is cleared externally
//   useEffect(() => {
//     if (!selectedStudent) {
//       setRollNumber("");
//     }
//   }, [selectedStudent]);

//   const handleSearch = useCallback(() => {
//     if (!rollNumber.trim()) {
//       return;
//     }

//     searchMutation.mutate(rollNumber.trim(), {
//       onSuccess: (student) => {
//         onStudentSelect(student);
//         setRollNumber("");
//       },
//       onError: () => {
//         onStudentSelect(null);
//       },
//     });
//   }, [rollNumber, searchMutation, onStudentSelect]);

//   const handleKeyPress = useCallback(
//     (e: React.KeyboardEvent) => {
//       if (e.key === "Enter") {
//         handleSearch();
//       }
//     },
//     [handleSearch]
//   );

//   const handleClearInput = useCallback(() => {
//     setRollNumber("");
//   }, []);

//   const handleClearStudent = useCallback(() => {
//     onStudentSelect(null);
//     setRollNumber("");
//   }, [onStudentSelect]);

//   const getInitials = useCallback((name: string): string => {
//     return name
//       .split(" ")
//       .map((n) => n[0])
//       .join("")
//       .slice(0, 2)
//       .toUpperCase();
//   }, []);

//   const getBalanceStatus = useCallback(
//     (balance: number): { variant: "default" | "secondary" | "destructive"; label: string } => {
//       if (balance > 100) return { variant: "default", label: "Good Balance" };
//       if (balance > 0) return { variant: "secondary", label: "Low Balance" };
//       return { variant: "destructive", label: "No Balance" };
//     },
//     []
//   );

//   return (
//     <Card>
//       <CardHeader className="pb-3">
//         <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
//           <User className="w-5 h-5" />
//           Student Lookup
//         </CardTitle>
//       </CardHeader>
//       <CardContent className="space-y-3">
//         <div className="flex gap-2">
//           <div className="relative flex-1">
//             <Input
//               placeholder="Enter roll number"
//               value={rollNumber}
//               onChange={(e) => setRollNumber(e.target.value)}
//               onKeyPress={handleKeyPress}
//               disabled={searchMutation.isPending}
//               className="text-lg pr-10"
//             />
//             {rollNumber && (
//               <button
//                 type="button"
//                 onClick={handleClearInput}
//                 className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
//                 aria-label="Clear search"
//               >
//                 <X className="w-4 h-4" />
//               </button>
//             )}
//           </div>
//           <Button
//             onClick={handleSearch}
//             disabled={searchMutation.isPending || !rollNumber.trim()}
//             className="bg-green-500 hover:bg-green-600 text-white px-6"
//           >
//             {searchMutation.isPending ? (
//               <>
//                 <Loader2 className="w-4 h-4 mr-2 animate-spin" />
//                 Searching...
//               </>
//             ) : (
//               <>
//                 <Search className="w-4 h-4 mr-2" />
//                 Search
//               </>
//             )}
//           </Button>
//         </div>

//         {searchMutation.isError && (
//           <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
//             <AlertCircle className="w-4 h-4 text-red-600 mt-0.5" />
//             <p className="text-sm text-red-700">{searchMutation.error?.message || "Failed to search student"}</p>
//           </div>
//         )}

//         {selectedStudent && (
//           <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-lg shadow-sm">
//             <div className="flex items-center justify-between">
//               <div className="flex items-center gap-3">
//                 <div className="bg-gradient-to-br from-green-500 to-emerald-600 text-white w-14 h-14 rounded-full flex items-center justify-center font-bold text-lg shadow-md">
//                   {getInitials(selectedStudent.name)}
//                 </div>
//                 <div>
//                   <h4 className="font-semibold text-gray-900 text-lg">{selectedStudent.name}</h4>
//                   <p className="text-sm text-gray-600">{selectedStudent.rollNumber}</p>
//                   {selectedStudent.standard && (
//                     <p className="text-xs text-gray-500">
//                       {selectedStudent.standard} - {selectedStudent.year}
//                     </p>
//                   )}
//                 </div>
//               </div>
//               <Button
//                 variant="ghost"
//                 size="sm"
//                 onClick={handleClearStudent}
//                 className="text-gray-400 hover:text-gray-600"
//                 title="Clear selection"
//               >
//                 <X className="w-5 h-5" />
//               </Button>
//             </div>
//             <div className="mt-3 pt-3 border-t border-green-200 flex items-center justify-between">
//               <div>
//                 <p className="text-xs text-gray-600">Available Balance</p>
//                 <p className="text-2xl font-bold text-green-600">₹{selectedStudent.balance.toFixed(2)}</p>
//               </div>
//               <Badge {...getBalanceStatus(selectedStudent.balance)} className={getBalanceStatus(selectedStudent.balance).variant === "default" ? "bg-green-500" : ""}>
//                 {getBalanceStatus(selectedStudent.balance).label}
//               </Badge>
//             </div>
//           </div>
//         )}
//       </CardContent>
//     </Card>
//   );
// }


// // "use client"

// // import type React from "react"
// // import { useState } from "react"
// // import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
// // import { Input } from "@/components/ui/input"
// // import { Button } from "@/components/ui/button"
// // import { Search, X } from 'lucide-react'
// // import { toast } from "sonner"
// // import type { Student } from "@/lib/types"

// // interface StudentLookupProps {
// //   selectedStudent: Student | null
// //   onStudentSelect: (student: Student | null) => void
// // }

// // export default function StudentLookup({ selectedStudent, onStudentSelect }: StudentLookupProps) {
// //   const [rollNumber, setRollNumber] = useState("")
// //   const [isSearching, setIsSearching] = useState(false)

// //   const searchStudent = async () => {
// //     if (!rollNumber.trim()) {
// //       toast.error("Please enter a roll number")
// //       return
// //     }

// //     setIsSearching(true)
// //     try {
// //       const response = await fetch(`/api/students/${rollNumber.trim()}`)
// //       console.log("response", response, rollNumber)
      
// //       if (response.ok) {
// //         const student = await response.json()
// //         onStudentSelect(student)
// //         toast.success(`${student.name} selected successfully`)
// //       } else {
// //         toast.error("No student found with this roll number")
// //         onStudentSelect(null)
// //       }
// //     } catch (error) {
// //       toast.error("Failed to search for student")
// //     } finally {
// //       setIsSearching(false)
// //     }
// //   }

// //   // Feature 2: Handle Enter key press for search
// //   const handleKeyPress = (e: React.KeyboardEvent) => {
// //     if (e.key === "Enter") {
// //       searchStudent()
// //     }
// //   }

// //   // Feature 1: Clear input field
// //   const handleClearInput = () => {
// //     setRollNumber("")
// //   }

// //   // Feature 3: Clear selected student (exposed via public method pattern)
// //   const clearSelectedStudent = () => {
// //     onStudentSelect(null)
// //     setRollNumber("")
// //   }

// //   return (
// //     <Card>
// //       <CardHeader className="mb-0">
// //         <CardTitle className="text-lg font-semibold text-gray-900 m-0 p-0">Student Lookup</CardTitle>
// //       </CardHeader>
// //       <CardContent className="space-y-2">
// //         <div className="flex space-x-2">
// //           <div className="relative flex-1">
// //             <Input
// //               placeholder="Enter roll number"
// //               value={rollNumber}
// //               onChange={(e) => setRollNumber(e.target.value)}
// //               onKeyPress={handleKeyPress}
// //               className="flex-1 text-lg pr-10"
// //             />
// //             {/* Feature 1: Clear button in input field */}
// //             {rollNumber && (
// //               <button
// //                 type="button"
// //                 onClick={handleClearInput}
// //                 className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
// //                 aria-label="Clear search"
// //               >
// //                 <X className="w-4 h-4" />
// //               </button>
// //             )}
// //           </div>
// //           <Button
// //             onClick={searchStudent}
// //             disabled={isSearching}
// //             className="bg-green-500 hover:bg-green-600 text-white px-6"
// //           >
// //             <Search className="w-4 h-4 mr-2" />
// //             {isSearching ? "Searching..." : "Search"}
// //           </Button>
// //         </div>

// //         {selectedStudent && (
// //           <div className="p-2 bg-green-50 border border-green-200 rounded-lg">
// //             <div className="flex items-center justify-between">
// //               <div className="flex items-center space-x-3">
// //                 <div className="bg-green-500 text-white w-12 h-12 rounded-full flex items-center justify-center font-bold">
// //                   {selectedStudent.name
// //                     .split(" ")
// //                     .map((n) => n[0])
// //                     .join("")
// //                     .slice(0, 2)}
// //                 </div>
// //                 <div>
// //                   <h4 className="font-semibold text-gray-900">{selectedStudent.name}</h4>
// //                   <p className="text-sm text-gray-600">{selectedStudent.rollNumber}</p>
// //                 </div>
// //               </div>
// //               <div className="text-right">
// //                 <p className="text-sm text-gray-600">Available Balance</p>
// //                 <p className="text-2xl font-bold text-green-500">₹{selectedStudent.balance.toFixed(2)}</p>
// //               </div>
// //             </div>
// //           </div>
// //         )}
// //       </CardContent>
// //     </Card>
// //   )
// // }