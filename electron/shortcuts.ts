import { globalShortcut, app } from 'electron';

export interface ShortcutDeps {
  toggleWindow: () => void;
  takeScreenshot: () => Promise<void>;
  toggleInvisible: () => void;
  moveLeft: () => void;
  moveRight: () => void;
  moveUp: () => void;
  moveDown: () => void;
  opacityUp: () => void;
  opacityDown: () => void;
}

export class ShortcutsHelper {
  constructor(private deps: ShortcutDeps) {}

  public registerAll(): void {
    globalShortcut.unregisterAll();

    // Summon / dismiss overlay
    globalShortcut.register('Alt+Space', () => this.deps.toggleWindow());

    // Capture screenshot + attach to next message
    globalShortcut.register('Alt+Shift+S', () => {
      void this.deps.takeScreenshot();
    });

    // Toggle content protection (invisible to screen capture / screen sharing)
    globalShortcut.register('Alt+Shift+H', () => this.deps.toggleInvisible());

    // Nudge overlay position
    globalShortcut.register('Alt+Left', () => this.deps.moveLeft());
    globalShortcut.register('Alt+Right', () => this.deps.moveRight());
    globalShortcut.register('Alt+Up', () => this.deps.moveUp());
    globalShortcut.register('Alt+Down', () => this.deps.moveDown());

    // Opacity
    globalShortcut.register('Alt+Equal', () => this.deps.opacityUp());   // ⌥=  (+ without shift)
    globalShortcut.register('Alt+Minus', () => this.deps.opacityDown());  // ⌥-

    app.on('will-quit', () => globalShortcut.unregisterAll());
  }

  public registerToggleOnly(): void {
    globalShortcut.unregisterAll();
    setTimeout(() => {
      globalShortcut.register('Alt+Space', () => this.deps.toggleWindow());
      globalShortcut.register('Alt+Shift+S', () => {
        void this.deps.takeScreenshot();
      });
      globalShortcut.register('Alt+Shift+H', () => this.deps.toggleInvisible());
    }, 500);
  }
}
