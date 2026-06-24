import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { MessageSquare, Send, CheckCircle, Clock } from "lucide-react";
import { api } from "@/lib/api-client";

interface Question {
  id: string;
  indicator_id: string | null;
  question: string;
  response: string | null;
  status: string;
  created_at: string;
  responded_at: string | null;
  asked_by: string;
  asked_by_name?: string;
  indicator_name?: string;
}

interface QuestionsPanelProps {
  assessmentId: string;
  indicators?: { id: string; name: string }[];
}

export function QuestionsPanel({ assessmentId, indicators = [] }: QuestionsPanelProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);

  useEffect(() => {
    fetchQuestions();
  }, [assessmentId]);

  const fetchQuestions = async () => {
    const { data, error } = await api.getQuestions({ assessmentId });

    if (error) {
      console.error('Error fetching questions:', error);
    } else {
      const indicatorMap = new Map(
        indicators.map(i => [i.id, i.name])
      );

      setQuestions((data as Question[] || []).map(q => ({
        ...q,
        indicator_name: q.indicator_id ? indicatorMap.get(q.indicator_id) : undefined,
      })));
    }
    setLoading(false);
  };

  const handleRespond = async (questionId: string) => {
    const response = responses[questionId];
    if (!response?.trim()) {
      toast({ title: "Error", description: "Please enter a response", variant: "destructive" });
      return;
    }

    setSubmitting(questionId);
    const { error } = await api.answerQuestion(questionId, response, 'responded');

    setSubmitting(null);

    if (error) {
      toast({ title: "Error", description: "Failed to submit response", variant: "destructive" });
    } else {
      toast({ title: "Sent", description: "Response sent successfully" });
      setResponses(prev => ({ ...prev, [questionId]: '' }));
      fetchQuestions();
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (questions.length === 0) {
    return null;
  }

  const pendingCount = questions.filter(q => q.status === 'pending').length;

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-lg">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Staff Questions
          </div>
          {pendingCount > 0 && (
            <Badge variant="destructive">{pendingCount} pending</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {questions.map(question => (
          <div
            key={question.id}
            className="p-4 border rounded-lg bg-muted/20 space-y-3"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                {question.indicator_name && (
                  <Badge variant="outline" className="mb-2 text-xs">
                    {question.indicator_name}
                  </Badge>
                )}
                <p className="text-sm font-medium">{question.question}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Asked by {question.asked_by_name || 'Unknown'} • {new Date(question.created_at).toLocaleDateString()}
                </p>
              </div>
              <Badge variant={question.status === 'pending' ? 'secondary' : 'default'} className="gap-1">
                {question.status === 'pending' ? (
                  <><Clock className="h-3 w-3" /> Pending</>
                ) : (
                  <><CheckCircle className="h-3 w-3" /> Responded</>
                )}
              </Badge>
            </div>

            {question.status === 'responded' && question.response && (
              <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
                <p className="text-xs text-primary font-medium mb-1">Your Response:</p>
                <p className="text-sm">{question.response}</p>
              </div>
            )}

            {question.status === 'pending' && (
              <div className="space-y-2">
                <Textarea
                  placeholder="Type your response..."
                  value={responses[question.id] || ''}
                  onChange={(e) => setResponses(prev => ({ ...prev, [question.id]: e.target.value }))}
                  className="min-h-[80px]"
                />
                <Button
                  size="sm"
                  onClick={() => handleRespond(question.id)}
                  disabled={submitting === question.id}
                >
                  <Send className="h-4 w-4 mr-2" />
                  {submitting === question.id ? "Sending..." : "Send Response"}
                </Button>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
