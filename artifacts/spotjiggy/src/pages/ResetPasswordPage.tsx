import { useState } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { useResetPassword } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

export default function ResetPasswordPage() {
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const token = new URLSearchParams(location.split("?")[1] ?? "").get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const resetPasswordMutation = useResetPassword({
    mutation: {
      onSuccess: () => {
        toast({ title: "Password updated. You can sign in now." });
        navigate("/login");
      },
      onError: (error: any) => {
        toast({
          title: error?.data?.error ?? "Could not reset password",
          variant: "destructive",
        });
      },
    },
  });

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (password !== confirmPassword) {
      toast({ title: "Passwords do not match.", variant: "destructive" });
      return;
    }
    resetPasswordMutation.mutate({ data: { token, password } });
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
          <h1 className="text-3xl font-bold text-foreground">Choose a new password</h1>
          <p className="text-muted-foreground mt-1 text-sm">Your reset link is valid for 15 minutes.</p>
        </div>

        <div className="bg-card border border-card-border rounded-2xl shadow-lg p-6">
          {!token ? (
            <div className="text-center">
              <h2 className="text-lg font-bold text-foreground">Reset link unavailable</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Request a new password reset link to continue.
              </p>
              <Link href="/forgot-password" className="mt-6 inline-block text-sm font-semibold text-primary hover:underline">
                Request reset link
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="new-password" className="block text-sm font-medium text-foreground mb-1.5">
                  New password
                </label>
                <input
                  id="new-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  placeholder="At least 6 characters"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-sm transition-all"
                />
              </div>
              <div>
                <label htmlFor="confirm-password" className="block text-sm font-medium text-foreground mb-1.5">
                  Confirm password
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  placeholder="Repeat your password"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-sm transition-all"
                />
              </div>
              <button
                type="submit"
                disabled={resetPasswordMutation.isPending}
                className="w-full py-3 bg-primary text-primary-foreground font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 text-sm"
              >
                {resetPasswordMutation.isPending ? "Updating..." : "Update password"}
              </button>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
}