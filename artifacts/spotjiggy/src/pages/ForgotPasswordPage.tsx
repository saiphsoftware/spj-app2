import { useState } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { useForgotPassword } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

export default function ForgotPasswordPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const forgotPasswordMutation = useForgotPassword({
    mutation: {
      onSuccess: (data) => {
        if (!data.requiresVerification && data.demoResetToken) {
          navigate(`/reset-password?token=${encodeURIComponent(data.demoResetToken)}`);
          return;
        }
        setSubmitted(true);
      },
      onError: (error: any) => {
        toast({
          title: error?.data?.error ?? "Could not start password reset",
          variant: "destructive",
        });
      },
    },
  });

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    forgotPasswordMutation.mutate({ data: { email } });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary mb-4">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-foreground">Reset your password</h1>
          <p className="text-muted-foreground mt-1 text-sm">Get back to collecting pieces.</p>
        </div>

        <div className="bg-card border border-card-border rounded-2xl shadow-lg p-6">
          {submitted ? (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m5 12 4 4L19 6" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-foreground">Request received</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Non-demo reset links require a connected email provider. The demo account can reset without email verification.
              </p>
              <Link href="/login" className="mt-6 inline-block text-sm font-semibold text-primary hover:underline">
                Back to sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-sm leading-6 text-muted-foreground">
                Enter your account email to begin. For the demo account, use{" "}
                <strong className="font-semibold text-foreground">demo@spotjiggy.com</strong> to reset immediately.
              </p>
              <div>
                <label htmlFor="reset-email" className="block text-sm font-medium text-foreground mb-1.5">
                  Email
                </label>
                <input
                  id="reset-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-sm transition-all"
                />
              </div>
              <button
                type="submit"
                disabled={forgotPasswordMutation.isPending}
                className="w-full py-3 bg-primary text-primary-foreground font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 text-sm"
              >
                {forgotPasswordMutation.isPending ? "Checking..." : "Continue"}
              </button>
              <Link href="/login" className="block text-center text-sm font-semibold text-primary hover:underline">
                Back to sign in
              </Link>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
}