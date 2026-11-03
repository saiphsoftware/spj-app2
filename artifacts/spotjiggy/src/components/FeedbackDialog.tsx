import { useState, type FormEvent, type ReactNode } from "react";
import { useSubmitFeedback } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

interface FeedbackDialogProps {
  children: ReactNode;
}

type FeedbackCategory = "bug" | "idea" | "other";

export function FeedbackDialog({ children }: FeedbackDialogProps) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<FeedbackCategory>("idea");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [location] = useLocation();
  const { toast } = useToast();

  const feedbackMutation = useSubmitFeedback({
    mutation: {
      onSuccess: () => {
        setOpen(false);
        setCategory("idea");
        setMessage("");
        setEmail("");
        toast({ title: "Thanks for your feedback!" });
      },
      onError: (error: any) => {
        toast({
          title: error?.data?.error ?? "We couldn't send your feedback.",
          variant: "destructive",
        });
      },
    },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (feedbackMutation.isPending) return;

    feedbackMutation.mutate({
      data: {
        category,
        message: message.trim(),
        ...(email.trim() ? { email: email.trim() } : {}),
        page: location.split("?")[0].slice(0, 300),
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <form onSubmit={handleSubmit} className="space-y-5">
          <DialogHeader>
            <DialogTitle>Share feedback</DialogTitle>
            <DialogDescription>
              Tell us what’s working or what we could improve.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="feedback-category" className="text-sm font-medium text-foreground">
                What kind of feedback?
              </label>
              <select
                id="feedback-category"
                value={category}
                onChange={(event) => setCategory(event.target.value as FeedbackCategory)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="idea">Idea or suggestion</option>
                <option value="bug">Report a problem</option>
                <option value="other">Something else</option>
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="feedback-message" className="text-sm font-medium text-foreground">
                Your feedback
              </label>
              <Textarea
                id="feedback-message"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Share a little detail so we can understand."
                required
                minLength={10}
                maxLength={2000}
                rows={5}
                className="resize-y"
              />
              <p className="text-right text-xs text-muted-foreground">{message.length}/2000</p>
            </div>

            <div className="space-y-2">
              <label htmlFor="feedback-email" className="text-sm font-medium text-foreground">
                Email for a reply <span className="font-normal text-muted-foreground">(optional)</span>
              </label>
              <Input
                id="feedback-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                maxLength={254}
                autoComplete="email"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={feedbackMutation.isPending || message.trim().length < 10}>
              {feedbackMutation.isPending ? "Sending…" : "Send feedback"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
