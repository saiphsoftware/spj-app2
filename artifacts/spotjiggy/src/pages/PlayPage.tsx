import { useParams, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import { Layout } from "@/components/Layout";
import {
  useGetPuzzle,
  useListPuzzlePieces,
  useCollectPiece,
  getListPuzzlePiecesQueryKey,
  getGetPuzzleQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { useBucket } from "@/context/BucketContext";
import { addAcquiredPiece, loadAcquired, saveAcquired } from "@/lib/pieceStorage";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { getCutDimensions, getTriangleClipPath } from "@/lib/puzzleCuts";

// ─── Piece state legend ───────────────────────────────────────────────────────
// State 1 – "acquired + available"  : user has the piece, not yet placed → COLOR, draggable
// State 2 – "not acquired"          : user doesn't hold this piece         → GREY,  locked
// State 3 – "placed / used"         : piece is on the board already        → COLOR + check overlay, locked

type PieceState = "available" | "not-acquired" | "placed";

export default function PlayPage() {
  const { id } = useParams<{ id: string }>();
  const [location] = useLocation();
  const { isLoggedIn } = useAuth();
  const { addPiece: addToBucket } = useBucket();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // pieces the user has "acquired" (in their hand), stored in localStorage
  const [acquired, setAcquired] = useState<Set<string>>(() => loadAcquired(id));
  // pieces placed on the board this session (for the flash animation)
  const [sessionPlaced, setSessionPlaced] = useState<Set<string>>(new Set());

  const [draggingPieceId, setDraggingPieceId] = useState<string | null>(null);
  const [dragOverCell, setDragOverCell] = useState<number | null>(null);
  const [shakingPieceId, setShakingPieceId] = useState<string | null>(null);
  const [selectedMessagePiece, setSelectedMessagePiece] = useState<any | null>(null);
  const handledLinkRef = useRef<string | null>(null);

  const { data: puzzle, isLoading: puzzleLoading } = useGetPuzzle(id);
  const { data: pieces, isLoading: piecesLoading } = useListPuzzlePieces(id, {
    query: { enabled: !!id, queryKey: getListPuzzlePiecesQueryKey(id) },
  });

  // A share link delivers a piece to the Bucket. It never adds the piece directly
  // to the puzzle hand, and it never makes a board-view piece clickable to acquire.
  useEffect(() => {
    const params = new URLSearchParams(location.split("?")[1] ?? "");
    const pieceId = params.get("piece");
    const fromBucket = params.get("from") === "bucket";
    if (!pieceId || !pieces || !puzzle || handledLinkRef.current === `${fromBucket}:${pieceId}`) return;

    const piece = pieces.find((item: any) => item.id === pieceId);
    handledLinkRef.current = `${fromBucket}:${pieceId}`;
    if (!piece) {
      toast({ title: "That piece link is no longer valid.", variant: "destructive" });
      return;
    }

    if (fromBucket) {
      if (!acquired.has(pieceId)) {
        addAcquiredPiece(id, pieceId);
        setAcquired((prev) => new Set([...prev, pieceId]));
        toast({
          title: `Piece #${piece.position + 1} added to your puzzle`,
          description: "Drag it from your hand onto the matching spot.",
        });
      }
      return;
    }

    if ((piece.collected?.length ?? 0) > 0) {
      toast({ title: "That piece has already been used." });
      return;
    }

    if (acquired.has(pieceId)) {
      toast({ title: "That piece is already in your puzzle hand." });
      return;
    }

    addToBucket({
      id: piece.id,
      puzzleId: id,
      puzzleTitle: puzzle.message || "Untitled Puzzle",
      puzzleImage: puzzle.image,
      pieceImage: piece.image || puzzle.image,
      position: piece.position,
      addedAt: Date.now(),
    });
    toast({
      title: `Piece #${piece.position + 1} added to your Bucket`,
      description: "Open Bucket to add it to this puzzle.",
    });
  }, [acquired, addToBucket, id, isLoggedIn, location, pieces, puzzle, toast]);

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
  const { cols, rows } = getCutDimensions(puzzle.cut.type, puzzle.cut.count);
  const isTriangleCut = puzzle.cut.type === "broken";

  const pieceByPosition = new Map<number, any>(allPieces.map((p) => [p.position, p]));

  // Derive piece state
  const getPieceState = (piece: any): PieceState => {
    const isPlaced = (piece.collected?.length ?? 0) > 0; // on the board
    if (isPlaced) return "placed";
    if (acquired.has(piece.id)) return "available";
    return "not-acquired";
  };

  const canReadPieceMessage = (piece: any) =>
    !!piece?.message &&
    (acquired.has(piece.id) || (piece.collected ?? []).some((collection: any) => collection.by?.sub === getCurrentUserSub()));

  const getCurrentUserSub = () => {
    try {
      const token = localStorage.getItem("spotjiggy_token");
      return token ? atob(token).split(":")[0] : null;
    } catch {
      return null;
    }
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
                {Array.from({ length: puzzle.cut.count }).map((_, cellIdx) => {
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
                      className={`relative border border-white/10 ${isTriangleCut ? "bg-black/5" : ""}`}
                      style={{ clipPath: isTriangleCut ? getTriangleClipPath(cellIdx) : undefined }}
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
                               clipPath: isTriangleCut ? getTriangleClipPath(cellIdx) : undefined,
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

                       {piece && canReadPieceMessage(piece) && (
                         <button
                           type="button"
                           onClick={(e) => { e.stopPropagation(); setSelectedMessagePiece(piece); }}
                           className={`absolute z-10 flex h-7 w-7 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-md ring-2 ring-white/80 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary ${
                             isTriangleCut
                               ? "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                               : "right-1 top-1"
                           }`}
                           title="Open piece message"
                           aria-label={`Open message for piece ${piece.position + 1}`}
                         >
                           <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                             <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7A8.38 8.38 0 0 1 4 11.5a8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" />
                             <path d="M8 12h.01M12 12h.01M16 12h.01" />
                           </svg>
                         </button>
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
                    className={`relative aspect-square overflow-hidden border-2 select-none transition-all duration-200 ${
                      state === "available" && isLoggedIn
                        ? isDragging
                          ? "border-primary opacity-40 scale-95 cursor-grabbing"
                          : "border-primary/50 hover:border-primary hover:shadow-lg hover:scale-105 cursor-grab ring-1 ring-primary/20"
                        : state === "placed"
                        ? "border-green-500/50 cursor-default opacity-80"
                         : "border-dashed border-muted-foreground/30 opacity-50 cursor-default"
                    } ${isTriangleCut ? "rounded-none" : "rounded-xl"}`}
                    style={{ clipPath: isTriangleCut ? getTriangleClipPath(piece.position) : undefined }}
                    title={
                      state === "available"
                        ? `Piece #${piece.position + 1} — drag to its matching cell`
                        : state === "placed"
                        ? `Piece #${piece.position + 1} — placed on board`
                         : `Piece #${piece.position + 1} — get this piece from a share link`
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
                          clipPath: isTriangleCut ? getTriangleClipPath(piece.position) : undefined,
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
                          clipPath: isTriangleCut ? getTriangleClipPath(piece.position) : undefined,
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

                    {/* Every piece can be sent by link; clicking this control never acquires it. */}
                    {(
                      <button
                        className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/45 flex items-center justify-center opacity-0 hover:opacity-100 focus:opacity-100 transition-opacity z-10"
                        onClick={(e) => { e.stopPropagation(); handleShare(piece); }}
                        title="Copy share link for this piece"
                        aria-label={`Copy share link for piece ${piece.position + 1}`}
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.3">
                          <circle cx="18" cy="5" r="3"/>
                          <circle cx="6" cy="12" r="3"/>
                          <circle cx="18" cy="19" r="3"/>
                          <path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>
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

        {selectedMessagePiece && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            role="presentation"
            onClick={() => setSelectedMessagePiece(null)}
          >
            <div
              className="relative w-full max-w-md rounded-2xl border border-card-border bg-card p-6 shadow-2xl"
              role="dialog"
              aria-modal="true"
              aria-labelledby="piece-message-title"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setSelectedMessagePiece(null)}
                className="absolute right-4 top-4 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                aria-label="Close piece message"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
              <h2 id="piece-message-title" className="pr-8 text-lg font-semibold text-foreground">
                Message for piece #{selectedMessagePiece.position + 1}
              </h2>
              <p className="mt-3 whitespace-pre-wrap text-base leading-relaxed text-foreground">
                {selectedMessagePiece.message}
              </p>
            </div>
          </div>
        )}

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
