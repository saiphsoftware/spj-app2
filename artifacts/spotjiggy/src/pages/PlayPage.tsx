import { useParams } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { Layout } from "@/components/Layout";
import {
  useGetPuzzle,
  useListPuzzlePieces,
  useCollectPiece,
  getListPuzzlePiecesQueryKey,
  getGetPuzzleQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export default function PlayPage() {
  const { id } = useParams<{ id: string }>();
  const { isLoggedIn } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [draggingPieceId, setDraggingPieceId] = useState<string | null>(null);
  const [dragOverCell, setDragOverCell] = useState<number | null>(null);
  // tracks pieces placed this session so the board can animate them in
  const [sessionPlaced, setSessionPlaced] = useState<Set<string>>(new Set());
  const [shakingPieceId, setShakingPieceId] = useState<string | null>(null);

  const { data: puzzle, isLoading: puzzleLoading } = useGetPuzzle(id);
  const { data: pieces, isLoading: piecesLoading } = useListPuzzlePieces(id, {
    query: { enabled: !!id },
  });

  const collectMutation = useCollectPiece({
    mutation: {
      onSuccess: (data) => {
        const pid = data.piece.id;
        setSessionPlaced((prev) => new Set([...prev, pid]));
        setTimeout(() => {
          setSessionPlaced((prev) => {
            const next = new Set(prev);
            next.delete(pid);
            return next;
          });
        }, 700);
        queryClient.invalidateQueries({ queryKey: getListPuzzlePiecesQueryKey(id) });
        queryClient.invalidateQueries({ queryKey: getGetPuzzleQueryKey(id) });
        if (data.puzzleCompleted) {
          toast({ title: "Puzzle complete! Congratulations!" });
        } else if (data.badgeAwarded) {
          toast({ title: `Badge earned: ${data.badgeAwarded.name}` });
        } else {
          toast({ title: "Piece placed!" });
        }
      },
      onError: (e: any) => {
        toast({ title: e?.data?.error ?? "Could not collect piece", variant: "destructive" });
      },
    },
  });

  if (puzzleLoading || piecesLoading) {
    return (
      <Layout>
        <div className="max-w-5xl mx-auto animate-pulse space-y-4">
          <div className="h-7 w-72 bg-muted rounded-xl" />
          <div className="h-4 w-36 bg-muted rounded-lg" />
          <div className="grid lg:grid-cols-[1fr_220px] gap-5 mt-4">
            <div className="aspect-video bg-muted rounded-2xl" />
            <div className="bg-muted rounded-2xl h-64" />
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

  const allPieces: any[] = pieces ?? puzzle.pieces ?? [];
  const cols =
    puzzle.cut.type === "column"
      ? puzzle.cut.count
      : Math.round(Math.sqrt(puzzle.cut.count));
  const rows =
    puzzle.cut.type === "column" ? 1 : Math.ceil(puzzle.cut.count / cols);

  const pieceByPosition = new Map<number, any>(
    allPieces.map((p) => [p.position, p])
  );

  // A piece is "taken" when someone has collected it already
  const isTaken = (p: any) => (p.collected?.length ?? 0) > 0;
  // A piece is "available" = colored = can be dragged
  const isAvailable = (p: any) => !isTaken(p);

  const takenCount = allPieces.filter(isTaken).length;
  const availableCount = allPieces.filter(isAvailable).length;
  const progress = allPieces.length > 0 ? (takenCount / allPieces.length) * 100 : 0;

  // grid helpers
  const bgSize = `${cols * 100}% ${rows * 100}%`;
  const bgPos = (col: number, row: number) => {
    const x = cols > 1 ? (col / (cols - 1)) * 100 : 0;
    const y = rows > 1 ? (row / (rows - 1)) * 100 : 0;
    return `${x}% ${y}%`;
  };

  const handleDrop = (cellIdx: number) => {
    setDragOverCell(null);
    if (!draggingPieceId) return;
    if (!isLoggedIn) {
      toast({ title: "Sign in to place pieces", variant: "destructive" });
      return;
    }

    const piece = allPieces.find((p) => p.id === draggingPieceId);
    setDraggingPieceId(null);
    if (!piece) return;

    if (piece.position !== cellIdx) {
      setShakingPieceId(piece.id);
      setTimeout(() => setShakingPieceId(null), 500);
      toast({ title: "Wrong spot — find the matching cell!", variant: "destructive" });
      return;
    }

    collectMutation.mutate({ id: piece.id });
  };

  const handleShare = (piece: any) => {
    const url = `${window.location.origin}/play/${id}?piece=${piece.id}`;
    navigator.clipboard.writeText(url).then(() => toast({ title: "Link copied!" }));
  };

  const draggingPiece = allPieces.find((p) => p.id === draggingPieceId);

  return (
    <Layout>
      <div className="max-w-5xl mx-auto">
        {/* ── Header ── */}
        <div className="mb-5">
          <div className="flex items-start justify-between mb-2">
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {puzzle.message || "Untitled Puzzle"}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <img
                  src={puzzle.createdBy.avatar}
                  alt={puzzle.createdBy.name}
                  className="w-5 h-5 rounded-full"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      "https://api.dicebear.com/7.x/fun-emoji/svg?seed=default";
                  }}
                />
                <span className="text-sm text-muted-foreground">by {puzzle.createdBy.name}</span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  puzzle.type === "group" ? "bg-secondary/20 text-secondary" : "bg-accent/30 text-foreground"
                }`}>
                  {puzzle.type}
                </span>
              </div>
            </div>
            <div className="text-right shrink-0 ml-4">
              <p className="tabular-nums">
                <span className="text-3xl font-bold text-foreground">{takenCount}</span>
                <span className="text-muted-foreground text-base">/{allPieces.length}</span>
              </p>
              <p className="text-xs text-muted-foreground">pieces placed</p>
            </div>
          </div>
          <div className="bg-muted rounded-full h-2.5 overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-primary to-secondary rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            />
          </div>
        </div>

        <div className="grid lg:grid-cols-[1fr_220px] gap-5">
          {/* ── PUZZLE BOARD ── */}
          <div className="bg-card border border-card-border rounded-2xl p-3 shadow-sm">
            <p className="text-xs text-muted-foreground mb-2 text-center select-none">
              {availableCount > 0
                ? "Drag a colored piece from the tray — drop it on its matching cell"
                : progress === 100
                ? "Puzzle complete!"
                : "No pieces available right now"}
            </p>

            <div
              className="relative rounded-xl overflow-hidden select-none"
              style={{ aspectRatio: `${cols}/${rows}` }}
            >
              {/* Greyscale base — always visible beneath everything */}
              <img
                src={puzzle.image}
                alt={puzzle.message}
                className="absolute inset-0 w-full h-full object-cover grayscale"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${id}/800/600`;
                }}
              />

              {/* Grid cells */}
              <div
                className="absolute inset-0 grid"
                style={{
                  gridTemplateColumns: `repeat(${cols}, 1fr)`,
                  gridTemplateRows: `repeat(${rows}, 1fr)`,
                }}
              >
                {Array.from({ length: cols * rows }).map((_, cellIdx) => {
                  const col = cellIdx % cols;
                  const row = Math.floor(cellIdx / cols);
                  const piece = pieceByPosition.get(cellIdx);
                  const taken = piece && isTaken(piece);
                  const isOver = dragOverCell === cellIdx;
                  const isFlashing = piece && sessionPlaced.has(piece.id);
                  const canAccept = draggingPiece?.position === cellIdx;

                  return (
                    <div
                      key={cellIdx}
                      className="relative border border-white/10"
                      onDragOver={(e) => { e.preventDefault(); setDragOverCell(cellIdx); }}
                      onDragLeave={(e) => {
                        if (!e.currentTarget.contains(e.relatedTarget as Node))
                          setDragOverCell(null);
                      }}
                      onDrop={() => handleDrop(cellIdx)}
                    >
                      {/* Color reveal for taken/placed pieces */}
                      <AnimatePresence>
                        {taken && (
                          <motion.div
                            key={`color-${cellIdx}`}
                            initial={isFlashing ? { opacity: 0, scale: 1.1 } : { opacity: 1, scale: 1 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.35, ease: "easeOut" }}
                            className="absolute inset-0"
                            style={{
                              backgroundImage: `url(${puzzle.image})`,
                              backgroundSize: bgSize,
                              backgroundPosition: bgPos(col, row),
                              backgroundRepeat: "no-repeat",
                            }}
                          />
                        )}
                      </AnimatePresence>

                      {/* White flash on place */}
                      <AnimatePresence>
                        {isFlashing && (
                          <motion.div
                            key={`flash-${cellIdx}`}
                            initial={{ opacity: 0.8 }}
                            animate={{ opacity: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.6 }}
                            className="absolute inset-0 bg-white pointer-events-none"
                          />
                        )}
                      </AnimatePresence>

                      {/* Drop zone highlight */}
                      {isOver && !taken && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className={`absolute inset-0 border-2 ${
                            canAccept
                              ? "border-primary bg-primary/30"
                              : "border-white/40 bg-white/10"
                          }`}
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Completion ring */}
              {progress === 100 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="absolute inset-0 ring-4 ring-primary ring-inset rounded-xl pointer-events-none"
                />
              )}
            </div>
          </div>

          {/* ── PIECE TRAY ── */}
          <div className="bg-card border border-card-border rounded-2xl p-3 flex flex-col gap-2 overflow-y-auto max-h-[600px]">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-foreground text-sm">All Pieces</h2>
              <span className="text-xs text-muted-foreground">
                {availableCount} available
              </span>
            </div>

            <div className="flex items-center gap-3 text-xs py-1.5 px-2 bg-muted rounded-lg">
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-sm bg-primary" />
                <span className="text-muted-foreground">colored = drag me</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-sm bg-muted-foreground/30" />
                <span className="text-muted-foreground">grey = taken</span>
              </span>
            </div>

            <div className="grid grid-cols-3 lg:grid-cols-2 gap-2">
              {allPieces.map((piece: any) => {
                const col = piece.position % cols;
                const row = Math.floor(piece.position / cols);
                const available = isAvailable(piece);
                const taken = isTaken(piece);
                const isShaking = shakingPieceId === piece.id;
                const isDragging = draggingPieceId === piece.id;

                return (
                  <motion.div
                    key={piece.id}
                    animate={isShaking ? { x: [0, -7, 7, -5, 5, 0] } : { x: 0 }}
                    transition={{ duration: 0.4 }}
                    draggable={available && isLoggedIn}
                    onDragStart={(e) => {
                      if (!available || !isLoggedIn) { e.preventDefault(); return; }
                      setDraggingPieceId(piece.id);
                      const el = e.currentTarget as HTMLElement;
                      const ghost = el.cloneNode(true) as HTMLElement;
                      ghost.style.cssText = "position:fixed;top:-9999px;width:80px;height:80px;border-radius:8px;overflow:hidden;";
                      document.body.appendChild(ghost);
                      (e as any).dataTransfer.setDragImage(ghost, 40, 40);
                      setTimeout(() => ghost.remove(), 0);
                    }}
                    onDragEnd={() => { setDraggingPieceId(null); setDragOverCell(null); }}
                    className={`relative aspect-square rounded-xl overflow-hidden border-2 select-none transition-all duration-200 ${
                      available && isLoggedIn
                        ? isDragging
                          ? "border-primary opacity-40 scale-95 cursor-grabbing"
                          : "border-primary/40 hover:border-primary hover:shadow-lg hover:scale-105 cursor-grab"
                        : taken
                        ? "border-border opacity-50 cursor-not-allowed"
                        : "border-border opacity-40 cursor-not-allowed"
                    }`}
                    title={
                      available && isLoggedIn
                        ? `Piece #${piece.position + 1} — drag to its cell`
                        : taken
                        ? `Piece #${piece.position + 1} — already claimed`
                        : `Piece #${piece.position + 1}`
                    }
                  >
                    {/* Image — colored if available, grey if taken */}
                    <div
                      className={`absolute inset-0 transition-all duration-300 ${
                        taken ? "grayscale" : ""
                      }`}
                      style={{
                        backgroundImage: `url(${puzzle.image})`,
                        backgroundSize: bgSize,
                        backgroundPosition: bgPos(col, row),
                        backgroundRepeat: "no-repeat",
                      }}
                    />

                    {/* Lock icon over taken pieces */}
                    {taken && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" opacity="0.8">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                          <path d="M7 11V7a5 5 0 0110 0v4" />
                        </svg>
                      </div>
                    )}

                    {/* Piece number badge */}
                    <div className={`absolute bottom-0 left-0 right-0 text-center text-[9px] font-medium leading-4 ${
                      available ? "bg-primary/80 text-white" : "bg-black/30 text-white/70"
                    }`}>
                      #{piece.position + 1}
                    </div>

                    {/* Share icon on available pieces on hover */}
                    {taken && (
                      <button
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                        onClick={(e) => { e.stopPropagation(); handleShare(piece); }}
                        title="Share this piece"
                      >
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                          <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" />
                        </svg>
                      </button>
                    )}
                  </motion.div>
                );
              })}
            </div>

            {!isLoggedIn && (
              <p className="text-xs text-center text-muted-foreground mt-2 px-2">
                <a href="/login" className="text-primary font-medium hover:underline">Sign in</a> to collect pieces
              </p>
            )}
          </div>
        </div>

        {/* Floating hint while dragging */}
        <AnimatePresence>
          {draggingPieceId && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-foreground text-background text-sm font-medium px-5 py-2.5 rounded-full shadow-2xl z-50 flex items-center gap-2 pointer-events-none"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M18 11V6a2 2 0 00-2-2v0a2 2 0 00-2 2v0M14 10V4a2 2 0 00-2-2v0a2 2 0 00-2 2v0M10 10.5V6a2 2 0 00-2-2v0a2 2 0 00-2 2v6" />
                <path d="M18 11a2 2 0 114 0v3a8 8 0 01-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 012.83-2.82L7 15" />
              </svg>
              Drop on piece #{draggingPiece?.position + 1}'s cell
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Layout>
  );
}
