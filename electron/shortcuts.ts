import { globalShortcut, app } from 'electron';

export interface ShortcutDeps {
  toggleWindow: () => void;
  takeScreenshot: () => Promise<void>;
  moveLeft: () => void;
  moveRight: () => void;
  moveUp: () => void;
  moveDown: () => void;
}

export class ShortcutsHelper {
  constructor(private deps: ShortcutDeps) {}

  public registerAll(): void {
    globalShortcut.unregisterAll();

    // Summon / dismiss overlay
    globalShortcut.register('Alt+Space', () => this.deps.toggleWindow());

    // Capture screenshot + attach to next message
    globalShortcut.register('CommandOrControl+Shift+S', () => {
      void this.deps.takeScreenshot();
    });

    // Nudge overlay position
    globalShortcut.register('Alt+Left', () => this.deps.moveLeft());
    globalShortcut.register('Alt+Right', () => this.deps.moveRight());
    globalShortcut.register('Alt+Up', () => this.deps.moveUp());
    globalShortcut.register('Alt+Down', () => this.deps.moveDown());

    app.on('will-quit', () => globalShortcut.unregisterAll());
  }

  public registerToggleOnly(): void {
    globalShortcut.unregisterAll();
    setTimeout(() => {
      globalShortcut.register('Alt+Space', () => this.deps.toggleWindow());
      globalShortcut.register('CommandOrControl+Shift+S', () => {
        void this.deps.takeScreenshot();
      });
    }, 500);
  }
}
