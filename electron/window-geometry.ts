export type Bounds = { x: number; y: number; width: number; height: number };
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));

// Electron bounds use desktop coordinates: monitors to the left/above have negative origins.
export function resizeOnDisplay(previous: Bounds, width: number, height: number, area: Bounds): Bounds {
  const w = Math.min(Math.round(width), area.width);
  const h = Math.min(Math.round(height), area.height);
  return {
    x: clamp(previous.x + previous.width - w, area.x, area.x + area.width - w),
    y: clamp(previous.y + previous.height - h, area.y, area.y + area.height - h),
    width: w, height: h,
  };
}

export function nudgeAcrossDisplays(previous: Bounds, dx: number, dy: number, areas: Bounds[]): Bounds {
  if (!areas.length) return previous;
  const left = Math.min(...areas.map(a => a.x));
  const top = Math.min(...areas.map(a => a.y));
  const right = Math.max(...areas.map(a => a.x + a.width));
  const bottom = Math.max(...areas.map(a => a.y + a.height));
  const proposed = { ...previous,
    x: clamp(previous.x + dx, left, Math.max(left, right - previous.width)),
    y: clamp(previous.y + dy, top, Math.max(top, bottom - previous.height)),
  };
  if (areas.some(a => Math.min(proposed.x + proposed.width, a.x + a.width) - Math.max(proposed.x, a.x) >= Math.min(48, proposed.width)
    && Math.min(proposed.y + proposed.height, a.y + a.height) - Math.max(proposed.y, a.y) >= Math.min(48, proposed.height))) return proposed;
  // Irregular arrangements can have gaps. Keep a reachable window on the nearest display.
  const distance = (a: Bounds) => {
    const x = proposed.x + proposed.width / 2, y = proposed.y + proposed.height / 2;
    return Math.hypot(x - clamp(x, a.x, a.x + a.width), y - clamp(y, a.y, a.y + a.height));
  };
  const nearest = areas.reduce((best, area) => distance(area) < distance(best) ? area : best);
  return resizeOnDisplay(proposed, proposed.width, proposed.height, nearest);
}
