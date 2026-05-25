import { useParams, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
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

// ─── localStorage helpers for acquired pieces ────────────────────────────────
function getAcquiredKey(puzzleId: string) {
  return `spotjiggy:acquired:${puzzleId}`;
}
function loadAcquired(puzzleId: string): Set<string> {
  try {
    const raw = localStorage.getItem(getAcquiredKey(puzzleId));
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}
function saveAcquired(puzzleId: string, ids: Set<string>) {
  localStorage.setItem(getAcquiredKey(puzzleId), JSON.stringify([...ids]));
}

// ─── Piece state legend ───────────────────────────────────────────────────────
// State 1 – "acquired + available"  : user has the piece, not yet placed → COLOR, draggable
// State 2 – "not acquired"          : user doesn't hold this piece         → GREY,  locked
// State 3 – "placed / used"         : piece is on the board already        → COLOR + check overlay, locked

type PieceState = "available" | "not-acquired" | "placed";

export default function PlayPage() {
  const { id } = useParams<{ id: string }>();
  const [location] = useLocation();
  const { isLoggedIn } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // pieces the user has "acquired" (in their hand), stored in localStorage
  const [acquired, setAcquired] = useState<Set<string>>(() => loadAcquired(id));
  // pieces placed on the board this session (for the flash animation)
  const [sessionPlaced, setSessionPlaced] = useState<Set<string>>(new Set());

  const [draggingPieceId, setDraggingPieceId] = useState<string | null>(null);
  const [dragOverCell, setDragOverCell] = useState<number | null>(null);
  const [shakingPieceId, setShakingPieceId] = useState<string | null>(null);

  const { data: puzzle, isLoading: puzzleLoading } = useGetPuzzle(id);
  const { data: pieces, isLoading: piecesLoading } = useListPuzzlePieces(id, {
    query: { enabled: !!id },
  });

  // If URL contains ?piece=PIECEID, auto-acquire that piece (simulates visiting a share link)
  useEffect(() => {
    const params = new URLSearchParams(location.split("?")[1] ?? "");
    const pieceId = params.get("piece");
    if (pieceId && !acquired.has(pieceId)) {
      setAcquired((prev) => {
        const next = new Set(prev);
        next.add(pieceId);
        saveAcquired(id, next);
        return next;
      });
      toast({ title: "You received a piece! Drag it onto the board." });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const collectMutation = useCollectPiece({
    mutation: {
      onSuccess: (data) => {
        const pid = data.piece.id;
        // Remove from acquired hand (it's now placed)
        setAcquired((prev) => {
          const next = new Set(prev);
          next.delete(pid);
          saveAcquired(id, next);
          return next;
        });
        // Trigger board flash
        setSessionPlaced((prev) => new Set([...prev, pid]));
        setTimeout(() => {
          setSessionPlaced((prev) => { const n = new Set(prev); n.delete(pid); return n; });
        }, 700);

        queryClient.invalidateQueries({ queryKey: getListPuzzlePiecesQueryKey(id) });
        queryClient.invalidateQueries({ queryKey: getGetPuzzleQueryKey(id) });

        if (data.puzzleCompleted) {
          toast({ title: "Puzzle complete! Congratulations!" });
        } else if (data.badgeAwarded) {
          toast({ title: `Badge earned: ${data.badgeAwarded.name}` });
        } else {
          toast({ title: "Piece placed on the board!" });
        }
      },
      onError: (e: any) => {
        toast({ title: e?.data?.error ?? "Could not place piece", variant: "destructive" });
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
            <div className="bg-muted rounded-2xl h-72" />
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

  const pieceByPosition = new Map<number, any>(allPieces.map((p) => [p.position, p]));

  // Derive piece state
  const getPieceState = (piece: any): PieceState => {
    const isPlaced = (piece.collected?.length ?? 0) > 0; // on the board
    if (isPlaced) return "placed";
    if (acquired.has(piece.id)) return "available";
    return "not-acquired";
  };

  const placedCount = allPieces.filter((p) => getPieceState(p) === "placed").length;
  const availableCount = allPieces.filter((p) => getPieceState(p) === "available").length;
  const progress = allPieces.length > 0 ? (placedCount / allPieces.length) * 100 : 0;

  const bgSize = `${cols * 100}% ${rows * 100}%`;
  const bgPos = (col: number, row: number) => {
    const x = cols > 1 ? (col / (cols - 1)) * 100 : 0;
    const y = rows > 1 ? (row / (rows - 1)) * 100 : 0;
    return `${x}% ${y}%`;
  };

  // Demo helper: click a "not-acquired" piece to acquire it (simulates visiting share link)
  const handleAcquire = (piece: any) => {
    if (!isLoggedIn) { toast({ title: "Sign in first", variant: "destructive" }); return; }
    setAcquired((prev) => {
      const next = new Set(prev);
      next.add(piece.id);
      saveAcquired(id, next);
      return next;
    });
    toast({ title: `Piece #${piece.position + 1} added to your hand!` });
  };

  const handleDrop = (cellIdx: number) => {
    setDragOverCell(null);
    if (!draggingPieceId) return;
    if (!isLoggedIn) { toast({ title: "Sign in to place pieces", variant: "destructive" }); return; }

    const piece = allPieces.find((p) => p.id === draggingPieceId);
    setDraggingPieceId(null);
    if (!piece) return;

    if (piece.position !== cellIdx) {
      setShakingPieceId(piece.id);
      setTimeout(() => setShakingPieceId(null), 500);
      toast({ title: "Wrong cell! Find the matching spot.", variant: "destructive" });
      return;
    }
    collectMutation.mutate({ id: piece.id });
  };

  const handleShare = (piece: any) => {
    const url = `${window.location.origin}/play/${id}?piece=${piece.id}`;
    navigator.clipboard.writeText(url).then(() => toast({ title: "Piece link copied!" }));
  };

  const draggingPiece = allPieces.find((p) => p.id === draggingPieceId);

  return (
    <Layout>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
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
            <div className="text-right shrink-0 ml-4">
              <p className="tabular-nums">
                <span className="text-3xl font-bold text-foreground">{placedCount}</span>
                <span className="text-muted-foreground text-base">/{allPieces.length}</span>
              </p>
              <p className="text-xs text-muted-foreground">placed on board</p>
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
                ? "Drag a piece from your hand and drop it onto its matching cell"
                : placedCount === allPieces.length
                ? "Puzzle complete!"
                : "Collect pieces via share links to fill the board"}
            </p>

            <div
              className="relative rounded-xl overflow-hidden select-none"
              style={{ aspectRatio: `${cols}/${rows}` }}
            >
              {/* Greyscale base */}
              <img
                src={puzzle.image}
                alt={puzzle.message}
                className="absolute inset-0 w-full h-full object-cover grayscale"
                onError={(e) => { (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${id}/800/600`; }}
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
                  const state = piece ? getPieceState(piece) : "not-acquired";
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
                      {/* Color reveal for placed pieces */}
                      <AnimatePresence>
                        {state === "placed" && (
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

                      {/* Flash on place */}
                      <AnimatePresence>
                        {isFlashing && (
                          <motion.div
                            key={`flash-${cellIdx}`}
                            initial={{ opacity: 0.9 }}
                            animate={{ opacity: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.6 }}
                            className="absolute inset-0 bg-white pointer-events-none"
                          />
                        )}
                      </AnimatePresence>

                      {/* Drop highlight */}
                      {isOver && state !== "placed" && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className={`absolute inset-0 border-2 ${
                            canAccept
                              ? "border-primary bg-primary/30"
                              : "border-white/30 bg-white/10"
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
              <h2 className="font-semibold text-foreground text-sm">Pieces</h2>
              <span className="text-xs text-muted-foreground">{availableCount} in hand</span>
            </div>

            {/* Legend */}
            <div className="grid grid-cols-1 gap-1 text-[10px] py-1.5 px-2 bg-muted rounded-lg">
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-sm bg-gradient-to-br from-primary/80 to-secondary/80" />
                <span className="text-muted-foreground">In your hand — drag to board</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-sm bg-muted-foreground/20 border border-dashed border-muted-foreground/40" />
                <span className="text-muted-foreground">Not acquired yet</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-sm bg-green-500/70 relative">
                  <svg className="absolute inset-0 m-auto" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5"><polyline points="20 6 9 17 4 12"/></svg>
                </span>
                <span className="text-muted-foreground">Placed on board</span>
              </span>
            </div>

            <div className="grid grid-cols-3 lg:grid-cols-2 gap-2">
              {allPieces.map((piece: any) => {
                const col = piece.position % cols;
                const row = Math.floor(piece.position / cols);
                const state = getPieceState(piece);
                const isShaking = shakingPieceId === piece.id;
                const isDragging = draggingPieceId === piece.id;

                return (
                  <motion.div
                    key={piece.id}
                    animate={isShaking ? { x: [0, -7, 7, -5, 5, 0] } : { x: 0 }}
                    transition={{ duration: 0.4 }}
                    draggable={state === "available" && isLoggedIn}
                    onDragStart={(e) => {
                      if (state !== "available" || !isLoggedIn) { e.preventDefault(); return; }
                      setDraggingPieceId(piece.id);
                      const el = e.currentTarget as HTMLElement;
                      const ghost = el.cloneNode(true) as HTMLElement;
                      ghost.style.cssText = "position:fixed;top:-9999px;width:80px;height:80px;border-radius:10px;overflow:hidden;";
                      document.body.appendChild(ghost);
                      (e as any).dataTransfer.setDragImage(ghost, 40, 40);
                      setTimeout(() => ghost.remove(), 0);
                    }}
                    onDragEnd={() => { setDraggingPieceId(null); setDragOverCell(null); }}
                    onClick={() => {
                      if (state === "not-acquired") handleAcquire(piece);
                    }}
                    className={`relative aspect-square rounded-xl overflow-hidden border-2 select-none transition-all duration-200 ${
                      state === "available" && isLoggedIn
                        ? isDragging
                          ? "border-primary opacity-40 scale-95 cursor-grabbing"
                          : "border-primary/50 hover:border-primary hover:shadow-lg hover:scale-105 cursor-grab ring-1 ring-primary/20"
                        : state === "placed"
                        ? "border-green-500/50 cursor-default opacity-80"
                        : "border-dashed border-muted-foreground/30 opacity-50 cursor-pointer hover:opacity-70"
                    }`}
                    title={
                      state === "available"
                        ? `Piece #${piece.position + 1} — drag to its matching cell`
                        : state === "placed"
                        ? `Piece #${piece.position + 1} — placed on board`
                        : `Piece #${piece.position + 1} — click to acquire (demo)`
                    }
                  >
                    {/* ── Image layer ── */}
                    {state === "not-acquired" ? (
                      /* Grey silhouette only */
                      <div
                        className="absolute inset-0 grayscale opacity-60"
                        style={{
                          backgroundImage: `url(${puzzle.image})`,
                          backgroundSize: bgSize,
                          backgroundPosition: bgPos(col, row),
                          backgroundRepeat: "no-repeat",
                        }}
                      />
                    ) : (
                      /* Full color for available + placed */
                      <div
                        className="absolute inset-0"
                        style={{
                          backgroundImage: `url(${puzzle.image})`,
                          backgroundSize: bgSize,
                          backgroundPosition: bgPos(col, row),
                          backgroundRepeat: "no-repeat",
                        }}
                      />
                    )}

                    {/* ── State overlays ── */}

                    {/* Not acquired: dashed question mark */}
                    {state === "not-acquired" && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2">
                          <circle cx="12" cy="12" r="10"/>
                          <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3M12 17h.01"/>
                        </svg>
                      </div>
                    )}

                    {/* Placed: green overlay with checkmark */}
                    {state === "placed" && (
                      <div className="absolute inset-0 flex items-center justify-center bg-green-500/25">
                        <div className="w-6 h-6 rounded-full bg-green-500/90 flex items-center justify-center shadow-sm">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </div>
                      </div>
                    )}

                    {/* Available: subtle shine border to indicate interactivity */}
                    {state === "available" && !isDragging && (
                      <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />
                    )}

                    {/* Piece number badge */}
                    <div className={`absolute bottom-0 left-0 right-0 text-center text-[9px] font-semibold leading-4 ${
                      state === "available" ? "bg-primary/80 text-white"
                      : state === "placed" ? "bg-green-600/80 text-white"
                      : "bg-black/25 text-white/60"
                    }`}>
                      #{piece.position + 1}
                    </div>

                    {/* Share button on placed pieces */}
                    {state === "placed" && (
                      <button
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity z-10"
                        onClick={(e) => { e.stopPropagation(); handleShare(piece); }}
                        title="Share this piece"
                      >
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                          <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13"/>
                        </svg>
                      </button>
                    )}
                  </motion.div>
                );
              })}
            </div>

            {!isLoggedIn && (
              <p className="text-xs text-center text-muted-foreground mt-2 px-2">
                <a href="/login" className="text-primary font-medium hover:underline">Sign in</a> to place pieces
              </p>
            )}
          </div>
        </div>

        {/* Floating hint while dragging */}
        <AnimatePresence>
          {draggingPieceId && draggingPiece && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-foreground text-background text-sm font-medium px-5 py-2.5 rounded-full shadow-2xl z-50 flex items-center gap-2 pointer-events-none"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M18 11V6a2 2 0 00-2-2v0a2 2 0 00-2 2v0M14 10V4a2 2 0 00-2-2v0a2 2 0 00-2 2v0M10 10.5V6a2 2 0 00-2-2v0a2 2 0 00-2 2v6"/>
                <path d="M18 11a2 2 0 114 0v3a8 8 0 01-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 012.83-2.82L7 15"/>
              </svg>
              Piece #{draggingPiece.position + 1} — drop on cell #{draggingPiece.position + 1}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Layout>
  );
}
