"use client";

import { useState, Suspense, useMemo } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Header } from "@/components/layout/Header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useRubricTemplates } from "@/hooks/useAssessment";
import { api } from "@/lib/api-client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import {
  FileText,
  Loader2,
  Plus,
  Layout,
  ChevronRight,
  ChevronDown,
  Info,
  Target,
  Edit3,
  Trash2,
  Save,
  X,
  BookOpen,
  Award,
  ChevronUp,
  Import,
  Scale,
  Percent,
  Search,
  Check,
  ChevronsUpDown,
  ExpandIcon,
  ShrinkIcon,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";

// Type definitions
interface KPI {
  id: string;
  name: string;
  description: string | null;
  evidence_guidance: string | null;
  trainings: string | null;
  sort_order: number;
  rubric_4: string;
  rubric_3: string;
  rubric_2: string;
  rubric_1: string;
}

interface Standard {
  id: string;
  domain_id: string;
  name: string;
  sort_order: number;
  kpis: KPI[];
}

interface Domain {
  id: string;
  template_id: string;
  name: string;
  weight: number;
  sort_order: number;
  standards: Standard[];
}

interface Template {
  id: string;
  name: string;
  description: string | null;
  domains: Domain[];
}

// ============================================================================
// TEMPLATE SELECTOR DIALOG COMPONENT (Centered Modal)
// ============================================================================
function TemplateSelectorDialog({
  open,
  onOpenChange,
  templates,
  selectedTemplate,
  onSelectTemplate,
  isEditMode,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: Template[];
  selectedTemplate: Template | null;
  onSelectTemplate: (template: Template) => void;
  isEditMode: boolean;
}) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredTemplates = useMemo(() => {
    if (!searchQuery.trim()) return templates;
    const query = searchQuery.toLowerCase();
    return templates.filter(
      (t: Template) =>
        t.name.toLowerCase().includes(query) ||
        (t.description?.toLowerCase() || "").includes(query),
    );
  }, [templates, searchQuery]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="p-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <Layout className="h-5 w-5 text-primary" />
            Select KPI Template
          </DialogTitle>
          <DialogDescription>
            Choose a template to view or edit its KPI framework.
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="px-6 py-4 border-b bg-muted/30">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-background"
            />
          </div>
        </div>

        {/* Template List (Single Column) */}
        <ScrollArea className="flex-1 p-6">
          <div className="grid grid-cols-1 gap-3">
            {filteredTemplates.map((template: Template) => (
              <Card
                key={template.id}
                onClick={() => {
                  if (!isEditMode) {
                    onSelectTemplate(template);
                    onOpenChange(false);
                  }
                }}
                className={`cursor-pointer transition-all duration-200 ${
                  selectedTemplate?.id === template.id
                    ? "border-primary ring-2 ring-primary/20 bg-primary/5"
                    : isEditMode
                      ? "opacity-50 cursor-not-allowed"
                      : "hover:border-primary/50 hover:shadow-lg hover:-translate-y-0.5"
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors flex-shrink-0 ${
                        selectedTemplate?.id === template.id
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <FileText className="h-6 w-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-bold text-foreground line-clamp-1">
                          {template.name}
                        </h4>
                        {selectedTemplate?.id === template.id && (
                          <Check className="h-5 w-5 text-primary flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                        {template.description || "No description"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredTemplates.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Search className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>No templates found matching "{searchQuery}"</p>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// IMPORT DOMAIN DIALOG COMPONENT
// ============================================================================
function ImportDomainDialog({
  open,
  onOpenChange,
  templates,
  currentTemplateId,
  onImport,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: Template[];
  currentTemplateId: string;
  onImport: (domains: Template[]) => void;
}) {
  const [selectedSourceTemplate, setSelectedSourceTemplate] =
    useState<any>(null);
  const [selectedDomains, setSelectedDomains] = useState<Set<string>>(
    new Set(),
  );
  const [isLoading, setIsLoading] = useState(false);
  const [sourceTemplateData, setSourceTemplateData] = useState<any>(null);

  const otherTemplates = templates.filter((t) => t.id !== currentTemplateId);

  const handleSelectSourceTemplate = async (template: Template) => {
    setSelectedSourceTemplate(template);
    setSelectedDomains(new Set());
    setIsLoading(true);

    const { data, error } = await api.getRubric(template.id);
    if (!error && data) {
      setSourceTemplateData(data);
    }
    setIsLoading(false);
  };

  const toggleDomain = (domainId: string) => {
    setSelectedDomains((prev) => {
      const next = new Set(prev);
      if (next.has(domainId)) {
        next.delete(domainId);
      } else {
        next.add(domainId);
      }
      return next;
    });
  };

  const handleImport = async () => {
    if (!sourceTemplateData || selectedDomains.size === 0) return;

    const domainsToImport = sourceTemplateData.domains.filter((d: Domain) =>
      selectedDomains.has(d.id),
    );
    onImport(domainsToImport);
    onOpenChange(false);
    setSelectedSourceTemplate(null);
    setSelectedDomains(new Set());
    setSourceTemplateData(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Import className="h-5 w-5 text-primary" />
            Import Domains from Another Template
          </DialogTitle>
          <DialogDescription>
            Select a source template and choose which domains to import.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden grid grid-cols-2 gap-4">
          {/* Source Template Selection */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Source Template
            </h4>
            <ScrollArea className="h-[300px] border rounded-lg p-2">
              {otherTemplates.map((template: Template) => (
                <div
                  key={template.id}
                  onClick={() => handleSelectSourceTemplate(template)}
                  className={`p-3 rounded-lg cursor-pointer transition-colors mb-2 ${
                    selectedSourceTemplate?.id === template.id
                      ? "bg-primary/10 border border-primary"
                      : "hover:bg-muted border border-transparent"
                  }`}
                >
                  <h5 className="font-medium text-sm">{template.name}</h5>
                  <p className="text-xs text-muted-foreground truncate mt-1">
                    {template.description || "No description"}
                  </p>
                </div>
              ))}
            </ScrollArea>
          </div>

          {/* Domain Selection */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Select Domains
            </h4>
            <ScrollArea className="h-[300px] border rounded-lg p-2">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : sourceTemplateData ? (
                (sourceTemplateData.domains || []).map((domain: Domain) => (
                  <div
                    key={domain.id}
                    className={`p-3 rounded-lg cursor-pointer transition-colors mb-2 flex items-start gap-3 ${
                      selectedDomains.has(domain.id)
                        ? "bg-primary/10 border border-primary"
                        : "hover:bg-muted border border-transparent"
                    }`}
                    onClick={() => toggleDomain(domain.id)}
                  >
                    <Checkbox
                      checked={selectedDomains.has(domain.id)}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <h5 className="font-medium text-sm">{domain.name}</h5>
                      <p className="text-xs text-muted-foreground mt-1">
                        {domain.standards?.length || 0} standards
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <Import className="h-8 w-8 mb-2 opacity-30" />
                  <p className="text-sm">Select a template to view domains</p>
                </div>
              )}
            </ScrollArea>
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={selectedDomains.size === 0}>
            <Import className="h-4 w-4 mr-2" />
            Import {selectedDomains.size} Domain
            {selectedDomains.size !== 1 ? "s" : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// DOMAIN WEIGHT EDITOR COMPONENT
// ============================================================================
function DomainWeightEditor({
  domains,
  onUpdateWeight,
  onAutoBalance,
}: {
  domains: Template[];
  onUpdateWeight: (domainId: string, weight: number) => void;
  onAutoBalance: () => void;
}) {
  const totalWeight = domains.reduce(
    (acc, d) => acc + (parseFloat(d.weight) || 0),
    0,
  );
  const isBalanced = Math.abs(totalWeight - 100) < 0.1;

  return (
    <div className="p-4 rounded-xl border bg-muted/30 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Scale className="h-4 w-4 text-primary" />
          <h4 className="font-semibold text-sm">Domain Weights</h4>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant={isBalanced ? "default" : "destructive"}
            className="text-xs"
          >
            Total: {totalWeight.toFixed(1)}%
          </Badge>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" onClick={onAutoBalance}>
                  <Percent className="h-3.5 w-3.5 mr-1.5" />
                  Auto Balance
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Distribute weights equally across all domains</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {!isBalanced && (
        <div className="p-2 rounded-lg bg-destructive/10 text-destructive text-xs flex items-center gap-2">
          <Info className="h-3.5 w-3.5" />
          Weights should sum to 100%. Current total: {totalWeight.toFixed(1)}%
        </div>
      )}

      <div className="space-y-3">
        {domains.map((domain: any, idx: number) => (
          <div key={domain.id} className="flex items-center gap-3">
            <Badge variant="secondary" className="font-mono w-8 justify-center">
              D{idx + 1}
            </Badge>
            <span className="text-sm flex-1 min-w-0 truncate">
              {domain.name}
            </span>
            <div className="flex items-center gap-2 w-32">
              <Slider
                value={[parseFloat(domain.weight) || 0]}
                onValueChange={([value]) => onUpdateWeight(domain.id, value)}
                max={100}
                step={0.5}
                className="flex-1"
              />
              <span className="text-xs font-mono w-12 text-right">
                {(parseFloat(domain.weight) || 0).toFixed(1)}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN RUBRICS CONTENT COMPONENT
// ============================================================================
function RubricsContent() {
  const { templates, loading, refreshTemplates } = useRubricTemplates() as any;
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editData, setEditData] = useState<any>(null);
  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(
    new Set(),
  );
  const [expandedStandards, setExpandedStandards] = useState<Set<string>>(
    new Set(),
  );
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // UI State
  const [templateSelectorOpen, setTemplateSelectorOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  const handleSelectTemplate = async (template: Template) => {
    if (selectedTemplate?.id === template.id) return;

    setIsEditMode(false);
    setExpandedDomains(new Set());
    setExpandedStandards(new Set());

    if (!template.domains) {
      setIsDetailLoading(true);
      setSelectedTemplate(template);
      const { data, error } = await api.getRubric(template.id);
      if (!error && data) {
        setSelectedTemplate(data);
        const allDomainIds = ((data as any).domains || []).map(
          (d: Domain) => d.id,
        );
        setExpandedDomains(new Set(allDomainIds));
      }
      setIsDetailLoading(false);
    } else {
      setSelectedTemplate(template);
      const allDomainIds = (template.domains || []).map((d: Domain) => d.id);
      setExpandedDomains(new Set(allDomainIds));
    }
  };

  const handleEditToggle = () => {
    if (!isEditMode) {
      setEditData(JSON.parse(JSON.stringify(selectedTemplate)));
    }
    setIsEditMode(!isEditMode);
  };

  const handleSaveTemplate = async () => {
    setIsDetailLoading(true);

    try {
      // 1. Update template metadata
      if (
        editData.name !== selectedTemplate.name ||
        editData.description !== selectedTemplate.description
      ) {
        const { error: templateError } = await api.updateRubric(editData.id, {
          name: editData.name,
          description: editData.description,
        });
        if (templateError) throw new Error("Failed to update rubric metadata");
      }

      // 2. Deep sync domains, standards, and KPIs
      for (const domain of editData.domains || []) {
        const originalDomain = selectedTemplate.domains?.find(
          (d: Domain) => d.id === domain.id,
        );

        // Sync domain if name or weight changed
        if (
          !originalDomain ||
          domain.name !== originalDomain.name ||
          domain.weight !== originalDomain.weight
        ) {
          const { error } = await api.updateDomain(domain.id, {
            name: domain.name,
            weight: domain.weight,
          });
          if (error) console.error(`Failed to sync domain ${domain.id}`);
        }

        // Sync standards within domain
        for (const standard of domain.standards || []) {
          const originalStandard = originalDomain?.standards?.find(
            (s: any) => s.id === standard.id,
          );

          if (!originalStandard || standard.name !== originalStandard.name) {
            const { error } = await api.updateStandard(standard.id, {
              name: standard.name,
            });
            if (error) console.error(`Failed to sync standard ${standard.id}`);
          }

          // Sync KPIs within standard
          for (const kpi of standard.kpis || []) {
            const originalKPI = originalStandard?.kpis?.find(
              (k: any) => k.id === kpi.id,
            );

            // Compare all KPI fields
            const hasChanged =
              !originalKPI ||
              kpi.name !== originalKPI.name ||
              kpi.description !== originalKPI.description ||
              kpi.evidence_guidance !== originalKPI.evidence_guidance ||
              kpi.trainings !== originalKPI.trainings ||
              kpi.rubric_4 !== originalKPI.rubric_4 ||
              kpi.rubric_3 !== originalKPI.rubric_3 ||
              kpi.rubric_2 !== originalKPI.rubric_2 ||
              kpi.rubric_1 !== originalKPI.rubric_1;

            if (hasChanged) {
              const { error } = await api.updateKPI(kpi.id, {
                name: kpi.name,
                description: kpi.description,
                evidence_guidance: kpi.evidence_guidance,
                trainings: kpi.trainings,
                rubric_4: kpi.rubric_4,
                rubric_3: kpi.rubric_3,
                rubric_2: kpi.rubric_2,
                rubric_1: kpi.rubric_1,
              });
              if (error) console.error(`Failed to sync KPI ${kpi.id}`);
            }
          }
        }
      }

      toast({ title: "Success", description: "Rubric updated successfully" });
      setSelectedTemplate(editData);
      setIsEditMode(false);
      if (refreshTemplates) refreshTemplates();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to save changes",
        variant: "destructive",
      });
    } finally {
      setIsDetailLoading(false);
    }
  };

  const handleDeleteRubric = async () => {
    if (!selectedTemplate) return;

    setIsDetailLoading(true);
    const { error } = await api.deleteRubric(selectedTemplate.id);

    if (error) {
      toast({
        title: "Error",
        description:
          "Failed to delete rubric. It might be in use by existing assessments.",
        variant: "destructive",
      });
    } else {
      toast({ title: "Success", description: "Rubric deleted successfully" });
      setSelectedTemplate(null);
      setIsEditMode(false);
      if (refreshTemplates) refreshTemplates();
    }
    setIsDetailLoading(false);
    setDeleteConfirmOpen(false);
  };

  const toggleDomain = (domainId: string) => {
    setExpandedDomains((prev) => {
      const next = new Set(prev);
      if (next.has(domainId)) {
        next.delete(domainId);
      } else {
        next.add(domainId);
      }
      return next;
    });
  };

  const toggleStandard = (standardId: string) => {
    setExpandedStandards((prev) => {
      const next = new Set(prev);
      if (next.has(standardId)) {
        next.delete(standardId);
      } else {
        next.add(standardId);
      }
      return next;
    });
  };

  const expandAll = () => {
    const currentData = isEditMode ? editData : selectedTemplate;
    const allDomainIds = (currentData?.domains || []).map((d: Domain) => d.id);
    const allStandardIds = (currentData?.domains || []).flatMap((d: Domain) =>
      (d.standards || []).map((s: any) => s.id),
    );
    setExpandedDomains(new Set(allDomainIds));
    setExpandedStandards(new Set(allStandardIds));
  };

  const collapseAll = () => {
    setExpandedDomains(new Set());
    setExpandedStandards(new Set());
  };

  // Domain CRUD handlers
  const handleAddDomain = async () => {
    const { data, error } = await api.createDomain({
      template_id: selectedTemplate.id,
      name: "New Domain",
      sort_order: editData.domains?.length || 0,
    });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to add domain",
        variant: "destructive",
      });
    } else {
      setEditData((prev: any) => ({
        ...prev,
        domains: [
          ...(prev.domains || []),
          { ...(data as Record<string, unknown>), standards: [], weight: 0 },
        ],
      }));
      setExpandedDomains((prev) => new Set([...prev, (data as any).id]));
    }
  };

  const handleUpdateDomain = (domainId: string, updates: any) => {
    setEditData((prev: any) => ({
      ...prev,
      domains: prev.domains.map((d: Domain) =>
        d.id === domainId ? { ...d, ...updates } : d,
      ),
    }));
  };

  const handleDeleteDomain = async (domainId: string) => {
    if (
      !confirm(
        "Are you sure you want to delete this domain and all its standards and KPIs?",
      )
    )
      return;

    const { error } = await api.deleteDomain(domainId);
    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete domain",
        variant: "destructive",
      });
    } else {
      setEditData((prev: any) => ({
        ...prev,
        domains: prev.domains.filter((d: Domain) => d.id !== domainId),
      }));
    }
  };

  const handleAutoBalanceWeights = () => {
    const domainCount = editData.domains?.length || 0;
    if (domainCount === 0) return;

    const equalWeight = parseFloat((100 / domainCount).toFixed(2));

    setEditData((prev: any) => ({
      ...prev,
      domains: prev.domains.map((d: Domain) => ({ ...d, weight: equalWeight })),
    }));
  };

  const handleImportDomains = async (domainsToImport: Template[]) => {
    // For each domain, create it with its standards and KPIs
    for (const domain of domainsToImport) {
      // Create domain
      const { data: newDomain, error: domainError } = await api.createDomain({
        template_id: selectedTemplate.id,
        name: domain.name,
        sort_order: editData.domains?.length || 0,
      });

      if (domainError) {
        toast({
          title: "Error",
          description: `Failed to import domain: ${domain.name}`,
          variant: "destructive",
        });
        continue;
      }

      // Create standards
      for (const standard of domain.standards || []) {
        const { data: newStandard, error: standardError } =
          await api.createStandard({
            domain_id: (newDomain as any).id,
            name: standard.name,
            sort_order: standard.sort_order || 0,
          });

        if (standardError) continue;

        // Create KPIs
        for (const kpi of standard.kpis || []) {
          await api.createKPI({
            standard_id: (newStandard as any).id,
            name: kpi.name,
            description: kpi.description || "",
            evidence_guidance: kpi.evidence_guidance || "",
            trainings: kpi.trainings || "",
            sort_order: kpi.sort_order || 0,
            rubric_4: kpi.rubric_4 || "",
            rubric_3: kpi.rubric_3 || "",
            rubric_2: kpi.rubric_2 || "",
            rubric_1: kpi.rubric_1 || "",
          });
        }
      }
    }

    // Refresh the template data
    const { data } = await api.getRubric(selectedTemplate.id);
    if (data) {
      setEditData(data);
      setSelectedTemplate(data);
    }

    toast({
      title: "Success",
      description: `Imported ${domainsToImport.length} domain(s)`,
    });
  };

  const handleCreateTemplate = async () => {
    const { data, error } = await api.createRubric({
      name: "New KPI Template",
      description: "",
      is_global: false,
    });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to create template",
        variant: "destructive",
      });
    } else {
      toast({ title: "Success", description: "Template created successfully" });
      if (refreshTemplates) refreshTemplates();
      // Select the newly created template
      await handleSelectTemplate(data);
    }
  };

  // Standard CRUD handlers
  const handleAddStandard = async (domainId: string) => {
    const domain = editData.domains.find((d: Domain) => d.id === domainId);
    const { data, error } = await api.createStandard({
      domain_id: domainId,
      name: "New Standard",
      sort_order: domain.standards?.length || 0,
    });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to add standard",
        variant: "destructive",
      });
    } else {
      setEditData((prev: any) => ({
        ...prev,
        domains: prev.domains.map((d: Domain) =>
          d.id === domainId
            ? {
                ...d,
                standards: [
                  ...(d.standards || []),
                  { ...(data as Record<string, unknown>), kpis: [] },
                ],
              }
            : d,
        ),
      }));
      setExpandedStandards((prev) => new Set([...prev, (data as any).id]));
    }
  };

  const handleUpdateStandard = (standardId: string, updates: any) => {
    setEditData((prev: any) => ({
      ...prev,
      domains: prev.domains.map((d: Domain) => ({
        ...d,
        standards: d.standards.map((s: any) =>
          s.id === standardId ? { ...s, ...updates } : s,
        ),
      })),
    }));
  };

  const handleDeleteStandard = async (standardId: string, domainId: string) => {
    if (
      !confirm(
        "Are you sure you want to delete this standard and all its KPIs?",
      )
    )
      return;

    const { error } = await api.deleteStandard(standardId);
    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete standard",
        variant: "destructive",
      });
    } else {
      setEditData((prev: any) => ({
        ...prev,
        domains: prev.domains.map((d: Domain) =>
          d.id === domainId
            ? {
                ...d,
                standards: d.standards.filter((s: any) => s.id !== standardId),
              }
            : d,
        ),
      }));
    }
  };

  // KPI CRUD handlers
  const handleAddKPI = async (standardId: string) => {
    let standard: any = null;
    editData.domains.forEach((d: Domain) => {
      const found = d.standards.find((s: any) => s.id === standardId);
      if (found) standard = found;
    });

    const { data, error } = await api.createKPI({
      standard_id: standardId,
      name: "New KPI",
      description: "",
      evidence_guidance: "",
      trainings: "",
      sort_order: standard?.kpis?.length || 0,
      rubric_4: "≥95%",
      rubric_3: "80-94%",
      rubric_2: "60-79%",
      rubric_1: "<60%",
    });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to add KPI",
        variant: "destructive",
      });
    } else {
      setEditData((prev: any) => ({
        ...prev,
        domains: prev.domains.map((d: Domain) => ({
          ...d,
          standards: d.standards.map((s: any) =>
            s.id === standardId
              ? {
                  ...s,
                  kpis: [...(s.kpis || []), data],
                }
              : s,
          ),
        })),
      }));
    }
  };

  const handleUpdateKPI = (kpiId: string, updates: any) => {
    setEditData((prev: any) => ({
      ...prev,
      domains: prev.domains.map((d: Domain) => ({
        ...d,
        standards: d.standards.map((s: any) => ({
          ...s,
          kpis: s.kpis.map((k: any) =>
            k.id === kpiId ? { ...k, ...updates } : k,
          ),
        })),
      })),
    }));
  };

  const handleDeleteKPI = async (kpiId: string, standardId: string) => {
    const { error } = await api.deleteKPI(kpiId);
    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete KPI",
        variant: "destructive",
      });
    } else {
      setEditData((prev: any) => ({
        ...prev,
        domains: prev.domains.map((d: Domain) => ({
          ...d,
          standards: d.standards.map((s: any) =>
            s.id === standardId
              ? {
                  ...s,
                  kpis: s.kpis.filter((k: any) => k.id !== kpiId),
                }
              : s,
          ),
        })),
      }));
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading evaluation rubrics...</p>
      </div>
    );
  }

  const currentData = isEditMode ? editData : selectedTemplate;

  // Count KPIs across all domains and standards
  const countKPIs = (domains: Template[]) => {
    if (!domains) return 0;
    return domains.reduce(
      (acc, d) =>
        acc +
        (d.standards || []).reduce(
          (sacc: number, s: any) => sacc + (s.kpis?.length || 0),
          0,
        ),
      0,
    );
  };

  const countStandards = (domains: Template[]) => {
    if (!domains) return 0;
    return domains.reduce((acc, d) => acc + (d.standards?.length || 0), 0);
  };

  return (
    <div className="max-w-6xl mx-auto py-8">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-2">
            KPI Framework
          </h1>
          <p className="text-muted-foreground">
            Domain → Standard → KPI structure for performance evaluation.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {!isEditMode && (
            <Button className="glow-primary" onClick={handleCreateTemplate}>
              <Plus className="h-4 w-4 mr-2" />
              New Template
            </Button>
          )}
        </div>
      </div>

      {/* Template Selector Bar */}
      <Card className="mb-6 glass-panel border-border/30">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between">
            <div
              className={`flex items-center gap-4 flex-1 min-w-0 ${!isEditMode ? "cursor-pointer hover:bg-muted/50 -m-2 p-2 rounded-lg transition-colors" : ""}`}
              onClick={() => !isEditMode && setTemplateSelectorOpen(true)}
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                {currentData ? (
                  <>
                    <h3 className="font-bold text-lg">{currentData.name}</h3>
                    <p className="text-sm text-muted-foreground truncate">
                      {currentData.description || "No description"}
                    </p>
                  </>
                ) : (
                  <>
                    <h3 className="font-bold text-lg text-muted-foreground">
                      Select a Template
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Click to browse available templates
                    </p>
                  </>
                )}
              </div>
              {!isEditMode && (
                <ChevronsUpDown className="h-5 w-5 text-muted-foreground" />
              )}
            </div>

            {currentData && (
              <div className="flex items-center gap-4 ml-0 md:ml-4 pl-0 md:pl-4 border-l-0 md:border-l mt-4 md:mt-0">
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-primary" />
                    <span className="font-medium text-foreground">
                      {currentData.domains?.length || 0} Domains
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Award className="h-4 w-4 text-primary" />
                    <span className="font-medium text-foreground">
                      {countStandards(currentData.domains)} Standards
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-primary" />
                    <span className="font-medium text-foreground">
                      {countKPIs(currentData.domains)} KPIs
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Main Content Area */}
      {currentData ? (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Action Bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={expandAll}>
                <ExpandIcon className="h-4 w-4 mr-1.5" />
                Expand All
              </Button>
              <Button variant="outline" size="sm" onClick={collapseAll}>
                <ShrinkIcon className="h-4 w-4 mr-1.5" />
                Collapse All
              </Button>
            </div>
            <div className="flex gap-2">
              {isEditMode ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleEditToggle}
                    disabled={isDetailLoading}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSaveTemplate}
                    disabled={isDetailLoading}
                  >
                    {isDetailLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Save Changes
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => setDeleteConfirmOpen(true)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleEditToggle}
                  >
                    <Edit3 className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Edit Mode: Template Info */}
          {isEditMode && (
            <Card className="glass-panel border-border/30">
              <CardHeader className="pb-4">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Template Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Template Name</label>
                    <Input
                      value={editData.name}
                      onChange={(e) =>
                        setEditData({ ...editData, name: e.target.value })
                      }
                      placeholder="Rubric Name"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Description</label>
                    <Textarea
                      value={editData.description || ""}
                      onChange={(e) =>
                        setEditData({
                          ...editData,
                          description: e.target.value,
                        })
                      }
                      placeholder="Rubric Description"
                      className="min-h-[80px]"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Domain Weight Editor - Edit Mode Only */}
          {isEditMode && editData.domains?.length > 0 && (
            <DomainWeightEditor
              domains={editData.domains}
              onUpdateWeight={(domainId, weight) =>
                handleUpdateDomain(domainId, { weight })
              }
              onAutoBalance={handleAutoBalanceWeights}
            />
          )}

          {/* Domains Content */}
          <div className="rounded-xl border border-border/30 bg-muted/10">
            {isDetailLoading && !isEditMode ? (
              <div className="flex flex-col items-center justify-center py-24">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground">
                  Loading KPI framework...
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border/30">
                {(currentData.domains || []).map(
                  (domain: any, domainIdx: number) => (
                    <div key={domain.id} className="bg-background">
                      {/* Domain Header */}
                      <div
                        className={`flex items-center gap-3 p-5 cursor-pointer hover:bg-muted/30 transition-colors ${expandedDomains.has(domain.id) ? "bg-primary/5" : ""}`}
                        onClick={() => toggleDomain(domain.id)}
                      >
                        <div className="flex items-center justify-center w-8">
                          {expandedDomains.has(domain.id) ? (
                            <ChevronDown className="h-5 w-5 text-primary" />
                          ) : (
                            <ChevronRight className="h-5 w-5 text-primary" />
                          )}
                        </div>
                        <Badge
                          variant="secondary"
                          className="font-mono text-sm px-2.5 py-0.5"
                        >
                          D{domainIdx + 1}
                        </Badge>
                        {isEditMode ? (
                          <div
                            className="flex items-center gap-2 flex-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Input
                              value={domain.name}
                              onChange={(e) =>
                                handleUpdateDomain(domain.id, {
                                  name: e.target.value,
                                })
                              }
                              className="flex-1 font-bold h-9"
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 text-destructive hover:bg-destructive/10"
                              onClick={() => handleDeleteDomain(domain.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <h3 className="font-bold text-lg flex-1">
                            {domain.name}
                          </h3>
                        )}
                        <div className="flex items-center gap-4">
                          {!isEditMode && domain.weight && (
                            <Badge variant="outline" className="font-mono">
                              {parseFloat(domain.weight).toFixed(1)}%
                            </Badge>
                          )}
                          <span className="text-sm text-muted-foreground">
                            {domain.standards?.length || 0} standards
                          </span>
                        </div>
                      </div>

                      {/* Domain Content (Standards) */}
                      {expandedDomains.has(domain.id) && (
                        <div className="px-5 pb-5 pt-2 space-y-4 ml-8 border-l-2 border-primary/20">
                          {(domain.standards || []).map(
                            (standard: any, stdIdx: number) => (
                              <div
                                key={standard.id}
                                className="rounded-lg border border-border/50 overflow-hidden bg-background"
                              >
                                {/* Standard Header */}
                                <div
                                  className={`flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/30 transition-colors ${expandedStandards.has(standard.id) ? "bg-muted/20" : ""}`}
                                  onClick={() => toggleStandard(standard.id)}
                                >
                                  {expandedStandards.has(standard.id) ? (
                                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                  )}
                                  <Badge
                                    variant="outline"
                                    className="font-mono text-xs"
                                  >
                                    S{stdIdx + 1}
                                  </Badge>
                                  {isEditMode ? (
                                    <div
                                      className="flex items-center gap-2 flex-1"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <Input
                                        value={standard.name}
                                        onChange={(e) =>
                                          handleUpdateStandard(standard.id, {
                                            name: e.target.value,
                                          })
                                        }
                                        className="flex-1 text-sm h-8"
                                      />
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                        onClick={() =>
                                          handleDeleteStandard(
                                            standard.id,
                                            domain.id,
                                          )
                                        }
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                  ) : (
                                    <span className="text-sm font-medium flex-1">
                                      {standard.name}
                                    </span>
                                  )}
                                  <span className="text-xs text-muted-foreground">
                                    {standard.kpis?.length || 0} KPIs
                                  </span>
                                </div>

                                {/* Standard Content (KPIs) */}
                                {expandedStandards.has(standard.id) && (
                                  <div className="p-4 space-y-4 bg-muted/10">
                                    {(standard.kpis || []).map(
                                      (kpi: any, kpiIdx: number) => (
                                        <div
                                          key={kpi.id}
                                          className="p-4 rounded-lg bg-background border border-border/50 hover:border-primary/30 transition-colors"
                                        >
                                          <div className="flex items-start gap-4">
                                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-sm font-mono font-bold text-primary flex-shrink-0">
                                              {kpiIdx + 1}
                                            </div>
                                            <div className="flex-1 space-y-3 min-w-0">
                                              {isEditMode ? (
                                                <>
                                                  <div className="flex items-center gap-2">
                                                    <Input
                                                      value={kpi.name}
                                                      onChange={(e) =>
                                                        handleUpdateKPI(
                                                          kpi.id,
                                                          {
                                                            name: e.target
                                                              .value,
                                                          },
                                                        )
                                                      }
                                                      className="font-semibold text-sm h-8"
                                                      placeholder="KPI Name"
                                                    />
                                                    <Button
                                                      variant="ghost"
                                                      size="icon"
                                                      className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                                      onClick={() =>
                                                        handleDeleteKPI(
                                                          kpi.id,
                                                          standard.id,
                                                        )
                                                      }
                                                    >
                                                      <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                  </div>
                                                  <Textarea
                                                    value={
                                                      kpi.description || ""
                                                    }
                                                    onChange={(e) =>
                                                      handleUpdateKPI(kpi.id, {
                                                        description:
                                                          e.target.value,
                                                      })
                                                    }
                                                    placeholder="KPI Description / Measurement"
                                                    className="text-sm min-h-[60px]"
                                                  />
                                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                                    <div className="space-y-1.5">
                                                      <label className="text-xs font-medium text-muted-foreground">
                                                        4 - Exemplary
                                                      </label>
                                                      <Input
                                                        value={
                                                          kpi.rubric_4 || ""
                                                        }
                                                        onChange={(e) =>
                                                          handleUpdateKPI(
                                                            kpi.id,
                                                            {
                                                              rubric_4:
                                                                e.target.value,
                                                            },
                                                          )
                                                        }
                                                        className="text-xs h-8"
                                                      />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                      <label className="text-xs font-medium text-muted-foreground">
                                                        3 - Proficient
                                                      </label>
                                                      <Input
                                                        value={
                                                          kpi.rubric_3 || ""
                                                        }
                                                        onChange={(e) =>
                                                          handleUpdateKPI(
                                                            kpi.id,
                                                            {
                                                              rubric_3:
                                                                e.target.value,
                                                            },
                                                          )
                                                        }
                                                        className="text-xs h-8"
                                                      />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                      <label className="text-xs font-medium text-muted-foreground">
                                                        2 - Developing
                                                      </label>
                                                      <Input
                                                        value={
                                                          kpi.rubric_2 || ""
                                                        }
                                                        onChange={(e) =>
                                                          handleUpdateKPI(
                                                            kpi.id,
                                                            {
                                                              rubric_2:
                                                                e.target.value,
                                                            },
                                                          )
                                                        }
                                                        className="text-xs h-8"
                                                      />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                      <label className="text-xs font-medium text-muted-foreground">
                                                        1 - Beginning
                                                      </label>
                                                      <Input
                                                        value={
                                                          kpi.rubric_1 || ""
                                                        }
                                                        onChange={(e) =>
                                                          handleUpdateKPI(
                                                            kpi.id,
                                                            {
                                                              rubric_1:
                                                                e.target.value,
                                                            },
                                                          )
                                                        }
                                                        className="text-xs h-8"
                                                      />
                                                    </div>
                                                  </div>
                                                  <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50">
                                                    <Info className="h-4 w-4 text-primary mt-0.5" />
                                                    <Input
                                                      value={
                                                        kpi.evidence_guidance ||
                                                        ""
                                                      }
                                                      onChange={(e) =>
                                                        handleUpdateKPI(
                                                          kpi.id,
                                                          {
                                                            evidence_guidance:
                                                              e.target.value,
                                                          },
                                                        )
                                                      }
                                                      placeholder="Evidence guidance..."
                                                      className="bg-transparent border-none text-sm h-auto p-0 focus-visible:ring-0"
                                                    />
                                                  </div>
                                                </>
                                              ) : (
                                                <>
                                                  <h5 className="font-semibold">
                                                    {kpi.name}
                                                  </h5>
                                                  {kpi.description && (
                                                    <p className="text-sm text-muted-foreground">
                                                      {kpi.description}
                                                    </p>
                                                  )}
                                                  <div className="flex flex-wrap gap-2">
                                                    <Badge
                                                      variant="default"
                                                      className="text-xs py-0.5 px-2"
                                                    >
                                                      4-Exemplary:{" "}
                                                      {kpi.rubric_4}
                                                    </Badge>
                                                    <Badge
                                                      variant="secondary"
                                                      className="text-xs py-0.5 px-2"
                                                    >
                                                      3-Proficient:{" "}
                                                      {kpi.rubric_3}
                                                    </Badge>
                                                    <Badge
                                                      variant="outline"
                                                      className="text-xs py-0.5 px-2"
                                                    >
                                                      2-Developing:{" "}
                                                      {kpi.rubric_2}
                                                    </Badge>
                                                    <Badge
                                                      variant="outline"
                                                      className="text-xs py-0.5 px-2 text-muted-foreground"
                                                    >
                                                      1-Beginning:{" "}
                                                      {kpi.rubric_1}
                                                    </Badge>
                                                  </div>
                                                  {kpi.evidence_guidance && (
                                                    <div className="flex items-start gap-2 p-2.5 rounded-lg bg-muted/30">
                                                      <Info className="h-3.5 w-3.5 text-primary mt-0.5" />
                                                      <p className="text-sm text-muted-foreground">
                                                        {kpi.evidence_guidance}
                                                      </p>
                                                    </div>
                                                  )}
                                                </>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      ),
                                    )}
                                    {isEditMode && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-full border-dashed"
                                        onClick={() =>
                                          handleAddKPI(standard.id)
                                        }
                                      >
                                        <Plus className="h-3.5 w-3.5 mr-1.5" />
                                        Add KPI
                                      </Button>
                                    )}
                                  </div>
                                )}
                              </div>
                            ),
                          )}
                          {isEditMode && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full border-dashed"
                              onClick={() => handleAddStandard(domain.id)}
                            >
                              <Plus className="h-3.5 w-3.5 mr-1.5" />
                              Add Standard
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  ),
                )}

                {/* Add Domain / Import Domain Buttons */}
                {isEditMode && (
                  <div className="p-5 flex gap-3">
                    <Button
                      className="flex-1 py-6 border-dashed border-2 rounded-xl"
                      variant="outline"
                      onClick={handleAddDomain}
                    >
                      <Plus className="h-5 w-5 mr-2" />
                      Add New Domain
                    </Button>
                    <Button
                      className="py-6 border-dashed border-2 rounded-xl"
                      variant="outline"
                      onClick={() => setImportDialogOpen(true)}
                    >
                      <Import className="h-5 w-5 mr-2" />
                      Import Domain
                    </Button>
                  </div>
                )}

                {(!currentData.domains || currentData.domains.length === 0) &&
                  !isEditMode && (
                    <div className="text-center py-16 text-muted-foreground">
                      <BookOpen className="h-16 w-16 mx-auto mb-4 opacity-30" />
                      <p className="text-lg font-medium">
                        No domains defined yet.
                      </p>
                      <p className="text-sm mt-1">
                        Click "Edit" to add domains, standards, and KPIs.
                      </p>
                    </div>
                  )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <Card className="min-h-[400px] flex flex-col items-center justify-center border-dashed border-2 border-border/50 bg-muted/5">
          <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center mb-6">
            <FileText className="h-12 w-12 text-muted-foreground opacity-50" />
          </div>
          <h3 className="text-2xl font-semibold text-muted-foreground">
            Select a Template
          </h3>
          <p className="text-muted-foreground max-w-md text-center mt-3">
            Click the template selector above to browse and select a KPI
            framework template.
          </p>
          <Button
            variant="outline"
            className="mt-6"
            onClick={() => setTemplateSelectorOpen(true)}
          >
            <Layout className="h-4 w-4 mr-2" />
            Browse Templates
          </Button>
        </Card>
      )}

      {/* Template Selector Dialog */}
      <TemplateSelectorDialog
        open={templateSelectorOpen}
        onOpenChange={setTemplateSelectorOpen}
        templates={templates}
        selectedTemplate={selectedTemplate}
        onSelectTemplate={handleSelectTemplate}
        isEditMode={isEditMode}
      />

      {/* Import Domain Dialog */}
      {isEditMode && selectedTemplate && (
        <ImportDomainDialog
          open={importDialogOpen}
          onOpenChange={setImportDialogOpen}
          templates={templates}
          currentTemplateId={selectedTemplate.id}
          onImport={handleImportDomains}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent className="glass-panel-strong border-destructive/20">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Rubric Deletion - Danger Zone
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4 pt-2" asChild>
              <div>
                <span className="font-bold text-foreground block">
                  Are you absolutely sure you want to delete the "
                  {selectedTemplate?.name}" rubric?
                </span>
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive-foreground space-y-2">
                  <p>
                    • This will permanently remove all associated Domains,
                    Standards, and KPIs.
                  </p>
                  <p>
                    • This action <strong>cannot be undone</strong>.
                  </p>
                  <p>
                    • If this rubric is linked to active or historical
                    assessments, deletion may be blocked by the system.
                  </p>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="glass-panel">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteRubric}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Rubric Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function RubricsPage() {
  return (
    <ProtectedRoute requiredRoles={["manager", "director", "admin"]}>
      <div className="min-h-screen bg-background relative">
        <div className="fixed inset-0 grid-pattern opacity-50 pointer-events-none" />
        <Header />
        <main className="container relative px-4 py-8">
          <Suspense
            fallback={
              <Loader2 className="h-12 w-12 animate-spin fixed top-1/2 left-1/2" />
            }
          >
            <RubricsContent />
          </Suspense>
        </main>
      </div>
    </ProtectedRoute>
  );
}
