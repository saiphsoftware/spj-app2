import { useParams } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { Layout } from "@/components/Layout";
import { useGetPuzzle, useListPuzzlePieces, useCollectPiece, getListPuzzlePiecesQueryKey, getGetPuzzleQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export default function PlayPage() {
  const { id } = useParams<{ id: string }>();
  const { isLoggedIn } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedPiece, setSelectedPiece] = useState<any>(null);
  const [justCollected, setJustCollected] = useState<string | null>(null);

  const { data: puzzle, isLoading: puzzleLoading } = useGetPuzzle(id);
  const { data: pieces, isLoading: piecesLoading } = useListPuzzlePieces(id, {
    query: { enabled: !!id },
  });

  const collectMutation = useCollectPiece({
    mutation: {
      onSuccess: (data) => {
        setJustCollected(data.piece.id);
        setTimeout(() => setJustCollected(null), 1500);
        queryClient.invalidateQueries({ queryKey: getListPuzzlePiecesQueryKey(id) });
        queryClient.invalidateQueries({ queryKey: getGetPuzzleQueryKey(id) });

        if (data.puzzleCompleted) {
          toast({ title: "You completed the puzzle! Congratulations!" });
        } else if (data.badgeAwarded) {
          toast({ title: `Badge earned: ${data.badgeAwarded.name}` });
        } else {
          toast({ title: "Piece collected!" });
        }
        setSelectedPiece(null);
      },
      onError: (e: any) => {
        toast({ title: e?.data?.error ?? "Could not collect piece", variant: "destructive" });
      },
    },
  });

  if (puzzleLoading || piecesLoading) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto">
          <div className="h-64 bg-card rounded-2xl border border-card-border animate-pulse mb-6" />
          <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-3">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="aspect-square bg-card rounded-xl border border-card-border animate-pulse" />
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  if (!puzzle) {
    return (
      <Layout>
        <div className="text-center py-20">
          <p className="text-muted-foreground">Puzzle not found.</p>
        </div>
      </Layout>
    );
  }

  const allPieces = pieces ?? puzzle.pieces ?? [];
  const collectedCount = allPieces.filter(p => p.collected?.length > 0).length;
  const progress = allPieces.length > 0 ? (collectedCount / allPieces.length) * 100 : 0;

  const cols = puzzle.cut.type === "column" ? puzzle.cut.count : Math.round(Math.sqrt(puzzle.cut.count));
  const rows = puzzle.cut.type === "column" ? 1 : Math.ceil(puzzle.cut.count / cols);

  const handlePieceClick = (piece: any) => {
    if (!isLoggedIn) {
      toast({ title: "Sign in to collect pieces", variant: "destructive" });
      return;
    }
    setSelectedPiece(piece);
  };

  const handleShare = (piece: any) => {
    const url = window.location.origin + `/play/${id}?piece=${piece.id}`;
    navigator.clipboard.writeText(url).then(() => {
      toast({ title: "Piece link copied to clipboard!" });
    });
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <div className="flex items-start justify-between mb-2">
            <div>
              <h1 className="text-2xl font-bold text-foreground">{puzzle.message || "Untitled Puzzle"}</h1>
              <div className="flex items-center gap-2 mt-1">
                <img
                  src={puzzle.createdBy.avatar}
                  alt={puzzle.createdBy.name}
                  className="w-5 h-5 rounded-full"
                  onError={(e) => { (e.target as HTMLImageElement).src = "https://api.dicebear.com/7.x/fun-emoji/svg?seed=default"; }}
                />
                <span className="text-sm text-muted-foreground">by {puzzle.createdBy.name}</span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  puzzle.type === "group" ? "bg-secondary/20 text-secondary" : "bg-accent/30 text-foreground"
                }`}>
                  {puzzle.type}
                </span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-2xl font-bold text-foreground">{collectedCount}</span>
              <span className="text-muted-foreground text-sm">/{allPieces.length} pieces</span>
            </div>
          </div>

          <div className="bg-muted rounded-full h-3 overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-primary to-secondary rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">{Math.round(progress)}% complete</p>
        </div>

        <div className="bg-card border border-card-border rounded-2xl p-4 mb-6">
          <div
            className="relative mx-auto overflow-hidden rounded-xl"
            style={{ maxHeight: "300px", aspectRatio: `${cols}/${rows}` }}
          >
            <img
              src={puzzle.image}
              alt={puzzle.message}
              className="w-full h-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${id}/800/600`; }}
            />
            <div className="absolute inset-0" style={{
              backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent calc(${100/rows}% - 1px), rgba(255,255,255,0.5) calc(${100/rows}% - 1px), rgba(255,255,255,0.5) ${100/rows}%), repeating-linear-gradient(90deg, transparent, transparent calc(${100/cols}% - 1px), rgba(255,255,255,0.5) calc(${100/cols}% - 1px), rgba(255,255,255,0.5) ${100/cols}%)`,
            }} />
          </div>
        </div>

        <div className="mb-4">
          <h2 className="font-semibold text-foreground mb-3">Pieces</h2>
          <div
            className="grid gap-2"
            style={{ gridTemplateColumns: `repeat(${Math.min(cols * 2, 8)}, 1fr)` }}
          >
            {allPieces.map((piece, i) => {
              const isCollected = piece.collected?.length > 0;
              const isJust = justCollected === piece.id;

              return (
                <motion.button
                  key={piece.id}
                  layout
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.02 }}
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.92 }}
                  onClick={() => handlePieceClick(piece)}
                  className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all ${
                    isCollected
                      ? "border-primary/50 shadow-sm"
                      : "border-dashed border-muted-foreground/30 opacity-50 hover:opacity-75"
                  }`}
                >
                  <img
                    src={piece.image}
                    alt={`Piece ${piece.position + 1}`}
                    className={`w-full h-full object-cover transition-all ${isCollected ? "grayscale-0" : "grayscale"}`}
                    style={{
                      objectPosition: `${(piece.position % cols) * (100 / Math.max(cols - 1, 1))}% ${Math.floor(piece.position / cols) * (100 / Math.max(rows - 1, 1))}%`,
                    }}
                    onError={(e) => { (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${piece.id}/100/100`; }}
                  />
                  <AnimatePresence>
                    {isJust && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 flex items-center justify-center bg-primary/80"
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </motion.div>
                    )}
                    {isCollected && !isJust && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="absolute top-1 right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center"
                      >
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <span className="absolute bottom-0.5 left-0 right-0 text-center text-[9px] text-white/80 font-medium bg-black/20">
                    #{piece.position + 1}
                  </span>
                </motion.button>
              );
            })}
          </div>
        </div>

        <AnimatePresence>
          {selectedPiece && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4"
              onClick={() => setSelectedPiece(null)}
            >
              <motion.div
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 50, opacity: 0 }}
                onClick={e => e.stopPropagation()}
                className="bg-card border border-card-border rounded-2xl p-6 w-full max-w-sm"
              >
                <div className="aspect-square rounded-xl overflow-hidden mb-4">
                  <img
                    src={selectedPiece.image}
                    alt="Puzzle piece"
                    className={`w-full h-full object-cover ${selectedPiece.collected?.length > 0 ? "" : "grayscale"}`}
                    onError={(e) => { (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${selectedPiece.id}/300/300`; }}
                  />
                </div>
                <h3 className="font-bold text-foreground mb-1">Piece #{selectedPiece.position + 1}</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {selectedPiece.collected?.length > 0
                    ? `Collected by ${selectedPiece.collected.length} player(s)`
                    : "Not yet collected"}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleShare(selectedPiece)}
                    className="py-2.5 border border-border rounded-xl text-sm font-medium hover:bg-muted transition-colors"
                  >
                    Share Link
                  </motion.button>
                  {selectedPiece.collected?.length === 0 || puzzle.type === "solo" ? (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => collectMutation.mutate({ id: selectedPiece.id })}
                      disabled={collectMutation.isPending}
                      className="py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      {collectMutation.isPending ? "Collecting..." : "Collect Piece"}
                    </motion.button>
                  ) : (
                    <div className="py-2.5 bg-muted text-muted-foreground rounded-xl text-sm font-medium text-center">
                      Already claimed
                    </div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Layout>
  );
}
