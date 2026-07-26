"use client"

import { cn } from "@/lib/utils";
import { ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface PaginationMeta {
  totalPages: number;
  totalCount: number;
  startIndex: number;
  endIndex: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

interface PaginationControlsProps {
  pagination: PaginationMeta | undefined;
  currentPage: number;
  pageSize: number;
  pageSizeOptions?: number[];          // ✅ configurable, has default
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  scrollToTop?: boolean;               // ✅ optional, default true
  className?: string;                  // ✅ allow style overrides
}

export function PaginationControls({
  pagination,
  currentPage,
  pageSize,
  pageSizeOptions = [5, 10, 20, 50, 100],
  onPageChange,
  onPageSizeChange,
  scrollToTop = true,
  className,
}: PaginationControlsProps) {
  if (!pagination) return null;

  const { totalPages, totalCount, startIndex, endIndex, hasNextPage, hasPreviousPage } = pagination;

  const goToPage = (page: number) => {
    onPageChange(page);
    if (scrollToTop) window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handlePageSizeChange = (v: string) => {
    onPageSizeChange(Number(v));
    onPageChange(1); // always reset to page 1
  };

  const pages: number[] = [];
  if (totalPages <= 5) for (let i = 1; i <= totalPages; i++) pages.push(i);
  else if (currentPage <= 3) for (let i = 1; i <= 5; i++) pages.push(i);
  else if (currentPage >= totalPages - 2) for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
  else for (let i = currentPage - 2; i <= currentPage + 2; i++) pages.push(i);

  return (
    <div className={cn("flex items-center justify-between px-4 py-2 bg-gray-50 border-t text-sm rounded-b-xl", className)}>
      <div className="flex items-center gap-2">
        <span>{totalCount === 0 ? "No results" : `Showing ${startIndex} – ${endIndex} of ${totalCount} results`}</span>
        <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
          <SelectTrigger className="w-18 h-8 text-sm font-medium text-gray-900 [&>svg]:text-gray-900 [&>svg]:opacity-100"><SelectValue /></SelectTrigger>
          <SelectContent>
            {pageSizeOptions.map((n) => (
              <SelectItem key={n} value={String(n)}>{n}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-gray-700">per page</span>
      </div>

      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon" className="h-9 w-9"
          onClick={() => goToPage(1)} disabled={!hasPreviousPage}>
          <ChevronsLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" className="h-9 w-9"
          onClick={() => goToPage(currentPage - 1)} disabled={!hasPreviousPage}>
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {pages.map((p) => (
          <Button key={p} variant={currentPage === p ? "default" : "outline"} size="icon"
            className="h-9 w-9 text-sm" onClick={() => goToPage(p)}>
            {p}
          </Button>
        ))}

        <Button variant="outline" size="icon" className="h-9 w-9"
          onClick={() => goToPage(currentPage + 1)} disabled={!hasNextPage}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" className="h-9 w-9"
          onClick={() => goToPage(totalPages)} disabled={!hasNextPage}>
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}