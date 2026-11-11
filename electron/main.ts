import { app, BrowserWindow, screen, shell, Tray, Menu, nativeImage, ipcMain } from 'electron';
import path from 'path';
import { AuthAttempt } from './auth-attempt';
import { validTokens } from './session-vault';
import { trustedDocument, allowedExternalUrl } from './security';
import { dashboardPage } from './dashboard-page';
import { resizeOnDisplay, nudgeAcrossDisplays } from './window-geometry';
import * as dotenv from 'dotenv';
import { AuraWindowConfig } from './window-config/AuraWindowConfig';
import { ScreenshotHelper } from './screenshot.helper';
import { ShortcutsHelper } from './shortcuts';
import { initializeIpcHandlers, sessionVault } from './ipc.handlers';

dotenv.config({ path: path.join(process.cwd(), '.env') });


const state = {
  mainWindow: null as BrowserWindow | null,
  dashboardWindow: null as BrowserWindow | null,
  tray: null as Tray | null,
  isVisible: true,
  isInvisible: false,
  currentX: 0,
  currentY: 50,
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
  const previous = win.getBounds();
  const area = screen.getDisplayMatching(previous).workArea;
  const bounds = resizeOnDisplay(previous, width, height, area);
  win.setBounds(bounds);
  state.currentX = bounds.x;
  state.currentY = bounds.y;
}

function toggleInvisible() {
  const win = state.mainWindow;
  if (!win || win.isDestroyed()) return;
  state.isInvisible = !state.isInvisible;
  win.setContentProtection(state.isInvisible);
}

function moveWindow(dx: number, dy: number) {
  const win = state.mainWindow;
  if (!win || win.isDestroyed()) return;
  const next = nudgeAcrossDisplays(win.getBounds(), dx, dy, screen.getAllDisplays().map(display => display.workArea));
  win.setPosition(Math.round(next.x), Math.round(next.y));
  state.currentX = next.x;
  state.currentY = next.y;
}
const moveLeft = () => moveWindow(-state.step, 0);
const moveRight = () => moveWindow(state.step, 0);
const moveUp = () => moveWindow(0, -state.step);
const moveDown = () => moveWindow(0, state.step);

// ─── Dashboard window ─────────────────────────────────────────────────────────
const authAttempt = new AuthAttempt();
async function startSignIn() {
  const url = new URL('/auth', WEB_APP_URL);
  url.searchParams.set('overlay', 'true');
  url.searchParams.set('desktop_state', authAttempt.begin());
  await shell.openExternal(url.href);
}
const WEB_APP_URL = (process.env.VITE_WEB_URL || 'https://aura.aura-companion.workers.dev').replace(/\/$/, '');

// Match the web app background — oklch(0.62 0.08 235) ≈ #3a5a7a
const DASHBOARD_BG = '#1a2535';

