import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, X, Loader2, Printer } from "lucide-react";
import { getGradeFromScore } from "@/hooks/useAssessment";

interface AppraisalData {
  staffName: string;
  managerName: string;
  directorName: string;
  department: string;
  period: string;
  sections: {
    name: string;
    weight: number;
    indicators: {
      name: string;
      score: number | null;
    }[];
  }[];
  totalScore: number;
  grade: string;
}

interface PrintPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: AppraisalData | null;
  onPrint: () => void;
}

export function PrintPreviewModal({ open, onOpenChange, data, onPrint }: PrintPreviewModalProps) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open) {
      setLoading(true);
      const timer = setTimeout(() => setLoading(false), 500);
      return () => clearTimeout(timer);
    }
  }, [open]);

  if (!data) return null;

  const getGradeColor = (grade: string): string => {
    if (grade.startsWith('A')) return 'bg-emerald-500';
    if (grade.startsWith('B')) return 'bg-blue-500';
    if (grade.startsWith('C')) return 'bg-amber-500';
    if (grade.startsWith('D')) return 'bg-orange-500';
    return 'bg-destructive';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Printer className="h-5 w-5 text-primary" />
            Print Preview
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-auto p-6 bg-muted/30">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
              <div className="relative">
                <div className="absolute inset-0 bg-primary rounded-full blur-xl opacity-30 animate-pulse" />
                <Loader2 className="relative h-10 w-10 animate-spin text-primary" />
              </div>
              <p className="text-muted-foreground">Generating preview...</p>
            </div>
          ) : (
            <div className="bg-background rounded-xl shadow-lg border overflow-hidden max-w-2xl mx-auto">
              {/* Header */}
              <div className="text-center py-4 px-6 border-b">
                <h1 className="text-xl font-bold tracking-tight">Performance Appraisal Report</h1>
                <h2 className="text-primary font-medium underline mt-1">Millennia World School</h2>
                <p className="text-muted-foreground text-sm mt-1">{data.period}</p>
              </div>
              
              {/* Staff Info */}
              <div className="grid grid-cols-3 gap-4 p-4 bg-primary/5 border-b">
                <div>
                  <p className="text-xs font-semibold text-primary uppercase tracking-wide">Staff Name</p>
                  <p className="font-medium">{data.staffName}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-primary uppercase tracking-wide">Manager</p>
                  <p className="font-medium">{data.managerName}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-primary uppercase tracking-wide">Department</p>
                  <p className="font-medium">{data.department || 'N/A'}</p>
                </div>
              </div>
              
              {/* Sections */}
              <div className="p-4 space-y-3">
                {data.sections.map((section, idx) => (
                  <div key={idx} className="border rounded-lg overflow-hidden">
                    <div className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground px-3 py-2 flex justify-between items-center">
                      <span className="font-semibold text-sm">{idx + 1}. {section.name}</span>
                      <span className="text-xs bg-primary-foreground/20 px-2 py-0.5 rounded-full">{section.weight}%</span>
                    </div>
                    <div className="divide-y">
                      {section.indicators.map((ind, i) => (
                        <div key={i} className="flex justify-between items-center px-3 py-2 text-sm">
                          <span className="text-muted-foreground">{ind.name}</span>
                          <span className="font-bold text-primary">{ind.score ?? '—'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Total Score */}
              <div className="mx-4 mb-4 p-4 bg-primary/5 border-2 border-primary rounded-xl flex justify-center items-center gap-8">
                <div className="text-center">
                  <p className="text-xs font-semibold text-primary uppercase tracking-wide">Total Score</p>
                  <p className="text-3xl font-bold">{data.totalScore.toFixed(2)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs font-semibold text-primary uppercase tracking-wide">Final Grade</p>
                  <span className={`inline-block text-2xl font-bold text-white px-4 py-1 rounded-lg mt-1 ${getGradeColor(data.grade)}`}>
                    {data.grade}
                  </span>
                </div>
              </div>
              
              {/* Signatures */}
              <div className="px-4 pb-4">
                <div className="flex justify-around gap-4">
                  <div className="text-center">
                    <div className="border-t-2 border-primary w-32 pt-2 mt-8">
                      <p className="font-semibold text-sm">{data.managerName}</p>
                      <p className="text-xs text-muted-foreground">Appraised by — Manager</p>
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="border-t-2 border-primary w-32 pt-2 mt-8">
                      <p className="font-semibold text-sm">{data.directorName}</p>
                      <p className="text-xs text-muted-foreground">Approved by — Director</p>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Footer */}
              <div className="text-center py-3 border-t text-xs text-muted-foreground">
                Generated on {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} • 
                <span className="text-primary font-semibold ml-1">ProofPoint</span> Performance Management System
              </div>
            </div>
          )}
        </div>
        
        <div className="px-6 py-4 border-t bg-background flex justify-end gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4 mr-2" />
            Close
          </Button>
          <Button onClick={onPrint} disabled={loading}>
            <Download className="h-4 w-4 mr-2" />
            Print / Save as PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
