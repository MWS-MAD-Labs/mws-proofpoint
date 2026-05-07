import { useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { AlertCircle, Plus, Trash2, Link, FileText, Upload, Loader2, ExternalLink, Info } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
// ✅ FIX: Import EvidenceItem dari useAssessment — satu sumber kebenaran
//    Sebelumnya EvidenceItem didefinisikan di dua tempat dengan tipe berbeda (notes: string vs notes?: string)
//    yang menyebabkan konflik tipe di seluruh codebase
import type { EvidenceItem } from "@/hooks/useAssessment";

export type { EvidenceItem };

interface EvidenceInputProps {
  score: number | null;
  value: string | EvidenceItem[];
  onChange: (value: EvidenceItem[]) => void;
  disabled?: boolean;
  evidenceGuidance?: string;
}

// Parse legacy string value or return array as-is
function parseEvidenceValue(value: string | EvidenceItem[]): EvidenceItem[] {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return [{ evidence: "", name: "", notes: "", inputMode: "initial" }];
    }
    return value.map(item => ({
      ...item,
      inputMode: item.evidence.trim() ? (item.type === "file" ? "file" : "link") : (item.inputMode ?? "initial")
    }));
  }
  if (typeof value === "string" && value.trim()) {
    return [{ evidence: value, name: "Link", notes: "", type: "link", inputMode: "link" }];
  }
  return [{ evidence: "", name: "", notes: "", inputMode: "initial" }];
}

function isEvidenceRequired(score: number | null): boolean {
  return score !== null && score >= 1;
}

function hasMinimumEvidence(items: EvidenceItem[]): boolean {
  return items.some(item => item.evidence.trim().length > 0);
}

