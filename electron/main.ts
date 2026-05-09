import { app, BrowserWindow, screen } from 'electron';
import path from 'path';
import * as dotenv from 'dotenv';
import { AuraWindowConfig } from './window-config/AuraWindowConfig';
import { ScreenshotHelper } from './screenshot.helper';
import { ShortcutsHelper } from './shortcuts';
import { initializeIpcHandlers } from './ipc.handlers';

dotenv.config({ path: path.join(process.cwd(), '.env') });


const state = {
  mainWindow: null as BrowserWindow | null,
  isVisible: true,
  currentX: 0,
  currentY: 50,
  screenWidth: 0,
  screenHeight: 0,
  step: 60,
  screenshotHelper: null as ScreenshotHelper | null,
  shortcutsHelper: null as ShortcutsHelper | null,
};

// ─── Single instance ──────────────────────────────────────────────────────────
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (state.mainWindow) {
      if (state.mainWindow.isMinimized()) state.mainWindow.restore();
      state.mainWindow.focus();
    }
  });
}

// ─── Window helpers ───────────────────────────────────────────────────────────
function getMainWindow() {
  return state.mainWindow;
}

function applyVisibility(config: typeof AuraWindowConfig.behavior.showBehavior) {
  const win = state.mainWindow;
  if (!win || win.isDestroyed()) return;
  win.setIgnoreMouseEvents(config.ignoreMouseEvents, { forward: true });
  win.setFocusable(config.focusable);
  win.setAlwaysOnTop(config.alwaysOnTop, config.alwaysOnTopLevel, 1);
  win.setVisibleOnAllWorkspaces(config.visibleOnAllWorkspaces, {
    visibleOnFullScreen: config.visibleOnFullScreen,
  });
  win.setContentProtection(config.contentProtection);
  win.setOpacity(config.opacity);
}

function applyPlatformConfig() {
  const win = state.mainWindow;
  if (!win || win.isDestroyed()) return;
  const p = AuraWindowConfig.behavior.platformSpecific;
  if (process.platform === 'darwin' && p.darwin) {
    win.setHiddenInMissionControl(p.darwin.hiddenInMissionControl);
    win.setWindowButtonVisibility(p.darwin.windowButtonVisibility);
    win.setBackgroundColor(p.darwin.backgroundColor);
    win.setHasShadow(p.darwin.hasShadow);
  }
}

function hideWindow() {
  const win = state.mainWindow;
  if (!win || win.isDestroyed()) return;
  applyVisibility(AuraWindowConfig.behavior.hideBehavior);
  win.hide();
  state.isVisible = false;
  state.shortcutsHelper?.registerToggleOnly();
}

function showWindow() {
  const win = state.mainWindow;
  if (!win || win.isDestroyed()) return;
  win.setOpacity(0);
  win.showInactive();
  applyVisibility(AuraWindowConfig.behavior.showBehavior);
  applyPlatformConfig();
  state.isVisible = true;
  state.shortcutsHelper?.registerAll();
}

let isToggling = false;
function toggleWindow() {
  if (isToggling) return;
  isToggling = true;
  if (state.isVisible) {
    hideWindow();
  } else {
    showWindow();
  }
  setTimeout(() => { isToggling = false; }, 300);
}

function setWindowSize(width: number, height: number) {
  const win = state.mainWindow;
  if (!win || win.isDestroyed()) return;
  const w = Math.round(width);
  const h = Math.round(height);
  // Anchor to bottom-right corner so expanding goes up/left, never off-screen
  const prevBounds = win.getBounds();
  const anchorX = prevBounds.x + prevBounds.width;
  const anchorY = prevBounds.y + prevBounds.height;
  const x = Math.max(0, anchorX - w);
  const y = Math.max(30, anchorY - h); // 30px = macOS menu bar height
  win.setBounds({ x, y, width: w, height: h });
  state.currentX = x;
  state.currentY = y;
}

function moveLeft() {
  if (!state.mainWindow) return;
  const bounds = state.mainWindow.getBounds();
  state.currentX = Math.max(-(bounds.width / 2), state.currentX - state.step);
  state.mainWindow.setPosition(Math.round(state.currentX), Math.round(state.currentY));
}

