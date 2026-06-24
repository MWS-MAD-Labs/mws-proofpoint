import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, CheckCircle, Clock, UserCheck } from "lucide-react";
import { api } from "@/lib/api-client";
import { useAuth } from "@/hooks/useAuth";

interface Question {
  id: string;
  indicator_id: string | null;
  question: string;
  response: string | null;
  status: string;
  created_at: string;
  responded_at: string | null;
  indicator_name?: string;
}

interface MyQuestionsPanelProps {
  assessmentId: string;
  indicators?: { id: string; name: string }[];
}

export function MyQuestionsPanel({ assessmentId, indicators = [] }: MyQuestionsPanelProps) {
  const { user } = useAuth();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchQuestions = async () => {
      const { data, error } = await api.getQuestions({
        assessmentId,
        askedBy: user.id
      });

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

    fetchQuestions();
  }, [assessmentId, user, indicators]);

  if (loading) {
    return null;
  }

  if (questions.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <MessageSquare className="h-5 w-5" />
          My Questions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {questions.map(question => (
          <div
            key={question.id}
            className="p-3 border rounded-lg space-y-2"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                {question.indicator_name && (
                  <Badge variant="outline" className="mb-1.5 text-xs">
                    {question.indicator_name}
                  </Badge>
                )}
                <p className="text-sm">{question.question}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(question.created_at).toLocaleDateString()}
                </p>
              </div>
              <Badge variant={question.status === 'pending' ? 'secondary' : 'default'} className="gap-1 shrink-0">
                {question.status === 'pending' ? (
                  <><Clock className="h-3 w-3" /> Pending</>
                ) : (
                  <><CheckCircle className="h-3 w-3" /> Answered</>
                )}
              </Badge>
            </div>

            {question.status === 'responded' && question.response && (
              <div className="p-2.5 bg-primary/5 border border-primary/20 rounded-md">
                <div className="flex items-center gap-1.5 text-xs text-primary font-medium mb-1">
                  <UserCheck className="h-3 w-3" />
                  Manager&apos;s Response
                </div>
                <p className="text-sm">{question.response}</p>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
