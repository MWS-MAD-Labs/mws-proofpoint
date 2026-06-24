"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { api } from "@/lib/api-client";
import {
  Plus,
  Trash2,
  Save,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Loader2,
  Edit3,
  X,
  Check,
  BookOpen,
  ListChecks,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Indicator {
  id: string;
  name: string;
  description?: string | null;
  evidence_guidance?: string | null;
  question_type?: string | null;
  score_options?: string[] | null;
  sort_order?: number;
}

interface Section {
  id: string;
  name: string;
  weight?: number;
  sort_order?: number;
  indicators?: Indicator[];
}

interface ObservationTemplate {
  id: string;
  name: string;
  description?: string | null;
  template_type?: string;
  sections?: Section[];
}

// ── Component ──────────────────────────────────────────────────────────────────

export function ObservationFormEditor() {
  const [templates, setTemplates] = useState<ObservationTemplate[]>([]);
  const [selected, setSelected] = useState<ObservationTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [deleteTemplateId, setDeleteTemplateId] = useState<string | null>(null);

  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const [editingTemplateInfo, setEditingTemplateInfo] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editingSectionName, setEditingSectionName] = useState("");

  const [editingIndicator, setEditingIndicator] = useState<{
    id: string;
    name: string;
    description: string;
    evidence_guidance: string;
    question_type: string;
    score_options: string[];
    newOption: string;
  } | null>(null);

  const [deleteSectionId, setDeleteSectionId] = useState<string | null>(null);
  const [deleteIndicatorId, setDeleteIndicatorId] = useState<string | null>(null);

  // ── Fetch ──

  const fetchTemplates = async () => {
    setLoading(true);
    const { data, error } = await api.getRubrics("CLASSROOM_OBSERVATION");
    if (error) {
      toast({ title: "Error", description: "Failed to load observation forms", variant: "destructive" });
    } else {
      setTemplates((data as ObservationTemplate[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplate = async (id: string) => {
    const { data, error } = await api.getRubric(id);
    if (!error && data) {
      const raw = data as any;
      const t: ObservationTemplate = {
        ...raw,
        sections: raw.sections ?? raw.data?.sections ?? [],
      };
      setSelected(t);
      setTemplates((prev) => prev.map((x) => (x.id === t.id ? t : x)));
    }
  };

  // ── Create Template ──

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    const { data, error } = await api.createRubric({
      name: newName.trim(),
      description: newDescription.trim() || undefined,
      template_type: "CLASSROOM_OBSERVATION",
      is_global: true,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Error", description: "Failed to create form", variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Observation Form created" });
      setShowNewDialog(false);
      setNewName("");
      setNewDescription("");
      await fetchTemplates();
      await fetchTemplate((data as any).id);
    }
  };

  // ── Delete Template ──

  const handleDeleteTemplate = async () => {
    if (!deleteTemplateId) return;
    const idToDelete = deleteTemplateId;
    const { error } = await api.deleteRubric(idToDelete);
    setDeleteTemplateId(null);
    if (error) {
      toast({ title: "Cannot delete", description: (error as any).message || "Failed to delete form", variant: "destructive" });
    } else {
      toast({ title: "Deleted", description: "Observation Form removed" });
      if (selected?.id === idToDelete) setSelected(null);
      await fetchTemplates();
    }
  };

  // ── Update Template Info ──

  const handleSaveTemplateInfo = async () => {
    if (!selected) return;
    setSaving(true);
    const { error } = await api.updateRubric(selected.id, {
      name: editName.trim(),
      description: editDescription.trim() || null,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Error", description: "Failed to update", variant: "destructive" });
    } else {
      toast({ title: "Saved" });
      setEditingTemplateInfo(false);
      await fetchTemplate(selected.id);
    }
  };

  // ── Section CRUD ──

  const handleAddSection = async () => {
    if (!selected) return;
    const { data, error } = await api.createSection({
      template_id: selected.id,
      name: "New Section",
      weight: 1,
      sort_order: selected.sections?.length || 0,
    });
    if (error) {
      toast({ title: "Error", description: "Failed to add section", variant: "destructive" });
    } else {
      await fetchTemplate(selected.id);
      const newId = (data as any).id;
      setExpandedSections((prev) => new Set([...prev, newId]));
      setEditingSectionId(newId);
      setEditingSectionName("New Section");
    }
  };

  const handleSaveSection = async (sectionId: string) => {
    if (!editingSectionName.trim()) return;
    const { error } = await api.updateSection(sectionId, { name: editingSectionName.trim() });
    if (error) {
      toast({ title: "Error", description: "Failed to update section", variant: "destructive" });
    } else {
      setEditingSectionId(null);
      if (selected) await fetchTemplate(selected.id);
    }
  };

  const handleDeleteSection = async () => {
    if (!deleteSectionId || !selected) return;
    const { error } = await api.deleteSection(deleteSectionId);
    setDeleteSectionId(null);
    if (error) {
      toast({ title: "Error", description: "Failed to delete section", variant: "destructive" });
    } else {
      toast({ title: "Section removed" });
      await fetchTemplate(selected.id);
    }
  };

  // ── Indicator CRUD ──

  const handleAddIndicator = async (sectionId: string) => {
    if (!selected) return;
    const section = selected.sections?.find((s) => s.id === sectionId);
    const { data, error } = await api.createIndicator({
      section_id: sectionId,
      name: "New Indicator",
      description: "",
      evidence_guidance: "",
      question_type: "SCALE",
      sort_order: section?.indicators?.length || 0,
    });
    if (error) {
      toast({ title: "Error", description: "Failed to add indicator", variant: "destructive" });
    } else {
      await fetchTemplate(selected.id);
      const newId = (data as any).id;
      setEditingIndicator({
        id: newId,
        name: "New Indicator",
        description: "",
        evidence_guidance: "",
        question_type: "SCALE",
        score_options: [],
        newOption: "",
      });
    }
  };

  const handleSaveIndicator = async () => {
    if (!editingIndicator || !selected) return;
    const { error } = await api.updateIndicator(editingIndicator.id, {
      name: editingIndicator.name.trim(),
      description: editingIndicator.description.trim() || null,
      evidence_guidance: editingIndicator.evidence_guidance.trim() || null,
      question_type: editingIndicator.question_type || "SCALE",
      score_options: editingIndicator.question_type === "CHOICE" ? editingIndicator.score_options : null,
    });
    if (error) {
      toast({ title: "Error", description: "Failed to update indicator", variant: "destructive" });
    } else {
      setEditingIndicator(null);
      await fetchTemplate(selected.id);
    }
  };

  const handleDeleteIndicator = async () => {
    if (!deleteIndicatorId || !selected) return;
    const { error } = await api.deleteIndicator(deleteIndicatorId);
    setDeleteIndicatorId(null);
    if (error) {
      toast({ title: "Error", description: "Failed to delete indicator", variant: "destructive" });
    } else {
      toast({ title: "Indicator removed" });
      await fetchTemplate(selected.id);
    }
  };

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const questionTypeLabel = (type: string | null | undefined) => {
    switch (type) {
      case "SCALE":  return "Scale";
      case "CHOICE": return "Choice";
      case "TEXT":   return "Text";
      default:       return "Scale";
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight mb-1">Observation Forms</h2>
          <p className="text-muted-foreground text-sm">
            Manage observation form templates with sections and indicators.
          </p>
        </div>
        <Button onClick={() => setShowNewDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Observation Form
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Template List */}
        <div className="lg:col-span-1 space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">
            Forms ({templates.length})
          </h3>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : templates.length === 0 ? (
            <Card className="border-dashed border-border/50">
              <CardContent className="flex flex-col items-center justify-center py-10 text-center gap-3">
                <ClipboardCheck className="h-10 w-10 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">No observation forms yet.</p>
                <Button size="sm" variant="outline" onClick={() => setShowNewDialog(true)}>
                  <Plus className="h-4 w-4 mr-1" /> Create First Form
                </Button>
              </CardContent>
            </Card>
          ) : (
            templates.map((t) => (
              <Card
                key={t.id}
                className={`cursor-pointer transition-all border-border/30 hover:border-primary/50 ${
                  selected?.id === t.id ? "border-primary/70 bg-primary/5" : ""
                }`}
                onClick={() => fetchTemplate(t.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{t.name}</p>
                      {t.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{t.description}</p>
                      )}
                      <Badge variant="secondary" className="mt-2 text-xs">Observation Form</Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={(e) => { e.stopPropagation(); setDeleteTemplateId(t.id); }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Right: Template Editor */}
        <div className="lg:col-span-2">
          {!selected ? (
            <Card className="border-border/30 h-full min-h-[400px]">
              <CardContent className="flex flex-col items-center justify-center h-full py-20 text-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-muted/30 flex items-center justify-center">
                  <ClipboardCheck className="h-8 w-8 text-muted-foreground/50" />
                </div>
                <div>
                  <p className="font-semibold text-muted-foreground">Select a form to edit</p>
                  <p className="text-sm text-muted-foreground/70 mt-1">Or create a new observation form template</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {/* Template Info */}
              <Card className="border-border/30">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-primary" />
                      Form Details
                    </CardTitle>
                    {!editingTemplateInfo && (
                      <Button variant="ghost" size="sm" onClick={() => {
                        setEditName(selected.name);
                        setEditDescription(selected.description || "");
                        setEditingTemplateInfo(true);
                      }}>
                        <Edit3 className="h-3.5 w-3.5 mr-1" /> Edit
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {editingTemplateInfo ? (
                    <div className="space-y-3">
                      <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Form name" />
                      <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} placeholder="Description (optional)" rows={2} />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleSaveTemplateInfo} disabled={saving}>
                          {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
                          Save
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingTemplateInfo(false)}>
                          <X className="h-3 w-3 mr-1" /> Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p className="font-semibold">{selected.name}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {selected.description || <span className="italic">No description</span>}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Sections */}
              <Card className="border-border/30">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <ListChecks className="h-4 w-4 text-primary" />
                      Sections & Indicators
                    </CardTitle>
                    <Button size="sm" variant="outline" onClick={handleAddSection}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> Add Section
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {!selected.sections || selected.sections.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <p className="text-sm">No sections yet.</p>
                      <Button size="sm" variant="outline" className="mt-3" onClick={handleAddSection}>
                        <Plus className="h-3.5 w-3.5 mr-1" /> Add First Section
                      </Button>
                    </div>
                  ) : (
                    selected.sections.map((section) => (
                      <div key={section.id} className="border border-border/40 rounded-lg overflow-hidden">
                        {/* Section Header */}
                        <div
                          className="flex items-center gap-2 p-3 bg-muted/20 cursor-pointer hover:bg-muted/30 transition-colors"
                          onClick={() => toggleSection(section.id)}
                        >
                          <button className="text-muted-foreground" type="button">
                            {expandedSections.has(section.id)
                              ? <ChevronDown className="h-4 w-4" />
                              : <ChevronRight className="h-4 w-4" />}
                          </button>

                          {editingSectionId === section.id ? (
                            <div className="flex-1 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                              <Input
                                value={editingSectionName}
                                onChange={(e) => setEditingSectionName(e.target.value)}
                                className="h-7 text-sm flex-1"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleSaveSection(section.id);
                                  if (e.key === "Escape") setEditingSectionId(null);
                                }}
                              />
                              <Button size="icon" className="h-7 w-7" type="button" onClick={() => handleSaveSection(section.id)}>
                                <Check className="h-3 w-3" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7" type="button" onClick={() => setEditingSectionId(null)}>
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <>
                              <span className="font-medium text-sm flex-1">{section.name}</span>
                              <Badge variant="outline" className="text-xs">
                                {section.indicators?.length || 0} indicator{section.indicators?.length !== 1 ? "s" : ""}
                              </Badge>
                              <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                                <Button
                                  variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" type="button"
                                  onClick={() => {
                                    setEditingSectionId(section.id);
                                    setEditingSectionName(section.name);
                                    setExpandedSections((p) => new Set([...p, section.id]));
                                  }}
                                >
                                  <Edit3 className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" type="button"
                                  onClick={() => setDeleteSectionId(section.id)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </>
                          )}
                        </div>

                        {/* Indicators */}
                        {expandedSections.has(section.id) && (
                          <div className="p-3 space-y-2 bg-background/40">
                            {section.indicators?.map((indicator) => (
                              <div key={indicator.id}>
                                {editingIndicator?.id === indicator.id ? (
                                  <div className="space-y-2 border border-primary/30 rounded-md p-3 bg-primary/5">
                                    <Input
                                      value={editingIndicator.name}
                                      onChange={(e) => setEditingIndicator((p) => p ? { ...p, name: e.target.value } : null)}
                                      placeholder="Indicator name"
                                      className="h-8 text-sm"
                                      autoFocus
                                    />
                                    <Textarea
                                      value={editingIndicator.description}
                                      onChange={(e) => setEditingIndicator((p) => p ? { ...p, description: e.target.value } : null)}
                                      placeholder="Description (optional)"
                                      rows={2}
                                      className="text-sm"
                                    />
                                    <div>
                                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Question Type</label>
                                      <select
                                        value={editingIndicator.question_type || "SCALE"}
                                        onChange={(e) => setEditingIndicator((p) => p ? { ...p, question_type: e.target.value } : null)}
                                        className="w-full text-sm border border-border rounded-md px-2 py-1.5 bg-background"
                                      >
                                        <option value="SCALE">Scale (numeric, e.g. 1–100)</option>
                                        <option value="CHOICE">Choice (single select from options)</option>
                                        <option value="TEXT">Text (free text / narrative)</option>
                                      </select>
                                    </div>
                                    {editingIndicator.question_type === "CHOICE" && (
                                      <div>
                                        <label className="text-xs font-medium text-muted-foreground mb-1 block">Choice Options</label>
                                        <div className="space-y-1 mb-2">
                                          {editingIndicator.score_options.map((opt, idx) => (
                                            <div key={idx} className="flex items-center gap-2">
                                              <span className="text-sm flex-1 px-2 py-1 bg-muted/30 rounded">{opt}</span>
                                              <Button
                                                size="icon" variant="ghost" type="button"
                                                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                                onClick={() => setEditingIndicator((p) => p ? { ...p, score_options: p.score_options.filter((_, i) => i !== idx) } : null)}
                                              >
                                                <X className="h-3 w-3" />
                                              </Button>
                                            </div>
                                          ))}
                                        </div>
                                        <div className="flex gap-2">
                                          <Input
                                            value={editingIndicator.newOption}
                                            onChange={(e) => setEditingIndicator((p) => p ? { ...p, newOption: e.target.value } : null)}
                                            placeholder="Add option..."
                                            className="h-7 text-sm"
                                            onKeyDown={(e) => {
                                              if (e.key === "Enter" && editingIndicator.newOption.trim()) {
                                                setEditingIndicator((p) => p ? { ...p, score_options: [...p.score_options, p.newOption.trim()], newOption: "" } : null);
                                              }
                                            }}
                                          />
                                          <Button size="sm" variant="outline" type="button"
                                            onClick={() => {
                                              if (editingIndicator.newOption.trim()) {
                                                setEditingIndicator((p) => p ? { ...p, score_options: [...p.score_options, p.newOption.trim()], newOption: "" } : null);
                                              }
                                            }}
                                          >
                                            <Plus className="h-3 w-3" />
                                          </Button>
                                        </div>
                                      </div>
                                    )}
                                    <div className="flex gap-2">
                                      <Button size="sm" type="button" onClick={handleSaveIndicator}>
                                        <Save className="h-3 w-3 mr-1" /> Save
                                      </Button>
                                      <Button size="sm" variant="outline" type="button" onClick={() => setEditingIndicator(null)}>
                                        <X className="h-3 w-3 mr-1" /> Cancel
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-start gap-2 group p-2 rounded-md hover:bg-muted/30 transition-colors">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <p className="text-sm font-medium">{indicator.name}</p>
                                        <Badge variant="outline" className="text-xs py-0">
                                          {questionTypeLabel(indicator.question_type)}
                                        </Badge>
                                      </div>
                                      {indicator.description && (
                                        <p className="text-xs text-muted-foreground mt-0.5">{indicator.description}</p>
                                      )}
                                    </div>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                      <Button
                                        variant="ghost" size="icon" type="button"
                                        className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                        onClick={() => setEditingIndicator({
                                          id: indicator.id,
                                          name: indicator.name,
                                          description: indicator.description || "",
                                          evidence_guidance: indicator.evidence_guidance || "",
                                          question_type: indicator.question_type || "SCALE",
                                          score_options: (indicator as any).score_options ?? [],
                                          newOption: "",
                                        })}
                                      >
                                        <Edit3 className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        variant="ghost" size="icon" type="button"
                                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                        onClick={() => setDeleteIndicatorId(indicator.id)}
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                            <Button
                              variant="ghost" size="sm" type="button"
                              className="w-full mt-1 text-muted-foreground hover:text-foreground border border-dashed border-border/50"
                              onClick={() => handleAddIndicator(section.id)}
                            >
                              <Plus className="h-3 w-3 mr-1" /> Add Indicator
                            </Button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* Create Form Dialog */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Observation Form</DialogTitle>
            <DialogDescription>
              Create a new observation form template. You can add sections and indicators after creating it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Form Name *</label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Classroom Observation Form"
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                autoFocus
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Description</label>
              <Textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Optional description..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDialog(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!newName.trim() || saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Create Form
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Template */}
      <AlertDialog open={!!deleteTemplateId} onOpenChange={(v) => !v && setDeleteTemplateId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Observation Form?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the form and all its sections and indicators. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTemplate} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Section */}
      <AlertDialog open={!!deleteSectionId} onOpenChange={(v) => !v && setDeleteSectionId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Section?</AlertDialogTitle>
            <AlertDialogDescription>This will remove the section and all its indicators.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSection} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Indicator */}
      <AlertDialog open={!!deleteIndicatorId} onOpenChange={(v) => !v && setDeleteIndicatorId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Indicator?</AlertDialogTitle>
            <AlertDialogDescription>This indicator will be permanently removed from this section.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteIndicator} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}