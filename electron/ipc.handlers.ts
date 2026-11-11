import { ipcMain, app, shell, safeStorage, clipboard } from 'electron';
import { IPC_EVENTS } from '../shared/constants';
import { ScreenshotHelper } from './screenshot.helper';
import type { BrowserWindow } from 'electron';
import Store from 'electron-store';
import path from 'node:path';
import { trustedDocument, allowedExternalUrl, validDimensions } from './security';
import { SessionVault } from './session-vault';

const storage = new Store<{ session: unknown; sessionEncrypted: string }>({ defaults: { session: null, sessionEncrypted: '' }, clearInvalidConfig: true });
export const sessionVault = new SessionVault(storage, {
  available: () => app.isReady() && safeStorage.isEncryptionAvailable() && (process.platform !== 'linux' || safeStorage.getSelectedStorageBackend() !== 'basic_text'),
  encrypt: (value) => safeStorage.encryptString(value),
  decrypt: (value) => safeStorage.decryptString(value),
});
app.whenReady().then(() => sessionVault.flush());

export interface IpcDeps {
  getMainWindow: () => BrowserWindow | null;
  getDashboardWindow: () => BrowserWindow | null;
  webUrl: string;
  hideWindow: () => void;
  showWindow: () => void;
  toggleWindow: () => void;
  setWindowSize: (width: number, height: number) => void;
  moveLeft: () => void;
  moveRight: () => void;
  moveUp: () => void;
  moveDown: () => void;
  screenshotHelper: ScreenshotHelper;
  openDashboard: () => Promise<void>;
  startSignIn: () => Promise<void>;
}

export function initializeIpcHandlers(deps: IpcDeps): void {
  const overlayFile = path.join(__dirname, '../dist-overlay/overlay.html');
  const overlayChannels = new Set<string>([
    ...Object.values(IPC_EVENTS.OVERLAY), ...Object.values(IPC_EVENTS.WINDOW),
    ...Object.values(IPC_EVENTS.SCREENSHOT), 'screenshot:capture-only', 'clipboard:write', 'app:quit',
  ]);
  const handle: typeof ipcMain.handle = (channel, listener) => ipcMain.handle(channel, (event, ...args) => {
    const win = [deps.getMainWindow(), deps.getDashboardWindow()].find((item) => item && !item.isDestroyed() && item.webContents.id === event.sender.id);
    const document = trustedDocument(event.senderFrame?.url ?? '', deps.webUrl, overlayFile);
    if (!win || event.senderFrame !== event.sender.mainFrame || !document || (overlayChannels.has(channel) && (document !== 'overlay' || win !== deps.getMainWindow()))) throw new Error('IPC access denied');
    return listener(event, ...args);
  });
  handle(IPC_EVENTS.OVERLAY.TOGGLE, () => deps.toggleWindow());
  handle(IPC_EVENTS.OVERLAY.SHOW, () => deps.showWindow());
  handle(IPC_EVENTS.OVERLAY.HIDE, () => deps.hideWindow());

  handle(IPC_EVENTS.WINDOW.UPDATE_DIMENSIONS, (_e, size: unknown) => {
    const { width, height } = validDimensions(size);
    deps.setWindowSize(width, height);
  });

  handle('clipboard:write', (_event, text: unknown) => {
    if (typeof text !== 'string' || text.length > 128_000) throw new Error('Invalid clipboard text');
    clipboard.writeText(text);
  });

  handle(IPC_EVENTS.WINDOW.MOVE_LEFT, () => deps.moveLeft());
  handle(IPC_EVENTS.WINDOW.MOVE_RIGHT, () => deps.moveRight());
  handle(IPC_EVENTS.WINDOW.MOVE_UP, () => deps.moveUp());
  handle(IPC_EVENTS.WINDOW.MOVE_DOWN, () => deps.moveDown());

  handle(IPC_EVENTS.SCREENSHOT.TAKE, async () => {
    const win = deps.getMainWindow();
    if (!win) return { success: false };
    try {
      const filepath = await deps.screenshotHelper.takeScreenshot(deps.hideWindow, deps.showWindow, win);
      const preview = await deps.screenshotHelper.getImagePreview(filepath);
      win.webContents.send(IPC_EVENTS.SCREENSHOT.TAKEN, { path: filepath, preview });
      return { success: true, path: filepath, preview };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  handle('screenshot:capture-only', async (_e, options?: { excludeOverlay?: boolean }) => {
    const win = deps.getMainWindow();
    if (!win) return { success: false };
    try {
      const filepath = await deps.screenshotHelper.captureOnly(win, options?.excludeOverlay === true);
      const preview = await deps.screenshotHelper.getImagePreview(filepath);
      return { success: true, path: filepath, preview };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  handle(IPC_EVENTS.SCREENSHOT.CLEAR, async (_e, filepath: string) => {
    await deps.screenshotHelper.deleteScreenshot(filepath);
    return { success: true };
  });

  // Persist session tokens so overlay stays logged in across relaunches
  handle('session:save', (event, tokens: { access_token: string; refresh_token: string }) => {
    const previous = sessionVault.load();
    sessionVault.save(tokens);
    if (previous?.access_token !== tokens.access_token || previous?.refresh_token !== tokens.refresh_token) {
      for (const win of [deps.getMainWindow(), deps.getDashboardWindow()]) {
        if (win && !win.isDestroyed() && win.webContents.id !== event.sender.id && trustedDocument(win.webContents.getURL(), deps.webUrl, overlayFile)) {
          win.webContents.send('auth:deep-link', { accessToken: tokens.access_token, refreshToken: tokens.refresh_token });
        }
      }
    }
  });
  handle('session:load', () => sessionVault.load());
  handle('session:clear', () => {
    if (sessionVault.clear()) for (const win of [deps.getMainWindow(), deps.getDashboardWindow()]) {
      if (win && !win.isDestroyed() && trustedDocument(win.webContents.getURL(), deps.webUrl, overlayFile)) win.webContents.send('auth:signed-out');
    }
  });

  // Open dashboard window
  handle('app:open-dashboard', () => deps.openDashboard());
  handle('auth:sign-in', () => deps.startSignIn());

  // Quit app
  handle('app:quit', () => app.quit());

  // Open URL in system browser (used for OAuth deep-link flow)
  handle('shell:open-external', (_e, value: string) => {
    const url = new URL(allowedExternalUrl(value, deps.webUrl));
    if (url.origin === new URL(deps.webUrl).origin && url.pathname === '/auth' && url.searchParams.get('overlay') === 'true') return deps.startSignIn();
    return shell.openExternal(url.href);
  });
}
