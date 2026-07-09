// components/modals/highest-purchased-student-modal.tsx
"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Award, TrendingUp, ShoppingBag, Trophy } from 'lucide-react'
import type { HighestPurchasedStudent } from '@/types/dashboard/overview'

interface HighestPurchasedStudentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  student: HighestPurchasedStudent | null
}

export default function HighestPurchasedStudentModal({
  open,
  onOpenChange,
  student
}: HighestPurchasedStudentModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-600" />
            Top Customer Today
          </DialogTitle>
          <p className="text-sm text-gray-600">Student with highest purchases today</p>
        </DialogHeader>

        <div className="space-y-4">
          {student ? (
            <>
              {/* Student Info Card */}
              <Card className="border-2 border-yellow-500 bg-gradient-to-br from-yellow-50 to-white">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="bg-yellow-100 p-3 rounded-full">
                        <Award className="text-yellow-600 w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg text-gray-900">{student.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary" className="text-xs">
                            Roll: {student.rollNumber}
                          </Badge>
                          <span className="text-sm text-gray-600">{student.standard}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-3">
                {/* Total Purchase Card */}
                <Card className="bg-gradient-to-br from-blue-50 to-white">
                  <CardContent className="p-4">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2 text-blue-600 mb-2">
                        <TrendingUp className="w-4 h-4" />
                        <span className="text-xs font-medium">Total Purchase</span>
                      </div>
                      <p className="text-2xl font-bold text-gray-900">
                        ₹{student.totalPurchase.toLocaleString('en-IN')}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Transaction Count Card */}
                <Card className="bg-gradient-to-br from-purple-50 to-white">
                  <CardContent className="p-4">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2 text-purple-600 mb-2">
                        <ShoppingBag className="w-4 h-4" />
                        <span className="text-xs font-medium">Transactions</span>
                      </div>
                      <p className="text-2xl font-bold text-gray-900">
                        {student.transactionCount}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Achievement Badge */}
              <Card className="bg-gradient-to-r from-yellow-100 via-yellow-50 to-orange-50 border-yellow-300">
                <CardContent className="p-4">
                  <div className="flex items-center justify-center gap-2">
                    <Trophy className="w-5 h-5 text-yellow-600" />
                    <p className="text-sm font-semibold text-yellow-800">
                      🎉 Top Customer of the Day!
                    </p>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <div className="text-center py-8">
              <Award className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No purchases made today</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}