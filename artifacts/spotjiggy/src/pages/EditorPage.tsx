import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { motion } from "framer-motion";
import { Layout } from "@/components/Layout";
import { useCreatePuzzle, useGetPuzzle, useUpdatePuzzle, usePublishPuzzle, getGetPuzzleQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";

const CUT_OPTIONS = [
  { type: "rect", counts: [4, 9, 16, 25], label: "Grid" },
  { type: "column", counts: [3, 4, 5, 6], label: "Strips" },
  { type: "broken", counts: [9, 16, 25], label: "Jigsaw" },
];

export default function EditorPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = id === "new";
  const [, navigate] = useLocation();
  const { isLoggedIn } = useAuth();
  const { toast } = useToast();

  const [image, setImage] = useState("https://picsum.photos/seed/puzzle1/800/600");
  const [message, setMessage] = useState("");
  const [type, setType] = useState<"solo" | "group">("solo");
  const [cutType, setCutType] = useState<"rect" | "column" | "broken">("rect");
  const [cutCount, setCutCount] = useState(9);
  const [timeLimit, setTimeLimit] = useState<number | null>(null);

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
      onSuccess: () => toast({ title: "Changes saved!" }),
      onError: () => toast({ title: "Failed to save", variant: "destructive" }),
    },
  });

  const publishMutation = usePublishPuzzle({
    mutation: {
      onSuccess: () => {
        toast({ title: "Puzzle published! Players can now collect pieces." });
        navigate("/");
      },
      onError: () => toast({ title: "Failed to publish", variant: "destructive" }),
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
        data: { image, message, type, cut: { type: cutType, count: cutCount }, timeLimit },
      });
    } else {
      updateMutation.mutate({ id, data: { message, timeLimit } });
    }
  };

  const handlePublish = () => {
    if (isNew) {
      toast({ title: "Save the puzzle first", variant: "destructive" });
      return;
    }
    publishMutation.mutate({ id });
  };

  const cols = cutType === "column" ? cutCount : Math.round(Math.sqrt(cutCount));
  const rows = cutType === "column" ? 1 : Math.ceil(cutCount / cols);

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
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handlePublish}
                disabled={publishMutation.isPending}
                className="px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-xl text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {publishMutation.isPending ? "Publishing..." : "Publish"}
              </motion.button>
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
                  <label className="block text-sm font-medium text-foreground mb-2">Cut Style</label>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {CUT_OPTIONS.map(opt => (
                      <button
                        key={opt.type}
                        onClick={() => { setCutType(opt.type as any); setCutCount(opt.counts[1]); }}
                        className={`py-2 rounded-xl text-sm font-medium border transition-all ${
                          cutType === opt.type
                            ? "bg-secondary text-white border-secondary"
                            : "bg-background border-input text-foreground hover:bg-muted"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {CUT_OPTIONS.find(o => o.type === cutType)?.counts.map(c => (
                      <button
                        key={c}
                        onClick={() => setCutCount(c)}
                        className={`px-3 py-1 rounded-lg text-sm border transition-all ${
                          cutCount === c
                            ? "bg-accent text-foreground border-accent font-semibold"
                            : "bg-background border-input hover:bg-muted"
                        }`}
                      >
                        {c} pcs
                      </button>
                    ))}
                  </div>
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
                <div className="absolute inset-0 pointer-events-none" style={{
                  backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent calc(${100/rows}% - 1px), rgba(255,255,255,0.6) calc(${100/rows}% - 1px), rgba(255,255,255,0.6) ${100/rows}%), repeating-linear-gradient(90deg, transparent, transparent calc(${100/cols}% - 1px), rgba(255,255,255,0.6) calc(${100/cols}% - 1px), rgba(255,255,255,0.6) ${100/cols}%)`,
                }} />
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
