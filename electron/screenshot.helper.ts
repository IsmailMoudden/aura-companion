import path from 'node:path';
import fs from 'node:fs';
import { app, screen, BrowserWindow } from 'electron';
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
    const displayId = win ? (() => {
      const bounds = win.getBounds();
      const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
      const display = screen.getDisplayNearestPoint(center);
      return display.id;
    })() : null;

    if (displayId !== null) {
      // -D <id> captures a specific display
      await execFileAsync('screencapture', ['-x', '-D', String(displayId), tmpPath]);
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
      return this.captureScreenshotWindows();
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
  public async captureOnly(win?: BrowserWindow | null): Promise<string> {
    let buffer = await this.capture(win);
    if (process.platform === 'darwin') buffer = await this.resizeForApi(buffer);
    const screenshotPath = path.join(this.screenshotDir, `${uuidv4()}.png`);
    await fs.promises.writeFile(screenshotPath, buffer);
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

  private async captureScreenshotWindows(): Promise<Buffer> {
    const tmpPath = path.join(app.getPath('temp'), `${uuidv4()}.png`);
    const script = `
      Add-Type -AssemblyName System.Windows.Forms
      Add-Type -AssemblyName System.Drawing
      $screen = [System.Windows.Forms.Screen]::PrimaryScreen
      $bitmap = New-Object System.Drawing.Bitmap $screen.Bounds.Width, $screen.Bounds.Height
      $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
      $graphics.CopyFromScreen($screen.Bounds.X, $screen.Bounds.Y, 0, 0, $bitmap.Size)
      $bitmap.Save('${tmpPath.replace(/\\/g, '\\\\')}')
      $graphics.Dispose()
      $bitmap.Dispose()
    `;
    await execFileAsync('powershell', ['-command', script]);
    const buffer = await fs.promises.readFile(tmpPath);
    await fs.promises.unlink(tmpPath);
    return buffer;
  }

  public async getImagePreview(filepath: string): Promise<string> {
    const data = await fs.promises.readFile(filepath);
    return `data:image/png;base64,${data.toString('base64')}`;
  }

  public async deleteScreenshot(filepath: string): Promise<void> {
    try {
      await fs.promises.unlink(filepath);
    } catch {
      // already gone
    }
  }
}
