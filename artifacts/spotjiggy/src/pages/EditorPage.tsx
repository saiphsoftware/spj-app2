import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { motion } from "framer-motion";
import { Layout } from "@/components/Layout";
import { useCreatePuzzle, useGetPuzzle, useUpdatePuzzle, usePublishPuzzle, useDeletePuzzle, getGetPuzzleQueryKey, getGetMyPuzzlesQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { CUT_OPTIONS, getCutDimensions, getTriangleClipPath, type CutType } from "@/lib/puzzleCuts";

export default function EditorPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = id === "new";
  const [, navigate] = useLocation();
  const { isLoggedIn } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [image, setImage] = useState("https://picsum.photos/seed/puzzle1/800/600");
  const [message, setMessage] = useState("");
  const [type, setType] = useState<"solo" | "group">("solo");
  const [cutType, setCutType] = useState<CutType>("rect");
  const [cutCount, setCutCount] = useState(9);
  const [timeLimit, setTimeLimit] = useState<number | null>(null);
  const [pieceMessages, setPieceMessages] = useState<Record<number, string>>({});

  const { data: puzzle } = useGetPuzzle(isNew ? "" : id, {
    query: { enabled: !isNew && !!id, queryKey: getGetPuzzleQueryKey(isNew ? "" : id) },
  });

  useEffect(() => {
    if (puzzle) {
      setImage(puzzle.image);
      setMessage(puzzle.message);
      setType(puzzle.type as "solo" | "group");
      setCutType(puzzle.cut.type as any);
      setCutCount(puzzle.cut.count);
      setTimeLimit(puzzle.timeLimit ?? null);
      setPieceMessages(
        Object.fromEntries(
          puzzle.pieces.map((piece: any) => [piece.position, piece.message ?? ""]),
        ),
      );
    }
  }, [puzzle]);

  const createMutation = useCreatePuzzle({
    mutation: {
      onSuccess: (data) => {
        toast({ title: "Puzzle created!" });
        navigate(`/edit/${data.id}`);
      },
      onError: () => toast({ title: "Failed to create puzzle", variant: "destructive" }),
    },
  });

  const updateMutation = useUpdatePuzzle({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMyPuzzlesQueryKey() });
        toast({ title: "Changes saved!" });
      },
      onError: () => toast({ title: "Failed to save", variant: "destructive" }),
    },
  });

  const publishMutation = usePublishPuzzle({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMyPuzzlesQueryKey() });
        toast({ title: "Puzzle published! Players can now collect pieces." });
        navigate("/");
      },
      onError: () => toast({ title: "Failed to publish", variant: "destructive" }),
    },
  });

  const deleteMutation = useDeletePuzzle({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMyPuzzlesQueryKey() });
        toast({ title: "Draft discarded." });
        navigate("/");
      },
      onError: () => toast({ title: "Could not discard this draft", variant: "destructive" }),
    },
  });

  if (!isLoggedIn) {
    return (
      <Layout>
        <div className="text-center py-20">
          <p className="text-muted-foreground">Please sign in to create puzzles.</p>
        </div>
      </Layout>
    );
  }

  const handleSave = () => {
    if (isNew) {
      createMutation.mutate({
        data: {
          image,
          message,
          type,
          cut: { type: cutType, count: cutCount },
          timeLimit,
          pieceMessages: Array.from({ length: cutCount }, (_, position) => pieceMessages[position] ?? ""),
        },
      });
    } else {
      updateMutation.mutate({
        id,
        data: {
          message,
          timeLimit,
          pieceMessages: Object.entries(pieceMessages).map(([position, value]) => ({
            position: Number(position),
            message: value,
          })),
        },
      });
    }
  };

  const handlePublish = () => {
    if (isNew) {
      toast({ title: "Save the puzzle first", variant: "destructive" });
      return;
    }
    publishMutation.mutate({ id });
  };

  const handleDiscard = () => {
    if (isNew || !id || puzzle?.status !== "pending") return;
    if (!window.confirm("Discard this draft? This cannot be undone.")) return;
    deleteMutation.mutate({ id });
  };

  const { cols, rows } = getCutDimensions(cutType, cutCount);
  const selectedCutOption = CUT_OPTIONS.find((option) => option.type === cutType) ?? CUT_OPTIONS[0];
  const selectedCountIndex = Math.max(0, selectedCutOption.counts.indexOf(cutCount as never));

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{isNew ? "Create Puzzle" : "Edit Puzzle"}</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Configure your puzzle settings</p>
          </div>
          <div className="flex gap-2">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleSave}
              disabled={createMutation.isPending || updateMutation.isPending}
              className="px-4 py-2 border border-border bg-card text-foreground font-medium rounded-xl text-sm hover:bg-muted transition-colors disabled:opacity-50"
            >
              {createMutation.isPending || updateMutation.isPending ? "Saving..." : "Save Draft"}
            </motion.button>
            {!isNew && puzzle?.status === "pending" && (
              <>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleDiscard}
                  disabled={deleteMutation.isPending}
                  className="px-4 py-2 border border-destructive/30 bg-card text-destructive font-medium rounded-xl text-sm hover:bg-destructive/5 transition-colors disabled:opacity-50"
                >
                  {deleteMutation.isPending ? "Discarding..." : "Discard Draft"}
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handlePublish}
                  disabled={publishMutation.isPending || deleteMutation.isPending}
                  className="px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-xl text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {publishMutation.isPending ? "Publishing..." : "Publish"}
                </motion.button>
              </>
            )}
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <div className="space-y-5">
            <div className="bg-card border border-card-border rounded-2xl p-5">
              <h2 className="font-semibold text-foreground mb-4">Puzzle Image</h2>
              <div className="space-y-3">
                <label className="block text-sm font-medium text-foreground">Image URL</label>
                <input
                  type="url"
                  value={image}
                  onChange={e => setImage(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
                <div className="grid grid-cols-3 gap-2">
                  {["nature", "city", "abstract"].map(seed => (
                    <button
                      key={seed}
                      onClick={() => setImage(`https://picsum.photos/seed/${seed}/800/600`)}
                      className="relative aspect-video rounded-lg overflow-hidden border-2 border-transparent hover:border-primary transition-colors"
                    >
                      <img src={`https://picsum.photos/seed/${seed}/200/150`} className="w-full h-full object-cover" />
                      <span className="absolute bottom-1 left-1 text-xs text-white bg-black/50 px-1.5 rounded capitalize">{seed}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-card border border-card-border rounded-2xl p-5">
              <h2 className="font-semibold text-foreground mb-4">Puzzle Settings</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Message</label>
                  <textarea
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    placeholder="Say something about this puzzle..."
                    rows={2}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["solo", "group"] as const).map(t => (
                      <button
                        key={t}
                        onClick={() => setType(t)}
                        className={`py-2.5 rounded-xl text-sm font-medium border transition-all ${
                          type === t
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background border-input text-foreground hover:bg-muted"
                        }`}
                      >
                        {t === "solo" ? "Individual (each player gets all pieces)" : "Group (pieces are shared)"}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    {type === "group" ? "Each piece can only be collected once — players must work together." : "Every player collects their own full set of pieces."}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Piece messages</label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Add a private note that players can open after they acquire that piece.
                  </p>
                  <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                    {Array.from({ length: cutCount }, (_, position) => (
                      <input
                        key={position}
                        type="text"
                        value={pieceMessages[position] ?? ""}
                        onChange={(e) => setPieceMessages((current) => ({
                          ...current,
                          [position]: e.target.value,
                        }))}
                        placeholder={`Piece #${position + 1} note`}
                        aria-label={`Message for piece ${position + 1}`}
                        className="w-full px-3 py-2 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                      />
                    ))}
                  </div>
                </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Cut Style</label>
                    <div className="grid grid-cols-3 gap-2 mb-4">
                      {CUT_OPTIONS.map((option) => (
                        <button
                          key={option.type}
                          onClick={() => {
                            setCutType(option.type);
                            if (isNew) setCutCount(option.defaultCount);
                          }}
                          className={`py-2 rounded-xl text-sm font-medium border transition-all ${
                            cutType === option.type
                              ? "bg-secondary text-white border-secondary"
                              : "bg-background border-input text-foreground hover:bg-muted"
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>

                    {isNew ? (
                      <>
                        <div className="flex items-center justify-between mb-1.5">
                          <label htmlFor="piece-count" className="text-sm font-medium text-foreground">Pieces</label>
                          <span className="text-sm font-bold text-primary">{cutCount}</span>
                        </div>
                        <input
                          id="piece-count"
                          type="range"
                          min={0}
                          max={selectedCutOption.counts.length - 1}
                          step={1}
                          value={selectedCountIndex}
                          onChange={(event) => setCutCount(selectedCutOption.counts[Number(event.target.value)])}
                          className="w-full accent-primary"
                          aria-label={`${selectedCutOption.label} piece count`}
                          aria-valuetext={`${cutCount} pieces`}
                        />
                        <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
                          <span>{selectedCutOption.counts[0]}</span>
                          <span>{selectedCutOption.counts[selectedCutOption.counts.length - 1]}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          {cutType === "rect"
                            ? "Grid layouts stay column-dominant when the count is not square."
                            : cutType === "column"
                            ? "Creates one row of vertical strips."
                            : "Creates alternating up and down triangle pieces."}
                        </p>
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        This draft has {cutCount} pieces. Piece count and cut style are fixed after the puzzle is saved.
                      </p>
                    )}
                  </div>
              </div>
            </div>
          </div>

          <div className="space-y-5">
            <div className="bg-card border border-card-border rounded-2xl p-5">
              <h2 className="font-semibold text-foreground mb-3">Preview</h2>
              <div className="relative aspect-video rounded-xl overflow-hidden bg-muted">
                {image && (
                  <img
                    src={image}
                    alt="Puzzle preview"
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).src = "https://picsum.photos/seed/default/800/600"; }}
                  />
                )}
                {cutType === "broken" ? (
                  <div
                    className="absolute inset-0 grid pointer-events-none"
                    style={{
                      gridTemplateColumns: `repeat(${cols}, 1fr)`,
                      gridTemplateRows: `repeat(${rows}, 1fr)`,
                    }}
                  >
                    {Array.from({ length: cutCount }).map((_, position) => (
                      <div
                        key={position}
                        className="border border-white/70 bg-white/5"
                        style={{ clipPath: getTriangleClipPath(position) }}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="absolute inset-0 pointer-events-none" style={{
                    backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent calc(${100/rows}% - 1px), rgba(255,255,255,0.6) calc(${100/rows}% - 1px), rgba(255,255,255,0.6) ${100/rows}%), repeating-linear-gradient(90deg, transparent, transparent calc(${100/cols}% - 1px), rgba(255,255,255,0.6) calc(${100/cols}% - 1px), rgba(255,255,255,0.6) ${100/cols}%)`,
                  }} />
                )}
              </div>
              <div className="mt-3 flex items-center gap-3 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{cutCount} pieces</span>
                <span>•</span>
                <span className={type === "group" ? "text-secondary font-medium" : "text-accent-foreground font-medium"}>
                  {type} puzzle
                </span>
                <span>•</span>
                <span>{cutType} cut</span>
              </div>
            </div>

            {!isNew && puzzle && (
              <div className="bg-card border border-card-border rounded-2xl p-5">
                <h2 className="font-semibold text-foreground mb-3">Status</h2>
                <div className="flex items-center gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full ${
                    puzzle.status === "open" ? "bg-green-500" :
                    puzzle.status === "pending" ? "bg-accent" : "bg-muted-foreground"
                  }`} />
                  <span className="capitalize font-medium">{puzzle.status}</span>
                </div>
                {puzzle.status === "open" && (
                  <p className="text-sm text-muted-foreground mt-2">
                    {puzzle.pieces.filter((p: any) => p.collected?.length > 0).length} / {puzzle.pieces.length} pieces collected
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
