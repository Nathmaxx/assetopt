export function computeSavedPercent(savedBytes: number, totalBytes: number): number {
  if (totalBytes <= 0) return 0;
  return Math.round((savedBytes / totalBytes) * 10000) / 100;
}
