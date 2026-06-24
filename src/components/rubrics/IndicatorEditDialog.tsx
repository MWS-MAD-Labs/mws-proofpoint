import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Link, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ScoreOption {
  score: number;
  label: string;
  enabled: boolean;
}

export interface IndicatorFormData {
  name: string;
  description: string | null;
  evidence_guidance: string | null;
  score_options: ScoreOption[];
}

interface IndicatorEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  indicator: IndicatorFormData | null;
  onSave: (data: IndicatorFormData) => Promise<void>;
  mode: 'create' | 'edit';
}

const defaultScoreOptions: ScoreOption[] = [
  { score: 0, label: "Critical Failure", enabled: true },
  { score: 1, label: "Below Expectations", enabled: true },
  { score: 2, label: "Meets Standard", enabled: true },
  { score: 3, label: "Exceeds Standard", enabled: true },
  { score: 4, label: "Outstanding", enabled: true },
];

export function IndicatorEditDialog({ 
  open, 
  onOpenChange, 
  indicator, 
  onSave, 
  mode 
}: IndicatorEditDialogProps) {
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<IndicatorFormData>({
    name: '',
    description: null,
    evidence_guidance: null,
    score_options: defaultScoreOptions,
  });

  useEffect(() => {
    if (indicator) {
      setFormData({
        name: indicator.name,
        description: indicator.description,
        evidence_guidance: indicator.evidence_guidance,
        score_options: indicator.score_options?.length ? indicator.score_options : defaultScoreOptions,
      });
    } else {
      setFormData({
        name: '',
        description: null,
        evidence_guidance: null,
        score_options: defaultScoreOptions,
      });
    }
  }, [indicator, open]);

  const handleSave = async () => {
    if (!formData.name.trim()) return;
    
    setSaving(true);
    try {
      await onSave(formData);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const toggleScore = (score: number, enabled: boolean) => {
    setFormData(prev => ({
      ...prev,
      score_options: prev.score_options.map(opt => 
        opt.score === score ? { ...opt, enabled } : opt
      ),
    }));
  };

  const updateScoreLabel = (score: number, label: string) => {
    setFormData(prev => ({
      ...prev,
      score_options: prev.score_options.map(opt => 
        opt.score === score ? { ...opt, label } : opt
      ),
    }));
  };

  const enabledCount = formData.score_options.filter(o => o.enabled).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Add Indicator' : 'Edit Indicator'}</DialogTitle>
          <DialogDescription>
            Configure the indicator details and scoring options
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Basic Info */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Indicator Name *</Label>
              <Input
                placeholder="e.g., Code Quality"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                placeholder="Brief description of what this indicator measures..."
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value || null })}
                rows={2}
              />
            </div>
          </div>

          {/* Evidence Guidance */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Link className="h-4 w-4 text-muted-foreground" />
              <Label>Accepted Evidence Guidance</Label>
            </div>
            <Textarea
              placeholder="Describe what evidence is acceptable for this indicator. E.g., 'Upload portfolio link, GitHub repository, or certification document...'"
              value={formData.evidence_guidance || ''}
              onChange={(e) => setFormData({ ...formData, evidence_guidance: e.target.value || null })}
              rows={3}
              className="text-sm"
            />
            <p className="text-xs text-muted-foreground">
              This guidance will be shown to users when they provide evidence for their scores.
            </p>
          </div>

          {/* Score Options */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <Label>Score Options</Label>
              </div>
              <span className="text-xs text-muted-foreground">
                {enabledCount} enabled
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Select which scores are available and customize their descriptions.
            </p>
            
            <div className="space-y-3 rounded-lg border border-border p-3">
              {formData.score_options.map((option) => (
                <div 
                  key={option.score}
                  className={cn(
                    "flex items-start gap-3 p-2 rounded transition-colors",
                    option.enabled ? "bg-muted/50" : "opacity-50"
                  )}
                >
                  <Checkbox
                    id={`score-${option.score}`}
                    checked={option.enabled}
                    onCheckedChange={(checked) => toggleScore(option.score, !!checked)}
                    className="mt-1"
                  />
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "flex items-center justify-center w-6 h-6 rounded-full text-xs font-mono font-medium",
                        option.score <= 1 && "bg-destructive/10 text-destructive",
                        option.score === 2 && "bg-muted text-muted-foreground",
                        option.score >= 3 && "bg-primary/10 text-primary"
                      )}>
                        {option.score}
                      </span>
                      <Input
                        value={option.label}
                        onChange={(e) => updateScoreLabel(option.score, e.target.value)}
                        disabled={!option.enabled}
                        className="h-8 text-sm"
                        placeholder={`Description for score ${option.score}`}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {enabledCount < 2 && (
              <p className="text-xs text-destructive">
                At least 2 score options must be enabled.
              </p>
            )}
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={saving || !formData.name.trim() || enabledCount < 2}
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {mode === 'create' ? 'Add Indicator' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
