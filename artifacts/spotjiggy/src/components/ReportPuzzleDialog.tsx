import { useState, type FormEvent } from "react";
import { useReportPuzzle } from "@workspace/api-client-react";
import { Flag } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

interface ReportPuzzleDialogProps {
  puzzleId: string;
}

type ReportReason = "inappropriate" | "spam" | "harassment" | "copyright" | "other";

export function ReportPuzzleDialog({ puzzleId }: ReportPuzzleDialogProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>("inappropriate");
  const [details, setDetails] = useState("");
  const { toast } = useToast();

  const reportMutation = useReportPuzzle({
    mutation: {
      onSuccess: () => {
        setOpen(false);
        setReason("inappropriate");
        setDetails("");
        toast({ title: "Puzzle report sent", description: "Thanks for helping keep SpotJiggy safe." });
      },
      onError: (error: any) => {
        toast({
          title: error?.data?.error ?? "We couldn't send this report.",
          variant: "destructive",
        });
      },
    },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (reportMutation.isPending) return;
    reportMutation.mutate({
      id: puzzleId,
      data: {
        reason,
        ...(details.trim() ? { details: details.trim() } : {}),
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="text-muted-foreground">
          <Flag aria-hidden="true" />
          Report puzzle
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[460px]">
        <form onSubmit={handleSubmit} className="space-y-5">
          <DialogHeader>
            <DialogTitle>Report this puzzle</DialogTitle>
            <DialogDescription>
              Choose a reason and add details if they’ll help us review it.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="puzzle-report-reason" className="text-sm font-medium text-foreground">
                Reason for reporting
              </label>
              <select
                id="puzzle-report-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value as ReportReason)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="inappropriate">Inappropriate content</option>
                <option value="spam">Spam or misleading</option>
                <option value="harassment">Harassment or bullying</option>
                <option value="copyright">Copyright concern</option>
                <option value="other">Something else</option>
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="puzzle-report-details" className="text-sm font-medium text-foreground">
                Details <span className="font-normal text-muted-foreground">(optional)</span>
              </label>
              <Textarea
                id="puzzle-report-details"
                value={details}
                onChange={(event) => setDetails(event.target.value)}
                placeholder="What should we take a closer look at?"
                maxLength={1500}
                rows={5}
                className="resize-y"
              />
              <p className="text-right text-xs text-muted-foreground">{details.length}/1500</p>
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={reportMutation.isPending}>
              {reportMutation.isPending ? "Sending…" : "Submit report"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
