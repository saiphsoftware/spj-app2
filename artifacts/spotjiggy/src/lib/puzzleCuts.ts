export type CutType = "rect" | "column" | "broken";

export const CUT_OPTIONS = [
  { type: "rect", counts: [4, 6, 9, 12, 16, 20], defaultCount: 9, label: "Grid" },
  { type: "column", counts: Array.from({ length: 12 }, (_, index) => index + 3), defaultCount: 3, label: "Column" },
  { type: "broken", counts: Array.from({ length: 6 }, (_, index) => index + 5), defaultCount: 5, label: "Jigsaw" },
] as const;

export function getCutDimensions(type: CutType, count: number) {
  if (type === "column") {
    return { cols: count, rows: 1 };
  }

  const cols = Math.ceil(Math.sqrt(count));
  return { cols, rows: Math.ceil(count / cols) };
}

export function getTriangleClipPath(position: number) {
  return position % 2 === 0
    ? "polygon(50% 0%, 100% 100%, 0% 100%)"
    : "polygon(0% 0%, 100% 0%, 50% 100%)";
}