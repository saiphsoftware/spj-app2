import { Link } from "wouter";
import { motion } from "framer-motion";

interface Puzzle {
  id: string;
  image: string;
  message: string;
  type: string;
  status: string;
  completionCount: number;
  cut: { type: string; count: number };
  createdBy: { name: string; avatar: string };
  pieces: any[];
}

interface PuzzleCardProps {
  puzzle: Puzzle;
  compact?: boolean;
}

export function PuzzleCard({ puzzle, compact }: PuzzleCardProps) {
  const collectedPieces = puzzle.pieces.filter(p => p.collected?.length > 0).length;
  const progress = puzzle.pieces.length > 0 ? (collectedPieces / puzzle.pieces.length) * 100 : 0;

  if (compact) {
    return (
      <Link href={`/play/${puzzle.id}`}>
        <motion.div
          whileHover={{ scale: 1.03, y: -2 }}
          whileTap={{ scale: 0.97 }}
          className="bg-card border border-card-border rounded-2xl overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
        >
          <div className="aspect-square relative overflow-hidden">
            <img
              src={puzzle.image}
              alt={puzzle.message || "Puzzle"}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${puzzle.id}/200/200`;
              }}
            />
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-muted">
              <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
          <div className="p-2.5">
            <p className="text-xs font-medium text-foreground truncate">{puzzle.message || "Untitled Puzzle"}</p>
            <p className="text-xs text-muted-foreground">{puzzle.cut.count} pieces</p>
          </div>
        </motion.div>
      </Link>
    );
  }

  return (
    <Link href={`/play/${puzzle.id}`}>
      <motion.div
        whileHover={{ scale: 1.02, y: -3 }}
        whileTap={{ scale: 0.98 }}
        className="bg-card border border-card-border rounded-2xl overflow-hidden cursor-pointer hover:shadow-lg transition-all"
      >
        <div className="aspect-video relative overflow-hidden">
          <img
            src={puzzle.image}
            alt={puzzle.message || "Puzzle"}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${puzzle.id}/400/300`;
            }}
          />
          <div className="absolute top-2 right-2 flex gap-1.5">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              puzzle.type === "group"
                ? "bg-secondary text-white"
                : "bg-accent text-foreground"
            }`}>
              {puzzle.type}
            </span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/20">
            <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
        <div className="p-4">
          <h3 className="font-semibold text-foreground text-sm mb-1 line-clamp-1">
            {puzzle.message || "Untitled Puzzle"}
          </h3>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img
                src={puzzle.createdBy.avatar}
                alt={puzzle.createdBy.name}
                className="w-5 h-5 rounded-full"
                onError={(e) => { (e.target as HTMLImageElement).src = "https://api.dicebear.com/7.x/fun-emoji/svg?seed=default"; }}
              />
              <span className="text-xs text-muted-foreground">{puzzle.createdBy.name}</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>{puzzle.cut.count} pcs</span>
              <span>{collectedPieces}/{puzzle.pieces.length} found</span>
            </div>
          </div>
        </div>
      </motion.div>
    </Link>
  );
}
