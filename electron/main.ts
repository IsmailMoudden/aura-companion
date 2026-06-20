import { app, BrowserWindow, screen, shell, Tray, Menu, nativeImage, ipcMain } from 'electron';
import path from 'path';
import * as dotenv from 'dotenv';
import { AuraWindowConfig } from './window-config/AuraWindowConfig';
import { ScreenshotHelper } from './screenshot.helper';
import { ShortcutsHelper } from './shortcuts';
import { initializeIpcHandlers } from './ipc.handlers';

dotenv.config({ path: path.join(process.cwd(), '.env') });


const state = {
  mainWindow: null as BrowserWindow | null,
  dashboardWindow: null as BrowserWindow | null,
  tray: null as Tray | null,
  isVisible: true,
  isInvisible: false,
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

function toggleInvisible() {
  const win = state.mainWindow;
  if (!win || win.isDestroyed()) return;
  state.isInvisible = !state.isInvisible;
  win.setContentProtection(state.isInvisible);
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

// ─── Dashboard window ─────────────────────────────────────────────────────────
const WEB_APP_URL = process.env.VITE_WEB_URL ?? 'https://aura.aura-companion.workers.dev';

// Match the web app background — oklch(0.62 0.08 235) ≈ #3a5a7a
const DASHBOARD_BG = '#1a2535';

async function openDashboard() {
  // If already open, just focus it
  if (state.dashboardWindow && !state.dashboardWindow.isDestroyed()) {
    if (state.dashboardWindow.isMinimized()) state.dashboardWindow.restore();
    state.dashboardWindow.focus();
    return;
  }

  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  state.dashboardWindow = new BrowserWindow({
    width: Math.min(1280, Math.round(width * 0.85)),
    height: Math.min(860, Math.round(height * 0.90)),
    minWidth: 800,
    minHeight: 600,
    center: true,
    title: 'Aura',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: DASHBOARD_BG,
    show: false, // show after load to avoid blank flash
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Show only when page is ready — avoids blank white/black flash
  state.dashboardWindow.once('ready-to-show', () => {
    state.dashboardWindow?.show();
    state.dashboardWindow?.focus();
  });

  // Load the web app
  await state.dashboardWindow.loadURL(`${WEB_APP_URL}/app`);

  // Show dock icon while dashboard is open (macOS)
  if (process.platform === 'darwin') app.dock.show();

  state.dashboardWindow.on('closed', () => {
    state.dashboardWindow = null;
    if (process.platform === 'darwin') app.dock.hide();
  });
}

// ─── Create window ────────────────────────────────────────────────────────────
async function createWindow() {
  const display = screen.getPrimaryDisplay();
  state.screenWidth = display.workAreaSize.width;
  state.screenHeight = display.workAreaSize.height;

  // Center of screen — safe default, easy to see
  state.currentX = Math.round(state.screenWidth / 2) - 40;
  state.currentY = Math.round(state.screenHeight / 2) - 40;

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

  // Hide from Dock (macOS) — overlay lives as a tray-only app
  if (process.platform === 'darwin') app.dock.hide();

  // Tray icon with Quit option
  const trayIcon = nativeImage.createFromPath(
    path.join(__dirname, '../assets/icons/mac/tray.png')
  ).resize({ width: 16, height: 16 });
  state.tray = new Tray(trayIcon.isEmpty() ? nativeImage.createEmpty() : trayIcon);
  state.tray.setToolTip('Aura');
  const trayMenu = Menu.buildFromTemplate([
    { label: 'Show Aura', click: () => { showWindow(); state.mainWindow?.focus(); } },
    { label: 'Open Dashboard', click: () => openDashboard() },
    { type: 'separator' },
    { label: 'Quit Aura', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() },
  ]);
  state.tray.setContextMenu(trayMenu);
  state.tray.on('click', () => toggleWindow());

  // Show the window
  state.mainWindow.show();
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
    toggleInvisible,
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
    openDashboard,
  });

  await createWindow();
  state.shortcutsHelper.registerAll();

  // Open dashboard on first launch
  await openDashboard();
}

app.on('window-all-closed', () => {
  // Only quit if the overlay itself is gone — closing dashboard alone keeps the app alive
  if (!state.mainWindow || state.mainWindow.isDestroyed()) {
    app.quit();
  }
});

app.on('activate', () => {
  // macOS dock click — reopen dashboard if closed
  if (state.dashboardWindow === null || state.dashboardWindow.isDestroyed()) {
    openDashboard().catch(console.error);
  } else {
    state.dashboardWindow.focus();
  }
});

// ─── Deep link — aura://auth?access_token=...&refresh_token=... ──────────────
const PROTOCOL = 'aura';

// Register as default handler for aura:// links
if (!app.isDefaultProtocolClient(PROTOCOL)) {
  app.setAsDefaultProtocolClient(PROTOCOL);
}

function handleDeepLink(url: string) {
  if (!url.startsWith(`${PROTOCOL}://auth`)) return;
  const params = new URL(url.replace(`${PROTOCOL}://`, 'https://placeholder/')).searchParams;
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (!accessToken || !refreshToken) return;
  const win = state.mainWindow;
  if (win && !win.isDestroyed()) {
    win.webContents.send('auth:deep-link', { accessToken, refreshToken });
    win.show();
  }
}

// macOS: deep link via open-url event
app.on('open-url', (event, url) => {
  event.preventDefault();
  handleDeepLink(url);
});

// Windows/Linux: deep link arrives as second-instance argv
app.on('second-instance', (_event, argv) => {
  const url = argv.find((a) => a.startsWith(`${PROTOCOL}://`));
  if (url) handleDeepLink(url);
  if (state.mainWindow) {
    if (state.mainWindow.isMinimized()) state.mainWindow.restore();
    state.mainWindow.focus();
  }
});

app.whenReady().then(init).catch(console.error);
