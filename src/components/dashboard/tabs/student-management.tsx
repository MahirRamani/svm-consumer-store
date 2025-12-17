// components/dashboard/tabs/student-management.tsx
"use client";

import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, PlusCircle, Edit, History, Search, Trash2, Minus, Eye, EyeOff } from "lucide-react";
import AddStudentModal from "@/components/modals/add-student-modal";
import TopUpModal from "@/components/modals/top-up-modal";
import DeductBalanceModal from "@/components/modals/deduct-balance-modal";
import EditStudentModal from "@/components/modals/edit-student-modal";
import { useDeleteStudent, useToggleStudentStatus } from "@/hooks/use-student-mutations";
import type { Student } from "@/types";

interface StudentApiResponse {
  success?: boolean;
  students?: Student[];
  data?: Student[];
}

export default function StudentManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStandard, setSelectedStandard] = useState<string>("all");
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [showInactive, setShowInactive] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [showDeductModal, setShowDeductModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  // Use custom hooks
  const deleteMutation = useDeleteStudent();
  const toggleStatusMutation = useToggleStudentStatus();

  const { data: studentsData, isLoading } = useQuery<Student[]>({
    queryKey: ["students", showInactive],
    queryFn: async (): Promise<Student[]> => {
      const params = new URLSearchParams();
      if (showInactive) {
        params.append("includeInactive", "true");
      }

      const response = await fetch(`/api/students?${params}`);
      if (!response.ok) throw new Error("Failed to fetch students");
      const data: StudentApiResponse = await response.json();

      // Handle different response formats
      if (data.success && data.data) return data.data;
      if (data.students) return data.students;
      if (Array.isArray(data)) return data;

      return [];
    },
  });

  const students = studentsData || [];

  const handleTopUp = useCallback((studentId: string) => {
    setSelectedStudentId(studentId);
    setShowTopUpModal(true);
  }, []);

  const handleDeduct = useCallback((studentId: string) => {
    setSelectedStudentId(studentId);
    setShowDeductModal(true);
  }, []);

  const handleEditStudent = useCallback((student: Student) => {
    setSelectedStudent(student);
    setShowEditModal(true);
  }, []);

  const handleToggleActive = useCallback(
    (studentId: string, currentStatus: boolean) => {
      toggleStatusMutation.mutate({
        _id: studentId,
        isActive: !currentStatus,
      });
    },
    [toggleStatusMutation]
  );

  const handleDeleteStudent = useCallback(
    (studentId: string, studentName: string) => {
      if (window.confirm(`Are you sure you want to delete ${studentName}'s account? This action cannot be undone.`)) {
        deleteMutation.mutate(studentId);
      }
    },
    [deleteMutation]
  );

  const filteredStudents = useMemo(() => {
    return students.filter((student: Student) => {
      const matchesSearch =
        student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.rollNumber.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStandard = selectedStandard === "all" || student.standard === selectedStandard;
      const matchesYear = selectedYear === "all" || student.year.toString() === selectedYear;

      return matchesSearch && matchesStandard && matchesYear;
    });
  }, [students, searchTerm, selectedStandard, selectedYear]);

  const getBalanceStatus = useCallback((balance: number): { label: string; variant: "default" | "destructive" | "secondary" } => {
    if (balance > 100) return { label: "Active", variant: "default" };
    if (balance > 0) return { label: "Low Balance", variant: "secondary" };
    return { label: "No Balance", variant: "destructive" };
  }, []);

  const getInitials = useCallback((name: string): string => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }, []);

  if (isLoading) {
    return <div className="text-center py-8">Loading students...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Student Account Management</h2>
        <Button onClick={() => setShowAddModal(true)} className="bg-blue-500 hover:bg-blue-600 text-white">
          <Plus className="w-4 h-4 mr-2" />
          Add Student
        </Button>
      </div>

      {/* Search and Filter */}
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label className="block text-sm font-medium text-gray-700 mb-2">Search Student</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Roll number or name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div>
              <Label className="block text-sm font-medium text-gray-700 mb-2">Standard</Label>
              <Select value={selectedStandard} onValueChange={setSelectedStandard}>
                <SelectTrigger>
                  <SelectValue placeholder="All Standards" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Standards</SelectItem>
                  {["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th"].map((std) => (
                    <SelectItem key={std} value={std}>
                      {std} Standard
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="block text-sm font-medium text-gray-700 mb-2">Year</Label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger>
                  <SelectValue placeholder="All Years" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Years</SelectItem>
                  {[2024, 2023, 2022, 2021, 2020, 2019].map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="block text-sm font-medium text-gray-700 mb-2">Show Inactive</Label>
              <div className="flex items-center space-x-2 mt-3">
                <Button
                  variant={showInactive ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowInactive(!showInactive)}
                  className="w-full"
                >
                  {showInactive ? <Eye className="w-4 h-4 mr-2" /> : <EyeOff className="w-4 h-4 mr-2" />}
                  {showInactive ? "Showing All" : "Active Only"}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Students List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-900">
            Student Accounts
            {filteredStudents.length > 0 && (
              <span className="ml-2 text-sm font-normal text-gray-500">({filteredStudents.length} students)</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filteredStudents.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {students.length === 0 ? "No students found." : "No students match your current filters."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Roll Number</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Standard</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Year</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Balance</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredStudents.map((student: Student) => {
                    const balanceStatus = getBalanceStatus(student.balance);
                    const initials = getInitials(student.name);

                    return (
                      <tr key={student._id} className={!student.isActive ? "bg-gray-50 opacity-75" : ""}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="bg-blue-500 text-white w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium">
                              {initials}
                            </div>
                            <div className="ml-3">
                              <p className={`text-sm font-medium ${student.isActive ? "text-gray-900" : "text-gray-500"}`}>
                                {student.name}
                              </p>
                              {student.mobileNo && <p className="text-xs text-gray-500">{student.mobileNo}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{student.rollNumber}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{student.standard}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{student.year}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">₹{student.balance.toFixed(2)}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Badge
                            variant={balanceStatus.variant}
                            className={
                              balanceStatus.variant === "default" ? "bg-green-500 hover:bg-green-600" : ""
                            }
                          >
                            {student.isActive ? balanceStatus.label : "Inactive"}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div className="flex space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleActive(student._id, student.isActive)}
                              disabled={toggleStatusMutation.isPending}
                              className={student.isActive ? "text-orange-500 hover:text-orange-600" : "text-green-500 hover:text-green-600"}
                              title={student.isActive ? "Deactivate Student" : "Activate Student"}
                            >
                              {student.isActive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleTopUp(student._id)}
                              className="text-green-500 hover:text-green-600"
                              title="Add Balance"
                            >
                              <PlusCircle className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeduct(student._id)}
                              className="text-red-500 hover:text-red-600"
                              title="Deduct Balance"
                            >
                              <Minus className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditStudent(student)}
                              className="text-purple-500 hover:text-purple-600"
                              title="Edit Student"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" className="text-gray-400 hover:text-gray-600" title="View History">
                              <History className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteStudent(student._id, student.name)}
                              disabled={deleteMutation.isPending}
                              className="text-red-500 hover:text-red-600"
                              title="Delete Student"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modals */}
      <AddStudentModal open={showAddModal} onOpenChange={setShowAddModal} />
      <TopUpModal open={showTopUpModal} onOpenChange={setShowTopUpModal} studentId={selectedStudentId} />
      <DeductBalanceModal open={showDeductModal} onOpenChange={setShowDeductModal} studentId={selectedStudentId} />
      <EditStudentModal open={showEditModal} onOpenChange={setShowEditModal} student={selectedStudent} />
    </div>
  );
}





// "use client"

// import { useState } from "react"
// import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
// import { Button } from "@/components/ui/button"
// import { Input } from "@/components/ui/input"
// import { Label } from "@/components/ui/label"
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
// import { Badge } from "@/components/ui/badge"
// import { Plus, PlusCircle, Edit, History, Search, Trash2, Minus } from "lucide-react"
// import { toast } from "sonner"
// import AddStudentModal from "@/components/modals/add-student-modal"
// import TopUpModal from "@/components/modals/top-up-modal"
// import DeductBalanceModal from "@/components/modals/deduct-balance-modal"
// import EditStudentModal from "@/components/modals/edit-student-modal"
// import type { Student } from "@/lib/types"

// export default function StudentManagement() {
//   const [searchTerm, setSearchTerm] = useState("")
//   const [selectedStandard, setSelectedStandard] = useState<string>("all")
//   const [selectedYear, setSelectedYear] = useState<string>("all")
//   const [showAddModal, setShowAddModal] = useState(false)
//   const [showTopUpModal, setShowTopUpModal] = useState(false)
//   const [showDeductModal, setShowDeductModal] = useState(false)
//   const [showEditModal, setShowEditModal] = useState(false)
//   const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null)
//   const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
//   const queryClient = useQueryClient()

//   const { data: students, isLoading } = useQuery({
//     queryKey: ["students"],
//     queryFn: async () => {
//       const response = await fetch("/api/students")
//       if (!response.ok) throw new Error("Failed to fetch students")
//       return response.json()
//     },
//   })

//   const topUpMutation = useMutation({
//     mutationFn: async ({ studentId, amount }: { studentId: string; amount: number }) => {
//       const response = await fetch(`/api/students/${studentId}/balance`, {
//         method: "PATCH",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ amount }),
//       })
//       if (!response.ok) throw new Error("Failed to update balance")
//       return response.json()
//     },
//     onSuccess: () => {
//       queryClient.invalidateQueries({ queryKey: ["students"] })
//       toast.success("Student balance has been updated successfully.")
//       setShowTopUpModal(false)
//       setSelectedStudentId(null)
//     },
//     onError: () => {
//       toast.error("Failed to update student balance.")
//     },
//   })

//   const deductMutation = useMutation({
//     mutationFn: async ({ studentId, amount, reason }: { studentId: string; amount: number; reason: string }) => {
//       const response = await fetch(`/api/students/${studentId}/balance`, {
//         method: "PATCH",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ amount: -amount, reason }),
//       })
//       if (!response.ok) throw new Error("Failed to deduct balance")
//       return response.json()
//     },
//     onSuccess: () => {
//       queryClient.invalidateQueries({ queryKey: ["students"] })
//       toast.success("Balance deducted successfully.")
//       setShowDeductModal(false)
//       setSelectedStudentId(null)
//     },
//     onError: () => {
//       toast.error("Failed to deduct balance.")
//     },
//   })

//   const editStudentMutation = useMutation({
//     mutationFn: async (data: { name: string; rollNumber: string; standard: string; year: number }) => {
//       if (!selectedStudent?.id) throw new Error("No student selected")
//       const response = await fetch(`/api/students/${selectedStudent.id}`, {
//         method: "PATCH",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify(data),
//       })
//       if (!response.ok) throw new Error("Failed to update student")
//       return response.json()
//     },
//     onSuccess: () => {
//       queryClient.invalidateQueries({ queryKey: ["students"] })
//       toast.success("Student updated successfully.")
//       setShowEditModal(false)
//       setSelectedStudent(null)
//     },
//     onError: () => {
//       toast.error("Failed to update student.")
//     },
//   })

//   const deleteStudentMutation = useMutation({
//     mutationFn: async (studentId: string) => {
//       const response = await fetch(`/api/students/${studentId}`, {
//         method: "DELETE",
//       })
//       if (!response.ok) throw new Error("Failed to delete student")
//       return response.json()
//     },
//     onSuccess: () => {
//       queryClient.invalidateQueries({ queryKey: ["students"] })
//       toast.success("Student account has been deleted successfully.")
//     },
//     onError: () => {
//       toast.error("Failed to delete student account.")
//     },
//   })
  
//   const handleTopUp = (studentId: string) => {
//     setSelectedStudentId(studentId)
//     setShowTopUpModal(true)
//   }
  
//   const handleDeduct = (studentId: string) => {
//     setSelectedStudentId(studentId)
//     setShowDeductModal(true)
//   }
  
//   const handleTopUpConfirm = (amount: number) => {
//     if (selectedStudentId) {
//       topUpMutation.mutate({ studentId: selectedStudentId, amount })
//     }
//   }
  
//   const handleDeductConfirm = (amount: number, reason: string) => {
//     if (selectedStudentId) {
//       deductMutation.mutate({ studentId: selectedStudentId, amount, reason })
//     }
//   }
  
//   const handleEditStudent = (student: Student) => {
//     setSelectedStudent(student)
//     setShowEditModal(true)
//   }
  
//   const handleConfirmEdit = (data: { name: string; rollNumber: string; standard: string; year: number }) => {
//     editStudentMutation.mutate(data)
//   }

//   const handleDeleteStudent = (studentId: string, studentName: string) => {
//     if (window.confirm(`Are you sure you want to delete ${studentName}'s account? This action cannot be undone.`)) {
//       deleteStudentMutation.mutate(studentId)
//     }
//   }

//   const filteredStudents = students?.filter((student: Student) => {
//     const matchesSearch =
//       student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
//       student.rollNumber.toLowerCase().includes(searchTerm.toLowerCase())
//     const matchesStandard = selectedStandard === "all" || student.standard === selectedStandard
//     const matchesYear = selectedYear === "all" || student.year.toString() === selectedYear

//     return matchesSearch && matchesStandard && matchesYear
//   })

//   if (isLoading) {
//     return <div className="text-center py-8">Loading students...</div>
//   }

//   return (
//     <div className="space-y-6">
//       <div className="flex justify-between items-center">
//         <h2 className="text-2xl font-bold text-gray-900">Student Account Management</h2>
//         <Button onClick={() => setShowAddModal(true)} className="bg-blue-500 hover:bg-blue-600 text-white">
//           <Plus className="w-4 h-4 mr-2" />
//           Add Student
//         </Button>
//       </div>

//       {/* Search and Filter */}
//       <Card>
//         <CardContent className="p-6">
//           <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
//             <div>
//               <Label className="block text-sm font-medium text-gray-700 mb-2">Search Student</Label>
//               <div className="relative">
//                 <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
//                 <Input
//                   placeholder="Roll number or name..."
//                   value={searchTerm}
//                   onChange={(e) => setSearchTerm(e.target.value)}
//                   className="pl-10"
//                 />
//               </div>
//             </div>
//             <div>
//               <Label className="block text-sm font-medium text-gray-700 mb-2">Standard</Label>
//               <Select value={selectedStandard} onValueChange={setSelectedStandard}>
//                 <SelectTrigger>
//                   <SelectValue placeholder="All Standards" />
//                 </SelectTrigger>
//                 <SelectContent>
//                   <SelectItem value="all">All Standards</SelectItem>
//                   <SelectItem value="1st">1st Standard</SelectItem>
//                   <SelectItem value="2nd">2nd Standard</SelectItem>
//                   <SelectItem value="3rd">3rd Standard</SelectItem>
//                   <SelectItem value="4th">4th Standard</SelectItem>
//                   <SelectItem value="5th">5th Standard</SelectItem>
//                   <SelectItem value="6th">6th Standard</SelectItem>
//                   <SelectItem value="7th">7th Standard</SelectItem>
//                   <SelectItem value="8th">8th Standard</SelectItem>
//                   <SelectItem value="9th">9th Standard</SelectItem>
//                   <SelectItem value="10th">10th Standard</SelectItem>
//                 </SelectContent>
//               </Select>
//             </div>
//             <div>
//               <Label className="block text-sm font-medium text-gray-700 mb-2">Year</Label>
//               <Select value={selectedYear} onValueChange={setSelectedYear}>
//                 <SelectTrigger>
//                   <SelectValue placeholder="All Years" />
//                 </SelectTrigger>
//                 <SelectContent>
//                   <SelectItem value="all">All Years</SelectItem>
//                   <SelectItem value="2024">2024</SelectItem>
//                   <SelectItem value="2023">2023</SelectItem>
//                   <SelectItem value="2022">2022</SelectItem>
//                   <SelectItem value="2021">2021</SelectItem>
//                   <SelectItem value="2020">2020</SelectItem>
//                   <SelectItem value="2019">2019</SelectItem>
//                 </SelectContent>
//               </Select>
//             </div>
//           </div>
//         </CardContent>
//       </Card>

//       {/* Students List */}
//       <Card>
//         <CardHeader>
//           <CardTitle className="text-lg font-semibold text-gray-900">Student Accounts</CardTitle>
//         </CardHeader>
//         <CardContent className="p-0">
//           <div className="overflow-x-auto">
//             <table className="w-full">
//               <thead className="bg-gray-50">
//                 <tr>
//                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                     Student
//                   </th>
//                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                     Roll Number
//                   </th>
//                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                     Standard
//                   </th>
//                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                     Balance
//                   </th>
//                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                     Status
//                   </th>
//                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                     Actions
//                   </th>
//                 </tr>
//               </thead>
//               <tbody className="bg-white divide-y divide-gray-200">
//                 {filteredStudents?.map((student: Student) => {
//                   const balance = student.balance
//                   const initials = student.name
//                     .split(" ")
//                     .map((n) => n[0])
//                     .join("")
//                     .slice(0, 2)

//                   return (
//                     <tr key={student.id}>
//                       <td className="px-6 py-4 whitespace-nowrap">
//                         <div className="flex items-center">
//                           <div className="bg-blue-500 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium">
//                             {initials}
//                           </div>
//                           <div className="ml-3">
//                             <p className="text-sm font-medium text-gray-900">{student.name}</p>
//                           </div>
//                         </div>
//                       </td>
//                       <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{student.rollNumber}</td>
//                       <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{student.standard}</td>
//                       <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
//                         ₹{balance.toFixed(2)}
//                       </td>
//                       <td className="px-6 py-4 whitespace-nowrap">
//                         <Badge
//                           variant={balance > 100 ? "default" : "destructive"}
//                           className={balance > 100 ? "bg-green-500 hover:bg-green-600" : ""}
//                         >
//                           {balance > 100 ? "Active" : "Low Balance"}
//                         </Badge>
//                       </td>
//                       <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
//                         <div className="flex space-x-2">
//                           <Button
//                             variant="ghost"
//                             size="sm"
//                             onClick={() => handleTopUp(student.id)}
//                             className="text-green-500 hover:text-green-600"
//                             title="Add Balance"
//                           >
//                             <PlusCircle className="w-4 h-4" />
//                           </Button>
//                           <Button
//                             variant="ghost"
//                             size="sm"
//                             onClick={() => handleDeduct(student.id)}
//                             className="text-red-500 hover:text-red-600"
//                             title="Deduct Balance"
//                           >
//                             <Minus className="w-4 h-4" />
//                           </Button>
//                           <Button
//                             variant="ghost"
//                             size="sm"
//                             onClick={() => handleEditStudent(student)}
//                             className="text-purple-500 hover:text-purple-600"
//                             title="Edit Student"
//                           >
//                             <Edit className="w-4 h-4" />
//                           </Button>
//                           <Button variant="ghost" size="sm" className="text-gray-400 hover:text-gray-600">
//                             <History className="w-4 h-4" />
//                           </Button>
//                           <Button
//                             variant="ghost"
//                             size="sm"
//                             onClick={() => handleDeleteStudent(student.id, student.name)}
//                             className="text-red-500 hover:text-red-600"
//                           >
//                             <Trash2 className="w-4 h-4" />
//                           </Button>
//                         </div>
//                       </td>
//                     </tr>
//                   )
//                 })}
//               </tbody>
//             </table>
//           </div>
//         </CardContent>
//       </Card>

//       <AddStudentModal open={showAddModal} onOpenChange={setShowAddModal} />

//       <TopUpModal
//         open={showTopUpModal}
//         onOpenChange={setShowTopUpModal}
//         onConfirm={handleTopUpConfirm}
//         isLoading={topUpMutation.isPending}
//       />

//       <DeductBalanceModal
//         open={showDeductModal}
//         onOpenChange={setShowDeductModal}
//         onConfirm={handleDeductConfirm}
//         isLoading={deductMutation.isPending}
//       />
      
//       <EditStudentModal
//         open={showEditModal}
//         onOpenChange={setShowEditModal}
//         onConfirm={handleConfirmEdit}
//         isLoading={editStudentMutation.isPending}
//         student={selectedStudent}
//       />
//     </div>
//   )
// }