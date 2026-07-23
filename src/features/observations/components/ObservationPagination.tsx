import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ObservationListResponse } from "../types";

export function ObservationPagination({ pagination, onPageChange, onPageSizeChange }: {
  pagination: ObservationListResponse["pagination"];
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  const start = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.pageSize + 1;
  const end = Math.min(pagination.page * pagination.pageSize, pagination.total);
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card/70 p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">{start}–{end} of {pagination.total}</p>
      <div className="flex items-center gap-2">
        <span className="hidden text-sm text-muted-foreground sm:inline">Rows per page</span>
        <Select value={String(pagination.pageSize)} onValueChange={(value) => onPageSizeChange(Number(value))}>
          <SelectTrigger className="w-20" aria-label="Rows per page"><SelectValue /></SelectTrigger>
          <SelectContent>{[10, 20, 50].map((size) => <SelectItem key={size} value={String(size)}>{size}</SelectItem>)}</SelectContent>
        </Select>
        <Button variant="outline" disabled={pagination.page <= 1} onClick={() => onPageChange(pagination.page - 1)}>Previous</Button>
        <Button variant="outline" disabled={pagination.page >= pagination.totalPages} onClick={() => onPageChange(pagination.page + 1)}>Next</Button>
      </div>
    </div>
  );
}
