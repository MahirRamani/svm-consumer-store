// components/modals/low-balance-students-modal.tsx
"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Wallet, AlertTriangle, Phone, Users } from "lucide-react"
import type { LowBalanceStudent } from "@/types/dashboard/overview"

interface LowBalanceStudentsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  students: LowBalanceStudent[]
}

export default function LowBalanceStudentsModal({ 
  open, 
  onOpenChange, 
  students 
}: LowBalanceStudentsModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-orange-600" />
            Low Balance Students ({students.length} students)
          </DialogTitle>
          <p className="text-sm text-gray-600">Students with balance below ₹500</p>
        </DialogHeader>

        <div className="space-y-3">
          {students.length > 0 ? (
            students.map((student) => (
              <Card key={student.id} className="border-l-4 border-l-orange-500">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="bg-orange-100 p-2 rounded-lg">
                        <Users className="text-orange-600 w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{student.name}</h3>
                        <div className="flex items-center gap-3 mt-1">
                          <Badge variant="outline" className="text-xs">
                            Roll: {student.rollNumber}
                          </Badge>
                          <span className="text-xs text-gray-600">{student.standard}</span>
                          {student.mobileNo && (
                            <span className="text-xs text-gray-600 flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {student.mobileNo}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1 justify-end">
                        <AlertTriangle className="w-4 h-4 text-orange-600" />
                        <span className={`font-bold ${
                          student.balance < 0 
                            ? 'text-red-600' 
                            : student.balance < 100 
                            ? 'text-orange-600' 
                            : 'text-yellow-600'
                        }`}>
                          ₹{student.balance.toFixed(2)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {student.balance < 0 
                          ? 'Negative balance' 
                          : 'Low balance'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="text-center py-8">
              <Wallet className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">All students have sufficient balance!</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}