async function openDashboard() {
  // If already open, just focus it
  if (state.dashboardWindow && !state.dashboardWindow.isDestroyed()) {
    if (state.dashboardWindow.isMinimized()) state.dashboardWindow.restore();
    state.dashboardWindow.focus();
    return;
  }

  const area = (state.mainWindow ? screen.getDisplayMatching(state.mainWindow.getBounds()) : screen.getDisplayNearestPoint(screen.getCursorScreenPoint())).workArea;
  const width = Math.min(1280, Math.round(area.width * 0.85));
  const height = Math.min(860, Math.round(area.height * 0.90));

  state.dashboardWindow = new BrowserWindow({
    width, height,
    minWidth: Math.min(800, width),
    minHeight: Math.min(600, height),
    x: area.x + Math.round((area.width - width) / 2),
    y: area.y + Math.round((area.height - height) / 2),
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

  const win = state.dashboardWindow;
  secureWindow(win);
  let loadTimer: ReturnType<typeof setTimeout> | undefined;
  let contentTimer: ReturnType<typeof setTimeout> | undefined;
  const clearTimers = () => { clearTimeout(loadTimer); clearTimeout(contentTimer); };
  const showStatus = async (failed: boolean) => {
    clearTimers();
    if (win.isDestroyed()) return;
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(dashboardPage(failed))}`).catch(() => {});
  };
  const loadDashboard = async () => {
    clearTimers();
    await showStatus(false);
    if (win.isDestroyed()) return;
    loadTimer = setTimeout(() => { void showStatus(true); }, 20_000);
    try {
      await win.loadURL(`${WEB_APP_URL}/app`);
      clearTimeout(loadTimer);
      // A successful HTTP response can still leave an empty page if its scripts fail.
      contentTimer = setTimeout(async () => {
        if (win.isDestroyed() || !win.webContents.getURL().startsWith(WEB_APP_URL)) return;
        const hasContent = await win.webContents.executeJavaScript("Boolean(document.body?.innerText.trim()) && !/^(upstream connect error|remote connection failure)/i.test(document.body.innerText.trim())").catch(() => false);
        if (!hasContent) void showStatus(true);
      }, 15_000);
    } catch {
      if (!win.isDestroyed() && !win.webContents.getURL().startsWith('data:')) void showStatus(true);
    }
  };

  win.webContents.on('will-navigate', (event, url) => {
    if (url === 'aura-dashboard:retry') { event.preventDefault(); void loadDashboard(); }
    if (url === 'aura-dashboard:browser') { event.preventDefault(); void shell.openExternal(`${WEB_APP_URL}/app`); }
  });
  win.webContents.on('did-fail-load', (_event, code, _description, url, mainFrame) => {
    if (mainFrame && code !== -3 && !url.startsWith('data:')) void showStatus(true);
  });
  win.webContents.on('did-navigate', (_event, _url, statusCode) => {
    if (statusCode >= 400) void showStatus(true);
  });
  win.webContents.on('render-process-gone', () => { void showStatus(true); });
  win.once('ready-to-show', () => { if (!win.isDestroyed()) { win.show(); win.focus(); } });
  if (process.platform === 'darwin') app.dock?.show();
  win.on('closed', () => {
    clearTimers();
    state.dashboardWindow = null;
    if (process.platform === 'darwin') app.dock?.hide();
  });
  await loadDashboard();
}

function secureWindow(win: BrowserWindow) {
  const overlayFile = path.join(__dirname, '../dist-overlay/overlay.html');
  win.webContents.setWindowOpenHandler(({ url }) => {
    try { void shell.openExternal(allowedExternalUrl(url, WEB_APP_URL)); } catch { /* Block unapproved destinations. */ }
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (trustedDocument(url, WEB_APP_URL, overlayFile)) return;
    event.preventDefault();
    try {
      const target = new URL(url);
      if (target.protocol === 'https:' && target.pathname === '/auth/v1/authorize' && target.origin === new URL(process.env.VITE_SUPABASE_URL || 'https://mkzdienngrisxrvkvgrv.supabase.co').origin) {
        void startSignIn();
      }
    } catch { /* Invalid navigation is blocked. */ }
  });
  win.webContents.on('will-redirect', (event, url) => {
    if (!trustedDocument(url, WEB_APP_URL, overlayFile)) event.preventDefault();
  });
  win.webContents.session.setPermissionRequestHandler((_contents, permission, callback, details) => {
    const trusted = trustedDocument(details.requestingUrl, WEB_APP_URL, overlayFile);
    callback(trusted === 'overlay' && ['media', 'display-capture'].includes(permission));
  });
}

// ─── Create window ────────────────────────────────────────────────────────────
async function createWindow() {
  const area = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
  state.currentX = area.x + Math.round((area.width - AuraWindowConfig.baseSettings.width!) / 2);
  state.currentY = area.y + Math.round((area.height - AuraWindowConfig.baseSettings.height!) / 2);

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

  secureWindow(state.mainWindow);
  state.mainWindow.webContents.on('context-menu', (_event, params) => {
    if (params.selectionText) Menu.buildFromTemplate([{ role: 'copy' }]).popup({ window: state.mainWindow! });
  });
  const recoverDisplay = () => {
    const win = state.mainWindow;
    if (win && !win.isDestroyed()) { const bounds = win.getBounds(); setWindowSize(bounds.width, bounds.height); }
  };
  screen.on('display-removed', recoverDisplay);
  screen.on('display-metrics-changed', recoverDisplay);
  state.mainWindow.on('closed', () => {
    screen.removeListener('display-removed', recoverDisplay);
    screen.removeListener('display-metrics-changed', recoverDisplay);
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
  if (process.platform === 'darwin') app.dock?.hide();

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
      const filepath = await state.screenshotHelper!.takeScreenshot(hideWindow, showWindow, win);
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
    getDashboardWindow: () => state.dashboardWindow,
    webUrl: WEB_APP_URL,
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
    startSignIn,
  });

  const initialAuthUrl = process.argv.find((arg) => arg.startsWith(`${PROTOCOL}://`));
  if (initialAuthUrl) handleDeepLink(initialAuthUrl);
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
  let parsed: URL;
  try { parsed = new URL(url); } catch { return; }
  if (parsed.protocol !== `${PROTOCOL}:` || parsed.hostname !== 'auth') return;
  const accessToken = parsed.searchParams.get('access_token');
  const refreshToken = parsed.searchParams.get('refresh_token');
  if (!validTokens({ access_token: accessToken, refresh_token: refreshToken }) || !authAttempt.consume(parsed.searchParams.get('desktop_state'))) return;
  // Persist before delivering: cold-start callbacks may arrive before React subscribes.
  sessionVault.save({ access_token: accessToken!, refresh_token: refreshToken! });
  for (const win of [state.mainWindow, state.dashboardWindow]) {
    if (win && !win.isDestroyed() && trustedDocument(win.webContents.getURL(), WEB_APP_URL, path.join(__dirname, '../dist-overlay/overlay.html'))) win.webContents.send('auth:deep-link', { accessToken, refreshToken });
  }
  state.mainWindow?.show();
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
