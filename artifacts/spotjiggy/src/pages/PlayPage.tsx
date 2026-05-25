import { useParams } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useRef, useCallback } from "react";
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
  const [justPlaced, setJustPlaced] = useState<Set<string>>(new Set());
  const [shakingPieceId, setShakingPieceId] = useState<string | null>(null);

  const { data: puzzle, isLoading: puzzleLoading } = useGetPuzzle(id);
  const { data: pieces, isLoading: piecesLoading } = useListPuzzlePieces(id, {
    query: { enabled: !!id },
  });

  const collectMutation = useCollectPiece({
    mutation: {
      onSuccess: (data) => {
        setJustPlaced((prev) => new Set([...prev, data.piece.id]));
        setTimeout(() => {
          setJustPlaced((prev) => {
            const next = new Set(prev);
            next.delete(data.piece.id);
            return next;
          });
        }, 800);
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
        <div className="max-w-5xl mx-auto">
          <div className="h-8 w-64 bg-card rounded-xl border border-card-border animate-pulse mb-2" />
          <div className="h-4 w-32 bg-muted rounded-lg animate-pulse mb-6" />
          <div className="aspect-video bg-card rounded-2xl border border-card-border animate-pulse mb-6" />
          <div className="grid grid-cols-8 gap-2">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="aspect-square bg-card rounded-xl animate-pulse" />
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
  const cols =
    puzzle.cut.type === "column"
      ? puzzle.cut.count
      : Math.round(Math.sqrt(puzzle.cut.count));
  const rows =
    puzzle.cut.type === "column" ? 1 : Math.ceil(puzzle.cut.count / cols);

  const pieceByPosition = new Map<number, any>(
    allPieces.map((p: any) => [p.position, p])
  );

  const isCollected = (piece: any) => (piece.collected?.length ?? 0) > 0;
  const collectedCount = allPieces.filter(isCollected).length;
  const progress =
    allPieces.length > 0 ? (collectedCount / allPieces.length) * 100 : 0;

  const trayPieces = allPieces.filter((p: any) => !isCollected(p));

  const bgSize = `${cols * 100}% ${rows * 100}%`;
  const bgPos = (col: number, row: number) => {
    const x = cols > 1 ? (col / (cols - 1)) * 100 : 0;
    const y = rows > 1 ? (row / (rows - 1)) * 100 : 0;
    return `${x}% ${y}%`;
  };

  const handleDrop = (cellIndex: number) => {
    setDragOverCell(null);
    if (!draggingPieceId || !isLoggedIn) return;

    const piece = allPieces.find((p: any) => p.id === draggingPieceId);
    if (!piece) return;

    if (piece.position !== cellIndex) {
      setShakingPieceId(draggingPieceId);
      setTimeout(() => setShakingPieceId(null), 500);
      toast({ title: "Wrong spot! Try the correct cell.", variant: "destructive" });
      setDraggingPieceId(null);
      return;
    }

    collectMutation.mutate({ id: draggingPieceId });
    setDraggingPieceId(null);
  };

  const handleShare = (piece: any) => {
    const url = `${window.location.origin}/play/${id}?piece=${piece.id}`;
    navigator.clipboard.writeText(url).then(() =>
      toast({ title: "Piece link copied!" })
    );
  };

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
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      "https://api.dicebear.com/7.x/fun-emoji/svg?seed=default";
                  }}
                />
                <span className="text-sm text-muted-foreground">
                  by {puzzle.createdBy.name}
                </span>
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    puzzle.type === "group"
                      ? "bg-secondary/20 text-secondary"
                      : "bg-accent/30 text-foreground"
                  }`}
                >
                  {puzzle.type}
                </span>
              </div>
            </div>
            <div className="text-right shrink-0 ml-4">
              <span className="text-3xl font-bold text-foreground tabular-nums">
                {collectedCount}
              </span>
              <span className="text-muted-foreground text-sm">
                /{allPieces.length}
              </span>
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
            <p className="text-xs text-muted-foreground mb-2 text-center">
              {trayPieces.length > 0
                ? "Drag a piece from the tray and drop it on the matching cell"
                : "All pieces placed!"}
            </p>
            <div
              className="relative rounded-xl overflow-hidden select-none"
              style={{ aspectRatio: `${cols}/${rows}` }}
            >
              {/* Greyscale base image */}
              <img
                src={puzzle.image}
                alt={puzzle.message}
                className="absolute inset-0 w-full h-full object-cover grayscale"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${id}/800/600`;
                }}
              />

              {/* Grid of cells */}
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
                  const collected = piece && isCollected(piece);
                  const isOver = dragOverCell === cellIdx;
                  const isJust = piece && justPlaced.has(piece.id);
                  const canAccept =
                    draggingPieceId &&
                    allPieces.find((p: any) => p.id === draggingPieceId)
                      ?.position === cellIdx;

                  return (
                    <div
                      key={cellIdx}
                      className="relative border border-white/15"
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragOverCell(cellIdx);
                      }}
                      onDragLeave={(e) => {
                        if (!e.currentTarget.contains(e.relatedTarget as Node))
                          setDragOverCell(null);
                      }}
                      onDrop={() => handleDrop(cellIdx)}
                    >
                      {/* Colored image layer for collected pieces */}
                      <AnimatePresence>
                        {collected && (
                          <motion.div
                            key={`collected-${cellIdx}`}
                            initial={isJust ? { opacity: 0, scale: 1.12 } : { opacity: 1 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.4, ease: "easeOut" }}
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

                      {/* Drop highlight */}
                      {isOver && !collected && (
                        <div
                          className={`absolute inset-0 border-2 transition-colors ${
                            canAccept
                              ? "border-primary bg-primary/25"
                              : "border-destructive/60 bg-destructive/10"
                          }`}
                        />
                      )}

                      {/* "Just placed" flash */}
                      <AnimatePresence>
                        {isJust && (
                          <motion.div
                            key={`flash-${cellIdx}`}
                            initial={{ opacity: 0.7 }}
                            animate={{ opacity: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.7 }}
                            className="absolute inset-0 bg-white pointer-events-none"
                          />
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>

              {/* Subtle vignette */}
              {progress === 100 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="absolute inset-0 ring-4 ring-primary/50 ring-inset rounded-xl pointer-events-none"
                />
              )}
            </div>
          </div>

          {/* ── PIECE TRAY ── */}
          <div className="bg-card border border-card-border rounded-2xl p-3 flex flex-col">
            <h2 className="font-semibold text-foreground text-sm mb-1">
              Your Pieces
            </h2>
            <p className="text-xs text-muted-foreground mb-3">
              {trayPieces.length === 0
                ? "No pieces left to place"
                : `${trayPieces.length} remaining — drag to board`}
            </p>

            {trayPieces.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-4">
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-2">
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#22c55e"
                    strokeWidth="2.5"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-foreground">All placed!</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 lg:grid-cols-2 gap-2 overflow-y-auto">
                {trayPieces.map((piece: any) => {
                  const col = piece.position % cols;
                  const row = Math.floor(piece.position / cols);
                  const isShaking = shakingPieceId === piece.id;
                  const isDragging = draggingPieceId === piece.id;

                  return (
                    <motion.div
                      key={piece.id}
                      animate={
                        isShaking
                          ? { x: [0, -6, 6, -4, 4, 0] }
                          : { x: 0 }
                      }
                      transition={{ duration: 0.4 }}
                      draggable
                      onDragStart={(e) => {
                        setDraggingPieceId(piece.id);
                        const el = e.currentTarget as HTMLElement;
                        const ghost = el.cloneNode(true) as HTMLElement;
                        ghost.style.position = "fixed";
                        ghost.style.top = "-9999px";
                        document.body.appendChild(ghost);
                        (e as any).dataTransfer.setDragImage(ghost, el.offsetWidth / 2, el.offsetHeight / 2);
                        setTimeout(() => ghost.remove(), 0);
                      }}
                      onDragEnd={() => {
                        setDraggingPieceId(null);
                        setDragOverCell(null);
                      }}
                      className={`relative aspect-square rounded-lg overflow-hidden border-2 cursor-grab active:cursor-grabbing transition-all select-none ${
                        isDragging
                          ? "border-primary opacity-50 scale-95"
                          : "border-border hover:border-primary/60 hover:shadow-md"
                      }`}
                      title={`Piece #${piece.position + 1} — drag to its matching cell`}
                    >
                      <div
                        className="absolute inset-0 grayscale hover:grayscale-0 transition-all duration-300"
                        style={{
                          backgroundImage: `url(${puzzle.image})`,
                          backgroundSize: bgSize,
                          backgroundPosition: bgPos(col, row),
                          backgroundRepeat: "no-repeat",
                        }}
                      />
                      <div className="absolute bottom-0 left-0 right-0 text-center text-[9px] text-white/80 bg-black/30 leading-4">
                        #{piece.position + 1}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* Collected pieces summary */}
            {collectedCount > 0 && (
              <div className="mt-3 pt-3 border-t border-border">
                <p className="text-xs text-muted-foreground mb-2 font-medium">
                  Placed ({collectedCount})
                </p>
                <div className="grid grid-cols-4 lg:grid-cols-3 gap-1">
                  {allPieces
                    .filter(isCollected)
                    .map((piece: any) => {
                      const col = piece.position % cols;
                      const row = Math.floor(piece.position / cols);
                      return (
                        <div
                          key={piece.id}
                          className="relative aspect-square rounded-md overflow-hidden border border-primary/30 cursor-pointer group"
                          title={`Share piece #${piece.position + 1}`}
                          onClick={() => handleShare(piece)}
                        >
                          <div
                            className="absolute inset-0"
                            style={{
                              backgroundImage: `url(${puzzle.image})`,
                              backgroundSize: bgSize,
                              backgroundPosition: bgPos(col, row),
                              backgroundRepeat: "no-repeat",
                            }}
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                              <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" />
                            </svg>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Hint bar when dragging */}
        <AnimatePresence>
          {draggingPieceId && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-foreground text-background text-sm font-medium px-5 py-2.5 rounded-full shadow-xl z-50 flex items-center gap-2"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 11V6a2 2 0 00-2-2v0a2 2 0 00-2 2v0M14 10V4a2 2 0 00-2-2v0a2 2 0 00-2 2v0M10 10.5V6a2 2 0 00-2-2v0a2 2 0 00-2 2v6" />
                <path d="M18 11a2 2 0 114 0v3a8 8 0 01-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 012.83-2.82L7 15" />
              </svg>
              Drop on the glowing cell to place this piece
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Layout>
  );
}
