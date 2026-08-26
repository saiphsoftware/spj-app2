import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { addAcquiredPiece } from "@/lib/pieceStorage";

export interface BucketPiece {
  id: string;
  puzzleId: string;
  puzzleTitle: string;
  puzzleImage: string;
  pieceImage: string;
  position: number;
  addedAt: number;
}

interface BucketContextValue {
  pieces: BucketPiece[];
  addPiece: (piece: BucketPiece) => void;
  removePiece: (pieceId: string) => void;
  movePieceToPuzzle: (piece: BucketPiece) => void;
}

const BUCKET_STORAGE_KEY = "spotjiggy:bucket:v1";
const BUCKET_CHANGED_EVENT = "spotjiggy:bucket-changed";

const BucketContext = createContext<BucketContextValue | undefined>(undefined);

function loadBucket(): BucketPiece[] {
  try {
    const raw = localStorage.getItem(BUCKET_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as BucketPiece[]) : [];
  } catch {
    return [];
  }
}

function persistBucket(pieces: BucketPiece[]) {
  localStorage.setItem(BUCKET_STORAGE_KEY, JSON.stringify(pieces));
  window.dispatchEvent(new Event(BUCKET_CHANGED_EVENT));
}

export function BucketProvider({ children }: { children: ReactNode }) {
  const [pieces, setPieces] = useState<BucketPiece[]>(loadBucket);

  useEffect(() => {
    const syncBucket = () => setPieces(loadBucket());
    window.addEventListener("storage", syncBucket);
    window.addEventListener(BUCKET_CHANGED_EVENT, syncBucket);
    return () => {
      window.removeEventListener("storage", syncBucket);
      window.removeEventListener(BUCKET_CHANGED_EVENT, syncBucket);
    };
  }, []);

  const addPiece = useCallback((piece: BucketPiece) => {
    setPieces((current) => {
      if (current.some((item) => item.id === piece.id)) return current;
      const next = [piece, ...current];
      persistBucket(next);
      return next;
    });
  }, []);

  const removePiece = useCallback((pieceId: string) => {
    setPieces((current) => {
      const next = current.filter((piece) => piece.id !== pieceId);
      persistBucket(next);
      return next;
    });
  }, []);

  const movePieceToPuzzle = useCallback((piece: BucketPiece) => {
    addAcquiredPiece(piece.puzzleId, piece.id);
    setPieces((current) => {
      const next = current.filter((item) => item.id !== piece.id);
      persistBucket(next);
      return next;
    });
  }, []);

  return (
    <BucketContext.Provider value={{ pieces, addPiece, removePiece, movePieceToPuzzle }}>
      {children}
    </BucketContext.Provider>
  );
}

export function useBucket() {
  const context = useContext(BucketContext);
  if (!context) throw new Error("useBucket must be used inside BucketProvider");
  return context;
}