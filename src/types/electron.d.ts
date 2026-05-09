export interface AuraAPI {
  toggle: () => Promise<void>;
  hide: () => Promise<void>;
  show: () => Promise<void>;
  quit: () => Promise<void>;
  updateDimensions: (width: number, height: number) => Promise<void>;
  moveLeft: () => Promise<void>;
  moveRight: () => Promise<void>;
  moveUp: () => Promise<void>;
  moveDown: () => Promise<void>;
  takeScreenshot: () => Promise<{ success: boolean; path?: string; preview?: string }>;
  clearScreenshot: (filepath: string) => Promise<{ success: boolean }>;
  onScreenshotTaken: (cb: (data: { path: string; preview: string }) => void) => () => void;
  onAuthDeepLink: (cb: (data: { accessToken: string; refreshToken: string }) => void) => () => void;
  openExternal: (url: string) => Promise<void>;
  platform: string;
}

declare global {
  interface Window {
    aura?: AuraAPI;
  }
}