export function EvidenceInput({ score, value, onChange, disabled, evidenceGuidance }: EvidenceInputProps) {
  const { user } = useAuth();
  const items = parseEvidenceValue(value);
  const required = isEvidenceRequired(score);
  const hasEvidence = hasMinimumEvidence(items);
  const showWarning = required && !hasEvidence && score !== null;
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const updateItem = (index: number, field: keyof EvidenceItem, val: string) => {
    const newItems = [...items];
    const current = newItems[index];
    if (!current) return;
    // ✅ FIX: type assertion agar spread + dynamic field tidak konflik tipe
    newItems[index] = { ...current, [field]: val } as EvidenceItem;
    if (field === "evidence" && !newItems[index]!.type) {
      newItems[index]!.type = "link";
    }
    onChange(newItems as EvidenceItem[]);
  };

  const addItem = () => {
    onChange([...items, { evidence: "", name: "", notes: "", inputMode: "initial" }]);
  };

  const setInputMode = (index: number, mode: "initial" | "link" | "file") => {
    const newItems = [...items];
    const current = newItems[index];
    if (!current) return;
    newItems[index] = { ...current, inputMode: mode };
    onChange(newItems as EvidenceItem[]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      const newItems = items.filter((_, i) => i !== index);
      onChange(newItems);
    }
  };

  const handleFileUpload = async (index: number, file: File) => {
    if (!user) {
      toast({ title: "Error", description: "You must be logged in to upload files", variant: "destructive" });
      return;
    }

    setUploadingIndex(index);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json() as { error?: string };
        throw new Error(errorData.error ?? 'Upload failed');
      }

      const result = await response.json() as { url: string; fileName: string };
      const newItems = [...items];
      const current = newItems[index];
      if (!current) return;
      newItems[index] = {
        ...current,
        evidence: result.url,
        type:     "file",
        fileName: result.fileName,
        name:     result.fileName
      };
      onChange(newItems as EvidenceItem[]);
      toast({ title: "Success", description: "File uploaded successfully" });
    } catch (error: unknown) {
      console.error('Upload error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      toast({ title: "Upload failed", description: errorMessage, variant: "destructive" });
    } finally {
      setUploadingIndex(null);
    }
  };

  const triggerFileInput = (index: number) => {
    fileInputRefs.current[index]?.click();
  };

  const isDisabled = disabled || score === null || score === 0;

  return (
    <div className={cn(
      "relative rounded-lg border-2 transition-all duration-300",
      showWarning ? "border-evidence-alert bg-evidence-alert-bg" : "border-border bg-card"
    )}>
      <div className={cn(
        "flex items-center justify-between px-3 py-2 border-b transition-colors duration-300",
        showWarning ? "border-evidence-alert-border" : "border-border"
      )}>
        <div className="flex items-center gap-2">
          {showWarning ? (
            <AlertCircle className="h-4 w-4 text-evidence-alert" />
          ) : (
            <FileText className="h-4 w-4 text-muted-foreground" />
          )}
          <span className={cn(
            "text-sm font-medium",
            showWarning ? "text-evidence-alert" : "text-muted-foreground"
          )}>
            Supporting Evidence
          </span>
        </div>
        <span className={cn(
          "text-xs font-mono px-2 py-0.5 rounded-full",
          required ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
        )}>
          {required ? "Required" : "N/A"}
        </span>
      </div>

      <div className="p-3 space-y-3">
        {score !== null && score !== 0 && (
          <div className="flex items-start gap-2 p-2 bg-muted/50 rounded-md text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <div className="space-y-1">
              {evidenceGuidance && (
                <p className="font-medium text-foreground">{evidenceGuidance}</p>
              )}
              <p>Provide links to documents, reports, or upload files (PDF, Word, Excel, images) that support your score.</p>
            </div>
          </div>
        )}

        {score === 0 ? (
          <p className="text-sm text-muted-foreground italic py-2">
            Evidence not required for score 0 (Critical Failure)
          </p>
        ) : score === null ? (
          <p className="text-sm text-muted-foreground italic py-2 opacity-50">
            Select a score to add evidence
          </p>
        ) : (
          <>
            <div className="grid grid-cols-[30px_1fr_1fr_1fr_30px] gap-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-1 mb-1">
              <span className="text-center">#</span>
              <span>Title / Name</span>
              <span>Evidence (Link or File)</span>
              <span>Additional Notes</span>
              <span></span>
            </div>

            {items.map((item, index) => (
              <div
                key={index}
                className="grid grid-cols-[30px_1fr_1fr_1fr_30px] gap-3 items-start p-2 rounded-lg bg-muted/20 border border-transparent hover:border-border/50 hover:bg-muted/30 transition-all duration-200"
              >
                <span className="flex items-center justify-center h-9 text-xs font-mono text-muted-foreground/60">
                  {index + 1}
                </span>

                <Input
                  value={item.name ?? ""}
                  onChange={(e) => updateItem(index, "name", e.target.value)}
                  placeholder="e.g. Sales Report"
                  disabled={isDisabled}
                  className="h-9 text-sm bg-background/50"
                />

                <div className="space-y-2">
                  {item.type === "file" && item.fileName && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-md text-sm border border-border/50 shadow-sm">
                      <FileText className="h-4 w-4 text-primary shrink-0" />
                      <span className="truncate flex-1 font-medium">{item.name ?? item.fileName}</span>
                      <a href={item.evidence} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80" title="Open file">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>
                  )}

                  {item.type === "link" && item.evidence.trim() && item.inputMode !== "link" && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-md text-sm border border-border/50 shadow-sm">
                      <Link className="h-4 w-4 text-primary shrink-0" />
                      <span className="truncate flex-1 font-medium">{item.name ?? item.evidence}</span>
                      <a href={item.evidence} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80" title="Open link">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>
                  )}

                  {item.inputMode === "initial" && !item.evidence.trim() && (
                    <div className="flex items-center gap-1">
                      <Button type="button" variant="outline" size="sm" onClick={() => setInputMode(index, "link")} disabled={isDisabled} className={cn("h-9 flex-1", showWarning && "border-evidence-alert")}>
                        <Link className="h-4 w-4 mr-1.5" />Link
                      </Button>
                      <span className="text-muted-foreground text-sm px-1">/</span>
                      <Button type="button" variant="outline" size="sm" onClick={() => triggerFileInput(index)} disabled={isDisabled || uploadingIndex === index} className={cn("h-9 flex-1", showWarning && "border-evidence-alert")}>
                        {uploadingIndex === index ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Upload className="h-4 w-4 mr-1.5" />}
                        Upload
                      </Button>
                      <input type="file" ref={(el) => { fileInputRefs.current[index] = el; }} onChange={(e) => { const file = e.target.files?.[0]; if (file) void handleFileUpload(index, file); e.target.value = ''; }} className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.txt" />
                    </div>
                  )}

                  {item.inputMode === "link" && (
                    <div className="flex gap-2">
                      <Input
                        value={item.evidence}
                        onChange={(e) => {
                          const newItems = [...items];
                          const current = newItems[index];
                          if (!current) return;
                          newItems[index] = { ...current, evidence: e.target.value, type: "link", fileName: undefined };
                          onChange(newItems as EvidenceItem[]);
                        }}
                        placeholder="Paste link here..."
                        disabled={isDisabled}
                        autoFocus
                        className={cn("h-9 flex-1", showWarning && !item.evidence.trim() && "border-evidence-alert")}
                      />
                      <Button type="button" variant="ghost" size="sm" onClick={() => setInputMode(index, "initial")} disabled={isDisabled} className="h-9 px-2 text-muted-foreground" title="Back to options">
                        <Upload className="h-4 w-4" />
                      </Button>
                    </div>
                  )}

                  {(item.inputMode === "file" || (item.type === "file" && item.fileName)) && (
                    <div className="flex gap-1">
                      <Button type="button" variant="ghost" size="sm" onClick={() => setInputMode(index, "link")} disabled={isDisabled} className="h-7 text-xs text-muted-foreground"><Link className="h-3 w-3 mr-1" />Use link</Button>
                      <span className="text-muted-foreground text-xs px-0.5 leading-7">/</span>
                      <Button type="button" variant="ghost" size="sm" onClick={() => triggerFileInput(index)} disabled={isDisabled || uploadingIndex === index} className="h-7 text-xs text-muted-foreground">
                        {uploadingIndex === index ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Upload className="h-3 w-3 mr-1" />}Replace file
                      </Button>
                      <input type="file" ref={(el) => { fileInputRefs.current[index] = el; }} onChange={(e) => { const file = e.target.files?.[0]; if (file) void handleFileUpload(index, file); e.target.value = ''; }} className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.txt" />
                    </div>
                  )}

                  {item.inputMode !== "link" && item.type === "link" && item.evidence.trim() && (
                    <div className="flex gap-1">
                      <Button type="button" variant="ghost" size="sm" onClick={() => setInputMode(index, "link")} disabled={isDisabled} className="h-7 text-xs text-muted-foreground"><Link className="h-3 w-3 mr-1" />Edit link</Button>
                      <span className="text-muted-foreground text-xs px-0.5 leading-7">/</span>
                      <Button type="button" variant="ghost" size="sm" onClick={() => triggerFileInput(index)} disabled={isDisabled || uploadingIndex === index} className="h-7 text-xs text-muted-foreground">
                        {uploadingIndex === index ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Upload className="h-3 w-3 mr-1" />}Upload file
                      </Button>
                      <input type="file" ref={(el) => { fileInputRefs.current[index] = el; }} onChange={(e) => { const file = e.target.files?.[0]; if (file) void handleFileUpload(index, file); e.target.value = ''; }} className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.txt" />
                    </div>
                  )}
                </div>

                <Textarea
                  value={item.notes ?? ""}
                  onChange={(e) => updateItem(index, "notes", e.target.value)}
                  placeholder="Short explanation..."
                  disabled={isDisabled}
                  className="min-h-[36px] h-9 resize-none py-2 text-sm bg-background/50"
                  rows={1}
                />
                <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(index)} disabled={isDisabled || items.length <= 1} className="h-9 w-9 text-muted-foreground/50 hover:text-destructive hover:bg-destructive/5 transition-colors">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}

            <Button type="button" variant="outline" size="sm" onClick={addItem} disabled={isDisabled} className="w-full mt-2">
              <Plus className="h-4 w-4 mr-2" />Add Evidence
            </Button>
          </>
        )}
      </div>

      {showWarning && (
        <div className="px-3 py-2 text-xs border-t border-evidence-alert-border text-evidence-alert">
          <span className="font-medium">At least 1 evidence required.</span> Paste a link or upload a file to submit.
        </div>
      )}
    </div>
  );
}