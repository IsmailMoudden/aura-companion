import { test, expect } from 'bun:test';
import { resizeOnDisplay, nudgeAcrossDisplays } from '../electron/window-geometry';
const primary = { x: 0, y: 25, width: 1440, height: 875 };
const left = { x: -1920, y: -200, width: 1920, height: 1080 };
const above = { x: 200, y: -1080, width: 1920, height: 1080 };
const right = { x: 1440, y: 100, width: 1280, height: 700 };
test('opening, expanding and collapsing stay on a monitor with a negative origin', () => {
  let bounds = { x: -1600, y: -100, width: 120, height: 120 };
  for (const area of [left, above, right]) {
    bounds = { x: area.x + 100, y: area.y + 50, width: 120, height: 120 };
    for (const height of [340, 720, 820, 120, 340]) {
      bounds = resizeOnDisplay(bounds, height === 120 ? 120 : 360, height, area);
      expect(bounds.x).toBeGreaterThanOrEqual(area.x);
      expect(bounds.y).toBeGreaterThanOrEqual(area.y);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(area.x + area.width);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(area.y + area.height);
    }
  }
});
test('resizing preserves the bottom-right anchor when it fits', () => {
  expect(resizeOnDisplay({ x: -1000, y: 200, width: 120, height: 120 }, 360, 340, left))
    .toEqual({ x: -1240, y: -20, width: 360, height: 340 });
});
test('arrow keys cross the primary boundary in both directions', () => {
  expect(nudgeAcrossDisplays({ x: -70, y: 200, width: 120, height: 120 }, 60, 0, [left, primary]).x).toBe(-10);
  expect(nudgeAcrossDisplays({ x: 10, y: 200, width: 120, height: 120 }, -60, 0, [left, primary]).x).toBe(-50);
  expect(nudgeAcrossDisplays({ x: 1400, y: 200, width: 120, height: 120 }, 60, 0, [primary, right]).x).toBe(1460);
  expect(nudgeAcrossDisplays({ x: 400, y: 30, width: 120, height: 120 }, 0, -60, [primary, above]).y).toBe(-30);
});
test('outer edges and unplugged screens leave the window reachable', () => {
  expect(nudgeAcrossDisplays({ x: -1900, y: 200, width: 120, height: 120 }, -600, 0, [left, primary]).x).toBe(-1920);
  const recovered = resizeOnDisplay({ x: -1800, y: -100, width: 360, height: 720 }, 360, 720, primary);
  expect(recovered.x).toBe(0); expect(recovered.y).toBe(25);
});
