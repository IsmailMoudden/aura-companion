import { ipcMain, app, shell } from 'electron';
import { IPC_EVENTS } from '../shared/constants';
import { ScreenshotHelper } from './screenshot.helper';
import type { BrowserWindow } from 'electron';

export interface IpcDeps {
  getMainWindow: () => BrowserWindow | null;
  hideWindow: () => void;
  showWindow: () => void;
  toggleWindow: () => void;
  setWindowSize: (width: number, height: number) => void;
  moveLeft: () => void;
  moveRight: () => void;
  moveUp: () => void;
  moveDown: () => void;
  screenshotHelper: ScreenshotHelper;
}

export function initializeIpcHandlers(deps: IpcDeps): void {
  ipcMain.handle(IPC_EVENTS.OVERLAY.TOGGLE, () => deps.toggleWindow());
  ipcMain.handle(IPC_EVENTS.OVERLAY.SHOW, () => deps.showWindow());
  ipcMain.handle(IPC_EVENTS.OVERLAY.HIDE, () => deps.hideWindow());

  ipcMain.handle(IPC_EVENTS.WINDOW.UPDATE_DIMENSIONS, (_e, { width, height }: { width: number; height: number }) => {
    deps.setWindowSize(width, height);
  });

  ipcMain.handle(IPC_EVENTS.WINDOW.MOVE_LEFT, () => deps.moveLeft());
  ipcMain.handle(IPC_EVENTS.WINDOW.MOVE_RIGHT, () => deps.moveRight());
  ipcMain.handle(IPC_EVENTS.WINDOW.MOVE_UP, () => deps.moveUp());
  ipcMain.handle(IPC_EVENTS.WINDOW.MOVE_DOWN, () => deps.moveDown());

  ipcMain.handle(IPC_EVENTS.SCREENSHOT.TAKE, async () => {
    const win = deps.getMainWindow();
    if (!win) return { success: false };
    try {
      const filepath = await deps.screenshotHelper.takeScreenshot(
        deps.hideWindow,
        deps.showWindow,
      );
      const preview = await deps.screenshotHelper.getImagePreview(filepath);
      win.webContents.send(IPC_EVENTS.SCREENSHOT.TAKEN, { path: filepath, preview });
      return { success: true, path: filepath, preview };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle(IPC_EVENTS.SCREENSHOT.CLEAR, async (_e, filepath: string) => {
    await deps.screenshotHelper.deleteScreenshot(filepath);
    return { success: true };
  });

  // Quit app
  ipcMain.handle('app:quit', () => app.quit());

  // Open URL in system browser (used for OAuth deep-link flow)
  ipcMain.handle('shell:open-external', (_e, url: string) => shell.openExternal(url));
}
