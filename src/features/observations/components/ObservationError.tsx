import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function ObservationError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Observations could not be loaded</AlertTitle>
      <AlertDescription className="mt-2 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span>{message}</span>
        <Button variant="outline" size="sm" onClick={onRetry}>Retry</Button>
      </AlertDescription>
    </Alert>
  );
}
