import path from 'node:path';
import fs from 'node:fs';
import { app } from 'electron';
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

  private async captureScreenshotMac(): Promise<Buffer> {
    const tmpPath = path.join(app.getPath('temp'), `${uuidv4()}.png`);
    await execFileAsync('screencapture', ['-x', tmpPath]);
    const buffer = await fs.promises.readFile(tmpPath);
    await fs.promises.unlink(tmpPath);
    return buffer;
  }

  public async takeScreenshot(
    hideWindow: () => void,
    showWindow: () => void,
  ): Promise<string> {
    hideWindow();
    await new Promise((r) => setTimeout(r, 200));

    let screenshotPath = '';
    try {
      let buffer: Buffer;
      if (process.platform === 'darwin') {
        buffer = await this.captureScreenshotMac();
      } else {
        throw new Error(`Platform ${process.platform} not yet supported`);
      }

      screenshotPath = path.join(this.screenshotDir, `${uuidv4()}.png`);
      await fs.promises.writeFile(screenshotPath, buffer);
    } finally {
      await new Promise((r) => setTimeout(r, 200));
      showWindow();
    }

    return screenshotPath;
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
