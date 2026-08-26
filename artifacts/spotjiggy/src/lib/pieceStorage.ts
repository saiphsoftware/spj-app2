const ACQUIRED_KEY_PREFIX = "spotjiggy:acquired:v2:";

function getAcquiredKey(puzzleId: string) {
  return `${ACQUIRED_KEY_PREFIX}${puzzleId}`;
}

export function loadAcquired(puzzleId: string): Set<string> {
  try {
    const raw = localStorage.getItem(getAcquiredKey(puzzleId));
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

export function saveAcquired(puzzleId: string, ids: Set<string>) {
  localStorage.setItem(getAcquiredKey(puzzleId), JSON.stringify([...ids]));
}

export function addAcquiredPiece(puzzleId: string, pieceId: string) {
  const next = loadAcquired(puzzleId);
  next.add(pieceId);
  saveAcquired(puzzleId, next);
}