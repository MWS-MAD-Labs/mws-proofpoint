"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Loader2, UserRoundCog } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { fetchObservationManagers, updateObservation } from "../api/queries";
import { observationKeys } from "../api/queryKeys";

export function ObservationReassignmentDialog({
  observationId,
  currentManagerId,
}: {
  observationId: string;
  currentManagerId: string | null;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [chooserOpen, setChooserOpen] = useState(false);
  const [managerId, setManagerId] = useState(currentManagerId ?? "");
  const managers = useQuery({
    queryKey: ["observations", "creation-managers"],
    queryFn: fetchObservationManagers,
    enabled: open,
  });
  const selected = managers.data?.find((manager) => manager.id === managerId) ?? null;
  const reassign = useMutation({
    mutationFn: () => updateObservation(observationId, { managerId }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: observationKeys.detail(observationId) }),
        queryClient.invalidateQueries({ queryKey: observationKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: observationKeys.summary() }),
      ]);
      toast.success("Observation manager reassigned.");
      setOpen(false);
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <UserRoundCog className="h-4 w-4" />
          Reassign manager
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reassign observation manager</DialogTitle>
          <DialogDescription>
            Select an active manager or administrator. The previous and new manager will be notified.
          </DialogDescription>
        </DialogHeader>
        <Popover open={chooserOpen} onOpenChange={setChooserOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" role="combobox" aria-label="Assigned manager" aria-expanded={chooserOpen} className="w-full justify-between font-normal">
              {selected ? selected.fullName || selected.email : "Select manager..."}
              <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
            <Command>
              <CommandInput name="reassignment-manager-search" aria-label="Search managers" placeholder="Search managers..." />
              <CommandList>
                <CommandEmpty>{managers.isLoading ? "Loading managers..." : "No active manager found."}</CommandEmpty>
                <CommandGroup>
                  {(managers.data ?? []).map((manager) => (
                    <CommandItem
                      key={manager.id}
                      value={`${manager.fullName ?? ""} ${manager.email} ${manager.id}`}
                      onSelect={() => {
                        setManagerId(manager.id);
                        setChooserOpen(false);
                      }}
                    >
                      <Check className={cn("mr-2 h-4 w-4", manager.id === managerId ? "opacity-100" : "opacity-0")} />
                      <div>
                        <p>{manager.fullName || manager.email}</p>
                        <p className="text-xs text-muted-foreground">{manager.email}</p>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={reassign.isPending}>Cancel</Button>
          <Button onClick={() => reassign.mutate()} disabled={!managerId || managerId === currentManagerId || reassign.isPending}>
            {reassign.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Reassign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
