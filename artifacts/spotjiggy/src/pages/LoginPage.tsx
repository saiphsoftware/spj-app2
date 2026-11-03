import { useState } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useRegister, useLogin } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";

export default function LoginPage() {
  const [tab, setTab] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [, navigate] = useLocation();
  const { setUser } = useAuth();
  const { toast } = useToast();

  const registerMutation = useRegister({
    mutation: {
      onSuccess: (data) => {
        setUser(data.user);
        toast({ title: "Welcome to SpotJiggy!" });
        navigate("/");
      },
      onError: (e: any) => {
        toast({ title: e?.data?.error ?? "Registration failed", variant: "destructive" });
      },
    },
  });

  const loginMutation = useLogin({
    mutation: {
      onSuccess: (data) => {
        setUser(data.user);
        navigate("/");
      },
      onError: () => {
        toast({ title: "Invalid email or password", variant: "destructive" });
      },
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (tab === "register") {
      registerMutation.mutate({ data: { name, email, password } });
    } else {
      loginMutation.mutate({ data: { email, password } });
    }
  };

  const isPending = registerMutation.isPending || loginMutation.isPending;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary mb-4">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-foreground">SpotJiggy</h1>
          <p className="text-muted-foreground mt-1 text-sm">Collect pieces. Complete puzzles.</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card border border-card-border rounded-2xl shadow-lg overflow-hidden"
        >
          <div className="flex border-b border-border">
            {(["login", "register"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-3.5 text-sm font-semibold transition-colors ${
                  tab === t
                    ? "text-primary border-b-2 border-primary bg-primary/5"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t === "login" ? "Sign In" : "Create Account"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <AnimatePresence mode="wait">
              {tab === "register" && (
                <motion.div
                  key="name"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <label htmlFor="register-name" className="block text-sm font-medium text-foreground mb-1.5">Name</label>
                  <input
                    id="register-name"
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Your name"
                    required
                    autoComplete="name"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-sm transition-all"
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <div>
              <label htmlFor="auth-email" className="block text-sm font-medium text-foreground mb-1.5">Email</label>
              <input
                id="auth-email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
                className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-sm transition-all"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="auth-password" className="block text-sm font-medium text-foreground">Password</label>
                {tab === "login" && (
                  <Link href="/forgot-password" className="text-xs font-semibold text-primary hover:underline">
                    Forgot password?
                  </Link>
                )}
              </div>
              <input
                id="auth-password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={tab === "register" ? 8 : 6}
                autoComplete={tab === "register" ? "new-password" : "current-password"}
                className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-sm transition-all"
              />
            </div>

            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={isPending}
              className="w-full py-3 bg-primary text-primary-foreground font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 text-sm mt-2"
            >
              {isPending ? "Please wait..." : tab === "login" ? "Sign In" : "Create Account"}
            </motion.button>

          </form>
        </motion.div>
      </div>
    </div>
  );
}
