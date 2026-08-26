import { motion } from "framer-motion";
import { Link, useLocation } from "wouter";
import { Layout } from "@/components/Layout";
import { useBucket, type BucketPiece } from "@/context/BucketContext";
import { useToast } from "@/hooks/use-toast";

export default function BucketPage() {
  const [, navigate] = useLocation();
  const { pieces, movePieceToPuzzle } = useBucket();
  const { toast } = useToast();

  const handleAddToPuzzle = (piece: BucketPiece) => {
    movePieceToPuzzle(piece);
    toast({
      title: `Piece #${piece.position + 1} added to your puzzle`,
      description: "Drag it from your hand onto the matching spot.",
    });
    navigate(`/play/${piece.puzzleId}?from=bucket&piece=${piece.id}`);
  };

  return (
    <Layout>
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-end justify-between gap-4 mb-8"
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary mb-2">Your collection</p>
            <h1 className="text-3xl font-bold text-foreground">Bucket</h1>
            <p className="text-muted-foreground mt-1">Pieces people have sent you, ready to add to a puzzle.</p>
          </div>
          <span className="shrink-0 rounded-full bg-primary/10 text-primary px-3 py-1.5 text-sm font-semibold">
            {pieces.length} {pieces.length === 1 ? "piece" : "pieces"}
          </span>
        </motion.div>

        {pieces.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl border border-card-border bg-card p-10 text-center"
          >
            <div className="w-16 h-16 rounded-2xl bg-muted mx-auto mb-5 flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-foreground">Your Bucket is empty</h2>
            <p className="text-muted-foreground mt-2 max-w-sm mx-auto">
              When someone sends you a puzzle-piece link, it will appear here before you add it to your hand.
            </p>
            <Link href="/">
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="mt-6 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm"
              >
                Browse puzzles
              </motion.button>
            </Link>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {pieces.map((piece, index) => (
              <motion.button
                key={piece.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                whileHover={{ y: -4 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleAddToPuzzle(piece)}
                className="text-left overflow-hidden rounded-2xl border border-card-border bg-card shadow-sm hover:shadow-lg transition-shadow"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                  <img
                    src={piece.pieceImage || piece.puzzleImage}
                    alt={`Piece #${piece.position + 1} from ${piece.puzzleTitle}`}
                    className="absolute inset-0 w-full h-full object-cover"
                    onError={(event) => {
                      (event.currentTarget as HTMLImageElement).src = piece.puzzleImage;
                    }}
                  />
                  <span className="absolute top-3 left-3 rounded-full bg-foreground/80 text-background px-2.5 py-1 text-xs font-bold">
                    #{piece.position + 1}
                  </span>
                  <span className="absolute bottom-3 right-3 rounded-full bg-primary text-primary-foreground px-3 py-1.5 text-xs font-bold shadow-lg">
                    Add to puzzle
                  </span>
                </div>
                <div className="p-4">
                  <p className="font-semibold text-foreground truncate">{piece.puzzleTitle}</p>
                  <p className="text-xs text-muted-foreground mt-1">Click to move this piece to your hand</p>
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}