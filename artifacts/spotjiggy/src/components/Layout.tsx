import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useGetMe } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { motion } from "framer-motion";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const { isLoggedIn, setToken } = useAuth();
  const { data: me } = useGetMe({ query: { enabled: isLoggedIn } });

  const handleLogout = () => {
    setToken(null);
    window.location.href = "/";
  };

  if (location === "/login") return <>{children}</>;

  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-50 bg-card border-b border-border shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/">
            <motion.div
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="flex items-center gap-2 cursor-pointer"
            >
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                  <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" />
                </svg>
              </div>
              <span className="font-bold text-lg tracking-tight text-foreground">SpotJiggy</span>
            </motion.div>
          </Link>

          <div className="flex items-center gap-1">
            {isLoggedIn ? (
              <>
                <Link href="/store">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="px-3 py-1.5 text-sm font-medium text-foreground hover:text-primary transition-colors rounded-lg hover:bg-muted"
                  >
                    Store
                  </motion.button>
                </Link>
                {me && (
                  <Link href={`/profile/${me.sub}`}>
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="flex items-center gap-2 ml-2 cursor-pointer px-2 py-1 rounded-lg hover:bg-muted"
                    >
                      <img src={me.avatar} alt={me.name} className="w-7 h-7 rounded-full border-2 border-primary/30" />
                      <span className="text-sm font-medium hidden sm:block">{me.name}</span>
                    </motion.div>
                  </Link>
                )}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleLogout}
                  className="ml-1 px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted"
                >
                  Sign out
                </motion.button>
              </>
            ) : (
              <Link href="/login">
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className="px-4 py-1.5 text-sm font-semibold bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
                >
                  Sign in
                </motion.button>
              </Link>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
}
