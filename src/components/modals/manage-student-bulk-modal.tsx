"use client";

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Hash, GraduationCap, UserPlus, CalendarDays } from 'lucide-react';

import { AssignIdsTab } from '@/components/elements/student/BulkAssignIdTab';
import { AssignRollsTab } from '@/components/elements/student/BulkAssignRollNumberTab';
import { BulkAddTab } from '@/components/elements/student/BulkAddTab';
import { ConsumerYearConfigTab } from '@/components/elements/student/ConsumerYearConfigTab';
import type { StudentRow, ConsumerYearConfigResponse } from '@/types/manage-student/manage-student-bulk';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function BulkStudentUpdateModal({ open, onOpenChange }: Props) {
  const queryClient = useQueryClient();

  const { data: students, isLoading: studentsLoading } = useQuery<StudentRow[]>({
    queryKey: ["students-bulk-update"],
    queryFn: async () => {
      const res = await fetch("/api/students/bulk-assign-id");
      if (!res.ok) throw new Error("Failed to fetch students");
      // id / rollNumber / standard come back as numbers — StudentRow's type
      // reflects that directly, no coercion needed here.
      return (await res.json()).data as StudentRow[];
    },
    enabled: open,
  });

  const { data: yearData, isLoading: yearLoading } = useQuery<ConsumerYearConfigResponse>({
    queryKey: ["consumer-year-config"],
    queryFn: async () => {
      const res = await fetch("/api/consumer-year-config");
      if (!res.ok) throw new Error("Failed to fetch year config");
      return (await res.json()).data;
    },
    enabled: open,
  });

  const activeYear = yearData?.activeYear ?? null;
  const yearHistory = yearData?.history ?? [];

  const invalidateStudents = () => {
    queryClient.invalidateQueries({ queryKey: ["students-bulk-update"] });
    queryClient.invalidateQueries({ queryKey: ["students"] });
  };

  const invalidateConsumerYearConfig = () => {
    queryClient.invalidateQueries({ queryKey: ["consumer-year-config"] });
  };

  const handleClose = () => onOpenChange(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-xl md:max-w-4xl lg:max-w-5xl h-[90vh] flex flex-col gap-0 p-0">
        <DialogDescription className="sr-only">
          Manage student IDs, roll numbers, new students, and academic year.
        </DialogDescription>

        {/*
          Keying on `open` remounts the whole Tabs subtree (and therefore every
          tab's local state) each time the modal is closed and reopened —
          equivalent to the old single "reset everything on close" effect,
          without each tab needing its own reset logic.
        */}
        <Tabs key={open ? "open" : "closed"} defaultValue="bulk-add" className="flex flex-col flex-1 min-h-0 gap-0">
          <div className="px-3 pt-2 pb-0 border-b border-gray-100 flex-shrink-0">
            <DialogTitle className="text-lg font-semibold mb-3">Student Management</DialogTitle>
            <TabsList>
              <TabsTrigger value="bulk-add" className="gap-1.5 text-sm">
                <UserPlus className="w-3.5 h-3.5" /> Add Students
              </TabsTrigger>
              <TabsTrigger value="bulk-assign-id" className="gap-1.5 text-sm">
                <Hash className="w-3.5 h-3.5" /> Assign IDs
              </TabsTrigger>
              <TabsTrigger value="bulk-assign-roll" className="gap-1.5 text-sm">
                <GraduationCap className="w-3.5 h-3.5" /> Assign Rolls
              </TabsTrigger>
              <TabsTrigger value="consumer-year-config" className="gap-1.5 text-sm">
                <CalendarDays className="w-3.5 h-3.5" /> Year Config
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="bulk-assign-id" className="flex-1 flex flex-col min-h-0 mt-0 data-[state=inactive]:hidden">
            <AssignIdsTab
              students={students}
              studentsLoading={studentsLoading}
              onMutated={invalidateStudents}
              onClose={handleClose}
            />
          </TabsContent>

          <TabsContent value="bulk-assign-roll" className="flex-1 flex flex-col min-h-0 mt-0 data-[state=inactive]:hidden">
            <AssignRollsTab
              students={students}
              studentsLoading={studentsLoading}
              activeYear={activeYear}
              yearLoading={yearLoading}
              onMutated={invalidateStudents}
              onClose={handleClose}
            />
          </TabsContent>

          <TabsContent value="bulk-add" className="flex-1 flex flex-col min-h-0 mt-0 data-[state=inactive]:hidden">
            <BulkAddTab activeYear={activeYear} onStudentsCreated={invalidateStudents} />
          </TabsContent>

          <TabsContent
            value="consumer-year-config"
            className="flex-1 flex flex-col min-h-0 mt-0 overflow-y-auto data-[state=inactive]:hidden"
          >
            <ConsumerYearConfigTab activeYear={activeYear} yearHistory={yearHistory} onMutated={invalidateConsumerYearConfig} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}