import { Link } from "wouter";
import { motion } from "framer-motion";
import { Layout } from "@/components/Layout";
import { useListPackages, useGetMyStats, getGetMyStatsQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";

export default function StorePage() {
  const { isLoggedIn } = useAuth();
  const { data: packages, isLoading } = useListPackages();
  const { data: myStats } = useGetMyStats({ query: { enabled: isLoggedIn, queryKey: getGetMyStatsQueryKey() } });

  return (
    <Layout>
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-10">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-3xl font-bold text-foreground mb-2">Puzzle Creator Packs</h1>
            <p className="text-muted-foreground">Get more puzzle slots to share with the world.</p>
            {isLoggedIn && myStats && (
              <div className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-accent/20 border border-accent/30 rounded-full">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-foreground">
                  <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" />
                </svg>
                <span className="text-sm font-medium text-foreground">
                  {myStats.remainingPuzzles ?? 0} puzzle slots remaining
                </span>
              </div>
            )}
          </motion.div>
        </div>

        {isLoading ? (
          <div className="grid sm:grid-cols-3 gap-5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-card rounded-2xl border border-card-border h-64 animate-pulse" />
            ))}
          </div>
        ) : packages && packages.length > 0 ? (
          <div className="grid sm:grid-cols-3 gap-5">
            {packages.map((pkg, i) => (
              <motion.div
                key={pkg.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className={`relative bg-card border rounded-2xl p-6 flex flex-col ${
                  pkg.popular ? "border-primary shadow-lg shadow-primary/10" : "border-card-border"
                }`}
              >
                {pkg.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full">
                      Most Popular
                    </span>
                  </div>
                )}

                <div className="mb-4">
                  <div className="text-4xl font-bold text-foreground mb-1">
                    {pkg.puzzleCount}
                    <span className="text-lg font-medium text-muted-foreground ml-1">puzzles</span>
                  </div>
                  {pkg.discountName && (
                    <span className="text-xs font-medium text-secondary bg-secondary/10 px-2 py-0.5 rounded-full">
                      {pkg.discountName}
                    </span>
                  )}
                </div>

                <div className="mb-6 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-foreground">${pkg.price.toFixed(2)}</span>
                    {pkg.originalPrice && (
                      <span className="text-muted-foreground line-through text-sm">${pkg.originalPrice.toFixed(2)}</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    ${(pkg.price / pkg.puzzleCount).toFixed(2)} per puzzle
                  </p>
                </div>

                <Link href={`/store/checkout?packageId=${pkg.id}`}>
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    className={`w-full py-3 rounded-xl font-semibold text-sm transition-opacity hover:opacity-90 ${
                      pkg.popular
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground hover:bg-muted/80"
                    }`}
                  >
                    Get {pkg.puzzleCount} Puzzles
                  </motion.button>
                </Link>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-card rounded-2xl border border-card-border">
            <p className="text-muted-foreground">No packages available right now.</p>
          </div>
        )}

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-10 bg-muted rounded-2xl p-6 text-center"
        >
          <h3 className="font-semibold text-foreground mb-2">How it works</h3>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            Each puzzle slot lets you create one new puzzle. Free accounts start with 3 slots.
            Purchase packs to create more and share them with your community.
          </p>
        </motion.div>
      </div>
    </Layout>
  );
}
