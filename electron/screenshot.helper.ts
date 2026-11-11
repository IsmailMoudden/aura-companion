import path from 'node:path';
import { screenshotPath } from './security';
import fs from 'node:fs';
import { app, screen, BrowserWindow, desktopCapturer } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export class ScreenshotHelper {
  private readonly screenshotDir: string;

  constructor() {
    this.screenshotDir = path.join(app.getPath('userData'), 'screenshots');
    if (!fs.existsSync(this.screenshotDir)) {
      fs.mkdirSync(this.screenshotDir, { recursive: true });
    }
  }

  private async captureScreenshotMac(win?: BrowserWindow | null): Promise<Buffer> {
    const tmpPath = path.join(app.getPath('temp'), `${uuidv4()}.png`);

    // Find which display the overlay window is on
    const displayNumber = win ? (() => {
      const bounds = win.getBounds();
      const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
      const display = screen.getDisplayNearestPoint(center);
      // screencapture -D takes a 1-based display number, not Electron's CGDisplayID.
      const primary = screen.getPrimaryDisplay();
      const displays = [primary, ...screen.getAllDisplays().filter((item) => item.id !== primary.id)];
      return displays.findIndex((item) => item.id === display.id) + 1;
    })() : null;

    if (displayNumber !== null && displayNumber > 0) {
      await execFileAsync('screencapture', ['-x', '-D', String(displayNumber), tmpPath]);
    } else {
      await execFileAsync('screencapture', ['-x', tmpPath]);
    }

    const buffer = await fs.promises.readFile(tmpPath);
    await fs.promises.unlink(tmpPath);
    return buffer;
  }

  private async capture(win?: BrowserWindow | null): Promise<Buffer> {
    if (process.platform === 'darwin') {
      return this.captureScreenshotMac(win);
    } else if (process.platform === 'win32') {
      return this.captureScreenshotWindows(win);
    }
    throw new Error(`Platform ${process.platform} not yet supported`);
  }

  private async resizeForApi(buffer: Buffer): Promise<Buffer> {
    // Downsample to max 1280px wide to keep base64 payload manageable
    const tmpIn = path.join(app.getPath('temp'), `${uuidv4()}-in.png`);
    const tmpOut = path.join(app.getPath('temp'), `${uuidv4()}-out.png`);
    await fs.promises.writeFile(tmpIn, buffer);
    try {
      await execFileAsync('sips', ['-Z', '1280', tmpIn, '--out', tmpOut]);
      const resized = await fs.promises.readFile(tmpOut);
      return resized;
    } catch {
      return buffer; // sips failed, use original
    } finally {
      await fs.promises.unlink(tmpIn).catch(() => {});
      await fs.promises.unlink(tmpOut).catch(() => {});
    }
  }

  // Capture without hiding the overlay — for auto-capture on message send
  public async captureOnly(win?: BrowserWindow | null, excludeOverlay = false): Promise<string> {
    // Keep the overlay out of proactive captures, including its animations and notifications.
    // Opacity avoids stealing focus from the app the user is working in.
    const previousOpacity = win && !win.isDestroyed() ? win.getOpacity() : 1;
    let buffer: Buffer;
    try {
      if (excludeOverlay && win && !win.isDestroyed()) {
        win.setOpacity(0);
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      buffer = await this.capture(win);
    } finally {
      if (excludeOverlay && win && !win.isDestroyed()) win.setOpacity(previousOpacity);
    }
    if (process.platform === 'darwin') buffer = await this.resizeForApi(buffer);
    const screenshotPath = path.join(this.screenshotDir, `${uuidv4()}.png`);
    await fs.promises.writeFile(screenshotPath, buffer, { mode: 0o600 });
    return screenshotPath;
  }

  // Capture with overlay hidden — for manual camera button
  public async takeScreenshot(
    hideWindow: () => void,
    showWindow: () => void,
    win?: BrowserWindow | null,
  ): Promise<string> {
    hideWindow();
    await new Promise((r) => setTimeout(r, 350));
    let screenshotPath = '';
    try {
      screenshotPath = await this.captureOnly(win);
    } finally {
      await new Promise((r) => setTimeout(r, 150));
      showWindow();
    }
    return screenshotPath;
  }

  private async captureScreenshotWindows(win?: BrowserWindow | null): Promise<Buffer> {
    const display = win ? screen.getDisplayMatching(win.getBounds()) : screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
    const width = Math.min(1280, Math.round(display.size.width * display.scaleFactor));
    const height = Math.round(width * display.size.height / display.size.width);
    const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width, height } });
    const source = sources.find(item => item.display_id === String(display.id));
    if (!source || source.thumbnail.isEmpty()) throw new Error('The selected display could not be captured.');
    return source.thumbnail.toPNG();
  }

  public async getImagePreview(filepath: string): Promise<string> {
    filepath = screenshotPath(filepath, this.screenshotDir);
    const stat = await fs.promises.lstat(filepath);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Invalid screenshot file');
    const data = await fs.promises.readFile(filepath);
    return `data:image/png;base64,${data.toString('base64')}`;
  }

  public async deleteScreenshot(filepath: string): Promise<void> {
    filepath = screenshotPath(filepath, this.screenshotDir);
    try {
      await fs.promises.unlink(filepath);
    } catch {
      // already gone
    }
  }
}
