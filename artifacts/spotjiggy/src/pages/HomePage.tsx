import { Link } from "wouter";
import { motion } from "framer-motion";
import { Layout } from "@/components/Layout";
import { useListPuzzles, useListTrendingPuzzles, useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { PuzzleCard } from "@/components/PuzzleCard";
import { useBucket } from "@/context/BucketContext";

export default function HomePage() {
  const { isLoggedIn } = useAuth();
  const { pieces: bucketPieces } = useBucket();
  const { data: me } = useGetMe({ query: { enabled: isLoggedIn, queryKey: getGetMeQueryKey() } });
  const { data: puzzles, isLoading } = useListPuzzles({ status: "open" });
  const { data: trending } = useListTrendingPuzzles({ limit: 8 });

  return (
    <Layout>
      {!isLoggedIn && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-secondary p-8 mb-10 text-white"
        >
          <div className="relative z-10">
            <h1 className="text-4xl font-bold mb-3">Collect pieces.<br />Complete puzzles.</h1>
            <p className="text-white/80 text-lg mb-6 max-w-md">Share puzzle pieces with friends, collect them all, and unlock badges when you complete the picture.</p>
            <Link href="/login">
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                className="bg-white text-primary font-bold px-6 py-3 rounded-xl hover:bg-white/95 transition-colors shadow-lg"
              >
                Get started free
              </motion.button>
            </Link>
          </div>
          <div className="absolute -right-8 -top-8 w-48 h-48 bg-white/10 rounded-full" />
          <div className="absolute -right-4 bottom-0 w-32 h-32 bg-white/10 rounded-full" />
          <div className="absolute right-16 top-8 grid grid-cols-3 gap-2 opacity-20">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="w-12 h-12 bg-white rounded-lg" />
            ))}
          </div>
        </motion.div>
      )}

      {isLoggedIn && me && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-8"
        >
          <div>
            <h1 className="text-2xl font-bold text-foreground">Welcome back, {me.name.split(" ")[0]}</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Discover new puzzles to collect</p>
          </div>
          <Link href="/edit/new">
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl text-sm hover:opacity-90 transition-opacity"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Create Puzzle
            </motion.button>
          </Link>
        </motion.div>
      )}

      {(isLoggedIn || bucketPieces.length > 0) && (
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10 rounded-3xl border border-primary/20 bg-primary/[0.04] p-5 sm:p-6"
        >
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary mb-1">Just for you</p>
              <h2 className="text-xl font-bold text-foreground">Pieces in your Bucket</h2>
            </div>
            <Link href="/bucket" className="text-sm font-semibold text-primary hover:underline">
              Open Bucket
            </Link>
          </div>
          {bucketPieces.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {bucketPieces.slice(0, 4).map((piece) => (
                <Link key={piece.id} href="/bucket">
                  <motion.div
                    whileHover={{ y: -3 }}
                    className="overflow-hidden rounded-2xl bg-card border border-card-border shadow-sm"
                  >
                    <div className="relative aspect-square bg-muted">
                      <img
                        src={piece.pieceImage || piece.puzzleImage}
                        alt={`Piece #${piece.position + 1}`}
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                      <span className="absolute top-2 left-2 rounded-full bg-foreground/80 text-background px-2 py-0.5 text-[10px] font-bold">
                        #{piece.position + 1}
                      </span>
                    </div>
                    <p className="truncate px-3 py-2 text-xs font-semibold text-foreground">{piece.puzzleTitle}</p>
                  </motion.div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-primary/20 bg-card/60 px-4 py-5 text-sm text-muted-foreground">
              Shared pieces will land here before you add them to a puzzle.
            </p>
          )}
        </motion.section>
      )}

      {trending && trending.length > 0 && (
        <section className="mb-10">
          <h2 className="text-lg font-bold text-foreground mb-4">Trending</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {trending.map((puzzle, i) => (
              <motion.div
                key={puzzle.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <PuzzleCard puzzle={puzzle} compact />
              </motion.div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-lg font-bold text-foreground mb-4">Active Puzzles</h2>
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-card rounded-2xl border border-card-border h-64 animate-pulse" />
            ))}
          </div>
        ) : puzzles && puzzles.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {puzzles.map((puzzle, i) => (
              <motion.div
                key={puzzle.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07 }}
              >
                <PuzzleCard puzzle={puzzle} />
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-card rounded-2xl border border-card-border">
            <div className="w-16 h-16 bg-muted rounded-2xl mx-auto mb-4 flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground">
                <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" />
              </svg>
            </div>
            <h3 className="font-semibold text-foreground mb-1">No puzzles yet</h3>
            <p className="text-muted-foreground text-sm">Be the first to create one!</p>
            {isLoggedIn && (
              <Link href="/edit/new">
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className="mt-4 px-5 py-2 bg-primary text-primary-foreground font-semibold rounded-xl text-sm hover:opacity-90 transition-opacity"
                >
                  Create a Puzzle
                </motion.button>
              </Link>
            )}
          </div>
        )}
      </section>
    </Layout>
  );
}
