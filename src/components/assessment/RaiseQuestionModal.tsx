import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { MessageSquare, Send, Loader2 } from "lucide-react";
import { api } from "@/lib/api-client";
import { toast } from "@/hooks/use-toast";

interface Indicator {
  id: string;
  name: string;
}

interface Section {
  id: string;
  name: string;
  indicators: Indicator[];
}

interface RaiseQuestionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assessmentId: string;
  sections: Section[];
}

export function RaiseQuestionModal({
  open,
  onOpenChange,
  assessmentId,
  sections
}: RaiseQuestionModalProps) {
  const [selectedIndicator, setSelectedIndicator] = useState<string>("");
  const [question, setQuestion] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const allIndicators = sections.flatMap(section =>
    section.indicators.map(indicator => ({
      ...indicator,
      sectionName: section.name
    }))
  );

  const handleSubmit = async () => {
    if (!question.trim()) {
      toast({
        title: "Error",
        description: "Please enter your question or feedback.",
        variant: "destructive"
      });
      return;
    }

    setSubmitting(true);

    try {
      const { error } = await api.createQuestion({
        assessment_id: assessmentId,
        indicator_id: selectedIndicator || undefined,
        question: question.trim(),
      });

      if (error) throw error;

      toast({
        title: "Question Submitted",
        description: "Your question has been sent to your manager for review."
      });

      // Reset and close
      setQuestion("");
      setSelectedIndicator("");
      onOpenChange(false);
    } catch (error: unknown) {
      console.error("Error submitting question:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to submit question. Please try again.";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Raise a Question
          </DialogTitle>
          <DialogDescription>
            Have a question about your assessment or the manager&apos;s review? Submit it here and your manager will respond.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Indicator Selection (Optional) */}
          <div className="space-y-2">
            <Label htmlFor="indicator">Related Indicator (Optional)</Label>
            <Select value={selectedIndicator} onValueChange={setSelectedIndicator}>
              <SelectTrigger id="indicator">
                <SelectValue placeholder="Select an indicator if applicable" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">General Question</SelectItem>
                {allIndicators.map(indicator => (
                  <SelectItem key={indicator.id} value={indicator.id}>
                    <span className="text-muted-foreground">{indicator.sectionName}:</span>{" "}
                    {indicator.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Question Input */}
          <div className="space-y-2">
            <Label htmlFor="question">Your Question or Feedback</Label>
            <Textarea
              id="question"
              placeholder="Describe your question or concern about the assessment review..."
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="min-h-[120px] resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Be specific about what you&apos;d like clarification on.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !question.trim()}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Submit Question
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
