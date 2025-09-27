export function pageToOffset(page: any, limit: any) {
  const p = Math.max(1, Number(page ?? 1));
  const l = Math.max(1, Math.min(200, Number(limit ?? 20)));
  return { page: p, limit: l, offset: (p - 1) * l };
}
