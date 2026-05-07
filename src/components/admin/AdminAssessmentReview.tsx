
import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckCircle2, FileText, Loader2, User, Building, Eye, TableIcon, CheckCheck, Copy, X } from 'lucide-react';
import { api } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
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

interface AdminAssessmentReviewProps {
    // No props needed for now as it fetches its own data
}

interface Assessment {
    id: string;
    status: string;
    manager_scores: any;
    final_score: number | null;
    final_grade: string | null;
    created_at: string;
    updated_at: string;
    staff_name: string;
    staff_niy: string | null;
    staff_department: string;
    manager_name: string;
    director_name: string;
}

// Score-based bonus calculation (matching getPerformanceTier logic)
function getBonus(score: number | null): string {
    if (score === null || score === undefined) return '-';
    const numScore = typeof score === 'number' ? score : parseFloat(String(score));
    if (isNaN(numScore)) return '-';

    if (numScore >= 3.9) return '100%';
    if (numScore >= 3.6) return '90%';
    if (numScore >= 3.4) return '80%';
    if (numScore >= 3.2) return '65%';
    if (numScore >= 3.0) return '50%';
    if (numScore >= 2.8) return '40%';
    if (numScore >= 2.6) return '10%';
    return '0%';
}

export function AdminAssessmentReview() {
    const { toast } = useToast();
    const [assessments, setAssessments] = useState<Assessment[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [processingReleaseAll, setProcessingReleaseAll] = useState(false);
    const [showTableModal, setShowTableModal] = useState(false);
    const [showReleaseAllConfirm, setShowReleaseAllConfirm] = useState(false);
    const [copied, setCopied] = useState(false);
    const tableRef = useRef<HTMLDivElement>(null);

    const fetchAssessments = async () => {
        setLoading(true);
        // Fetch assessments. We might want to filter by status or fetch all pending ones
        // In a real app, we'd have pagination and filtering. 
        // For now, let's fetch everything and filter client-side if needed, relying on API default.
        const { data, error } = await api.get('/api/admin/assessments');

        if (error) {
            toast({
                title: "Error",
                description: "Failed to fetch assessments",
                variant: "destructive"
            });
        } else if (data) {
            const pendingAssessments = (data as Assessment[]).filter(
                a => a.status === 'director_approved'
            );
            setAssessments(pendingAssessments);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchAssessments();
    }, []);

    const handleRelease = async (id: string) => {
        setProcessingId(id);
        const { data, error } = await api.put('/api/admin/assessments', {
            id,
            action: 'release'
        });

        if (error) {
            toast({
                title: "Error",
                description: "Failed to release assessment",
                variant: "destructive"
            });
        } else {
            toast({
                title: "Success",
                description: "Assessment released successfully. Workflow can now proceed to acknowledgment.",
            });
            // Refresh list
            fetchAssessments();
        }
        setProcessingId(null);
    };

    const handleReleaseAll = async () => {
        setProcessingReleaseAll(true);
        const { data, error } = await api.put('/api/admin/assessments', {
            id: 'all', // Not used but required by the endpoint
            action: 'release_all'
        });

        if (error) {
            toast({
                title: "Error",
                description: "Failed to release assessments",
                variant: "destructive"
            });
        } else {
            const count = (data as any)?.count || 0;
            toast({
                title: "Success",
                description: `${count} assessment(s) released successfully.`,
            });
            fetchAssessments();
        }
        setProcessingReleaseAll(false);
        setShowReleaseAllConfirm(false);
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'director_approved':
                return <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 border-emerald-200">Pending Release</Badge>;
            case 'admin_reviewed':
                return <Badge variant="secondary" className="bg-blue-100 text-blue-800 border-blue-200">Released</Badge>;
            case 'acknowledged':
                return <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200">Acknowledged</Badge>;
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    const generateTableHTML = (): string => {
        const rows = assessments.map((a, idx) => `
            <tr>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: center; color: #000;">${idx + 1}</td>
                <td style="border: 1px solid #ddd; padding: 8px; color: #000;">${a.staff_niy || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 8px; color: #000;">${a.staff_name || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 8px; color: #000;">${a.staff_department || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: center; color: #000;">${typeof a.final_score === 'number' ? a.final_score.toFixed(2) : (a.final_score || '-')}</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: center; color: #000;">${a.final_grade || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 8px; color: #000;">${getBonus(a.final_score)}</td>
            </tr>
        `).join('');

        return `
            <table style="border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; font-size: 12px; background-color: #fff;">
                <thead>
                    <tr style="background-color: #f8f9fa;">
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: center; font-weight: bold; color: #000;">No</th>
                        <th style="border: 1px solid #ddd; padding: 8px; font-weight: bold; color: #000;">NIY</th>
                        <th style="border: 1px solid #ddd; padding: 8px; font-weight: bold; color: #000;">Name</th>
                        <th style="border: 1px solid #ddd; padding: 8px; font-weight: bold; color: #000;">Department</th>
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: center; font-weight: bold; color: #000;">Score</th>
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: center; font-weight: bold; color: #000;">Grade</th>
                        <th style="border: 1px solid #ddd; padding: 8px; font-weight: bold; color: #000;">Bonus</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
        `;
    };

    const handleCopyTable = async () => {
        const html = generateTableHTML();
        try {
            // Copy as HTML for rich paste into Google Docs
            await navigator.clipboard.write([
                new ClipboardItem({
                    'text/html': new Blob([html], { type: 'text/html' }),
                    'text/plain': new Blob([html], { type: 'text/plain' })
                })
            ]);
            setCopied(true);
            toast({
                title: "Copied!",
                description: "Table copied to clipboard. You can paste it directly into Google Docs.",
            });
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            // Fallback to plain text
            try {
                await navigator.clipboard.writeText(html);
                setCopied(true);
                toast({
                    title: "Copied!",
                    description: "Table HTML copied to clipboard.",
                });
                setTimeout(() => setCopied(false), 2000);
            } catch (e) {
                toast({
                    title: "Error",
                    description: "Failed to copy table",
                    variant: "destructive"
                });
            }
        }
    };

    return (
        <>
            <Card className="glass-panel border-border/30 overflow-hidden">
                <div className="h-1 bg-gradient-to-r from-blue-500/30 via-blue-500 to-blue-500/30" />
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <FileText className="h-5 w-5 text-blue-500" />
                                Assessment Reviews
                            </CardTitle>
                            <CardDescription>Review and release finalized assessments.</CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowTableModal(true)}
                                disabled={loading || assessments.length === 0}
                            >
                                <TableIcon className="h-4 w-4 mr-1" />
                                Generate Table
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowReleaseAllConfirm(true)}
                                disabled={loading || assessments.length === 0 || processingReleaseAll}
                                className="text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                            >
                                {processingReleaseAll ? (
                                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                ) : (
                                    <CheckCheck className="h-4 w-4 mr-1" />
                                )}
                                Release All
                            </Button>
                            <Button variant="outline" size="sm" onClick={fetchAssessments} disabled={loading}>
                                Refresh
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20">
                            <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
                            <p className="text-muted-foreground font-medium">Loading assessments...</p>
                        </div>
                    ) : assessments.length === 0 ? (
                        <div className="text-center py-20 border border-dashed rounded-xl bg-muted/20">
                            <CheckCircle2 className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                            <h3 className="text-lg font-semibold">All Caught Up</h3>
                            <p className="text-muted-foreground">No assessments pending review.</p>
                        </div>
                    ) : (
                        <div className="rounded-md border border-border/50 overflow-hidden">
                            <Table>
                                <TableHeader className="bg-muted/50">
                                    <TableRow>
                                        <TableHead>Staff Member</TableHead>
                                        <TableHead>Department</TableHead>
                                        <TableHead>Score</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Last Updated</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {assessments.map((assessment) => (
                                        <TableRow key={assessment.id} className="hover:bg-muted/30 transition-colors">
                                            <TableCell className="font-medium">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                                                        {assessment.staff_name?.charAt(0)}
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span>{assessment.staff_name}</span>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2 text-sm">
                                                    <Building className="h-3 w-3 text-muted-foreground" />
                                                    {assessment.staff_department}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="font-bold">{assessment.final_score ?? '-'}</span>
                                                    <span className="text-xs text-muted-foreground">{assessment.final_grade ?? '-'}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>{getStatusBadge(assessment.status)}</TableCell>
                                            <TableCell className="text-xs text-muted-foreground">
                                                {format(new Date(assessment.updated_at), 'MMM d, yyyy')}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {assessment.status === 'director_approved' && (
                                                    <Button
                                                        size="sm"
                                                        className="glow-primary"
                                                        onClick={() => handleRelease(assessment.id)}
                                                        disabled={processingId === assessment.id}
                                                    >
                                                        {processingId === assessment.id ? (
                                                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                                        ) : (
                                                            <CheckCircle2 className="h-3 w-3 mr-1" />
                                                        )}
                                                        Release
                                                    </Button>
                                                )}
                                                {assessment.status === 'admin_reviewed' && (
                                                    <span className="text-xs text-muted-foreground italic">Released</span>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Generate Table Modal */}
            <Dialog open={showTableModal} onOpenChange={setShowTableModal}>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <TableIcon className="h-5 w-5 text-blue-500" />
                            Assessment Summary Table
                        </DialogTitle>
                        <DialogDescription>
                            Copy this table to paste into Google Docs or other applications.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="flex justify-end">
                            <Button onClick={handleCopyTable} className="gap-2">
                                {copied ? (
                                    <>
                                        <CheckCircle2 className="h-4 w-4" />
                                        Copied!
                                    </>
                                ) : (
                                    <>
                                        <Copy className="h-4 w-4" />
                                        Copy Table
                                    </>
                                )}
                            </Button>
                        </div>
                        <div
                            ref={tableRef}
                            className="border rounded-lg p-4 bg-white overflow-auto"
                            dangerouslySetInnerHTML={{ __html: generateTableHTML() }}
                        />
                    </div>
                </DialogContent>
            </Dialog>

            {/* Release All Confirmation */}
            <AlertDialog open={showReleaseAllConfirm} onOpenChange={setShowReleaseAllConfirm}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Release All Assessments?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will release all {assessments.length} pending assessment(s) at once.
                            Staff members will be notified and can proceed to acknowledgment.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={processingReleaseAll}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleReleaseAll}
                            disabled={processingReleaseAll}
                            className="bg-emerald-600 hover:bg-emerald-700"
                        >
                            {processingReleaseAll ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                    Releasing...
                                </>
                            ) : (
                                'Release All'
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
