// components/admin/pos/student-lookup.tsx
"use client";

import { useState, useCallback, useEffect } from "react";
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

  // Clear roll number input when selectedStudent becomes null
  useEffect(() => {
    if (selectedStudent === null) {
      setRollNumber("");
    }
  }, [selectedStudent]);

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

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
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
    <Card className="p-4 gap-0 px-0">
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
              onKeyDown={handleKeyDown}
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
// import { Search, X, Loader2 } from 'lucide-react';
// import { toast } from "sonner";
// import type { Student, ApiResponse } from "@/types/pos";

// interface StudentLookupProps {
//   selectedStudent: Student | null;
//   onStudentSelect: (student: Student | null) => void;
// }

// export default function StudentLookup({ selectedStudent, onStudentSelect }: StudentLookupProps) {
//   const [rollNumber, setRollNumber] = useState("");
//   const [isSearching, setIsSearching] = useState(false);
  
//   // Clear roll number input when selectedStudent becomes null (e.g., after transaction complete)
//   useEffect(() => {
//     if (selectedStudent === null) {
//       setRollNumber("");
//     }
//   }, [selectedStudent]);

//   const searchStudent = useCallback(async () => {
//     if (!rollNumber.trim()) {
//       toast.error("Please enter a roll number");
//       return;
//     }

//     setIsSearching(true);
//     try {
//       const response = await fetch(`/api/students/${rollNumber.trim()}`);
      
//       if (response.ok) {
//         const result: ApiResponse<Student> = await response.json();
        
//         if (result.success && result.data) {
//           onStudentSelect(result.data);
//           toast.success(`${result.data.name} selected successfully`);
//         } else {
//           toast.error("No student found with this roll number");
//           onStudentSelect(null);
//         }
//       } else {
//         const error = await response.json().catch(() => ({}));
//         toast.error(error.error?.message || "No student found with this roll number");
//         onStudentSelect(null);
//       }
//     } catch (error) {
//       console.error("Search error:", error);
//       toast.error("Failed to search for student");
//       onStudentSelect(null);
//     } finally {
//       setIsSearching(false);
//     }
//   }, [rollNumber, onStudentSelect]);

//   const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
//     if (e.key === "Enter") {
//       searchStudent();
//     }
//   }, [searchStudent]);

//   const handleClearInput = useCallback(() => {
//     setRollNumber("");
//   }, []);

//   const clearSelectedStudent = useCallback(() => {
//     onStudentSelect(null);
//     setRollNumber("");
//   }, [onStudentSelect]);

//   return (
//     <Card>
//       <CardHeader className="mb-0">
//         <CardTitle className="text-lg font-semibold text-gray-900 m-0 p-0">Student Lookup</CardTitle>
//       </CardHeader>
//       <CardContent className="space-y-2">
//         <div className="flex space-x-2">
//           <div className="relative flex-1">
//             <Input
//               placeholder="Enter roll number"
//               value={rollNumber}
//               onChange={(e) => setRollNumber(e.target.value)}
//               onKeyPress={handleKeyPress}
//               className="flex-1 text-lg pr-10"
//               disabled={isSearching}
//             />
//             {rollNumber && (
//               <button
//                 type="button"
//                 onClick={handleClearInput}
//                 className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
//                 aria-label="Clear search"
//                 disabled={isSearching}
//               >
//                 <X className="w-4 h-4" />
//               </button>
//             )}
//           </div>
//           <Button
//             onClick={searchStudent}
//             disabled={isSearching || !rollNumber.trim()}
//             className="bg-green-500 hover:bg-green-600 text-white px-6"
//           >
//             {isSearching ? (
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

//         {selectedStudent && (
//           <div className="p-2 bg-green-50 border border-green-200 rounded-lg">
//             <div className="flex items-center justify-between">
//               <div className="flex items-center space-x-3">
//                 <div className="bg-green-500 text-white w-12 h-12 rounded-full flex items-center justify-center font-bold">
//                   {selectedStudent.name
//                     .split(" ")
//                     .map((n) => n[0])
//                     .join("")
//                     .slice(0, 2)
//                     .toUpperCase()}
//                 </div>
//                 <div>
//                   <h4 className="font-semibold text-gray-900">{selectedStudent.name}</h4>
//                   <p className="text-sm text-gray-600">{selectedStudent.rollNumber}</p>
//                   <p className="text-xs text-gray-500">{selectedStudent.standard} - {selectedStudent.year}</p>
//                 </div>
//               </div>
//               <div className="text-right">
//                 <p className="text-sm text-gray-600">Available Balance</p>
//                 <p className="text-2xl font-bold text-green-500">
//                   ₹{selectedStudent.balance.toFixed(2)}
//                 </p>
//                 <Button
//                   onClick={clearSelectedStudent}
//                   variant="ghost"
//                   size="sm"
//                   className="mt-1 h-6 text-xs"
//                 >
//                   Clear
//                 </Button>
//               </div>
//             </div>
//           </div>
//         )}
//       </CardContent>
//     </Card>
//   );
// }