function moveRight() {
  if (!state.mainWindow) return;
  const bounds = state.mainWindow.getBounds();
  state.currentX = Math.min(state.screenWidth - bounds.width / 2, state.currentX + state.step);
  state.mainWindow.setPosition(Math.round(state.currentX), Math.round(state.currentY));
}

function moveUp() {
  if (!state.mainWindow) return;
  const bounds = state.mainWindow.getBounds();
  state.currentY = Math.max(-(bounds.height * 2 / 3), state.currentY - state.step);
  state.mainWindow.setPosition(Math.round(state.currentX), Math.round(state.currentY));
}

function moveDown() {
  if (!state.mainWindow) return;
  const bounds = state.mainWindow.getBounds();
  state.currentY = Math.min(state.screenHeight + bounds.height * 2 / 3, state.currentY + state.step);
  state.mainWindow.setPosition(Math.round(state.currentX), Math.round(state.currentY));
}

// ─── Create window ────────────────────────────────────────────────────────────
async function createWindow() {
  const display = screen.getPrimaryDisplay();
  state.screenWidth = display.workAreaSize.width;
  state.screenHeight = display.workAreaSize.height;

  // Bottom-right corner, safe from menu bar
  state.currentX = state.screenWidth - 80;
  state.currentY = state.screenHeight - 80;

  state.mainWindow = new BrowserWindow({
    ...AuraWindowConfig.baseSettings,
    x: state.currentX,
    y: state.currentY,
    show: false, // show manually after load to avoid flash
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      scrollBounce: true,
    },
  });

  // Load the built overlay
  await state.mainWindow.loadFile(path.join(__dirname, '../dist-overlay/overlay.html'));

  // macOS overlay configuration — applied after load
  state.mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);
  state.mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  state.mainWindow.setSkipTaskbar(true);
  state.mainWindow.setIgnoreMouseEvents(false);
  applyPlatformConfig();

  // Re-assert overlay level whenever any other app takes focus.
  // macOS drops the window behind on space/app switches without this.
  app.on('browser-window-blur', () => {
    if (!state.mainWindow || state.mainWindow.isDestroyed()) return;
    state.mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);
    state.mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  });

  // Show the window
  state.mainWindow.show();
  state.mainWindow.webContents.openDevTools({ mode: 'detach' });
  state.isVisible = true;

  state.mainWindow.on('move', () => {
    if (!state.mainWindow) return;
    const [x, y] = state.mainWindow.getPosition();
    state.currentX = x;
    state.currentY = y;
  });

  state.mainWindow.on('closed', () => {
    state.mainWindow = null;
    state.isVisible = false;
  });

  state.mainWindow.on('focus', () => {
    applyPlatformConfig();
    // Re-assert overlay level on every focus to survive macOS space/fullscreen switches
    state.mainWindow?.setAlwaysOnTop(true, 'screen-saver', 1);
    state.mainWindow?.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  });
}

// ─── Init ─────────────────────────────────────────────────────────────────────
async function init() {
  state.screenshotHelper = new ScreenshotHelper();

  state.shortcutsHelper = new ShortcutsHelper({
    toggleWindow,
    takeScreenshot: async () => {
      const win = state.mainWindow;
      if (!win) return;
      const filepath = await state.screenshotHelper!.takeScreenshot(hideWindow, showWindow);
      const preview = await state.screenshotHelper!.getImagePreview(filepath);
      win.webContents.send('screenshot:taken', { path: filepath, preview });
    },
    moveLeft,
    moveRight,
    moveUp,
    moveDown,
  });

  initializeIpcHandlers({
    getMainWindow,
    hideWindow,
    showWindow,
    toggleWindow,
    setWindowSize,
    moveLeft,
    moveRight,
    moveUp,
    moveDown,
    screenshotHelper: state.screenshotHelper,
  });

  await createWindow();
  state.shortcutsHelper.registerAll();
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow().catch(console.error);
  }
});

app.whenReady().then(init).catch(console.error);
