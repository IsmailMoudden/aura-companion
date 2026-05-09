import { contextBridge, ipcRenderer } from 'electron';
import { IPC_EVENTS } from '../shared/constants';

const auraAPI = {
  // Window / overlay
  toggle: () => ipcRenderer.invoke(IPC_EVENTS.OVERLAY.TOGGLE),
  hide: () => ipcRenderer.invoke(IPC_EVENTS.OVERLAY.HIDE),
  show: () => ipcRenderer.invoke(IPC_EVENTS.OVERLAY.SHOW),
  quit: () => ipcRenderer.invoke('app:quit'),

  // Window sizing (renderer tells main how big it needs to be)
  updateDimensions: (width: number, height: number) =>
    ipcRenderer.invoke(IPC_EVENTS.WINDOW.UPDATE_DIMENSIONS, { width, height }),

  // Nudge position
  moveLeft: () => ipcRenderer.invoke(IPC_EVENTS.WINDOW.MOVE_LEFT),
  moveRight: () => ipcRenderer.invoke(IPC_EVENTS.WINDOW.MOVE_RIGHT),
  moveUp: () => ipcRenderer.invoke(IPC_EVENTS.WINDOW.MOVE_UP),
  moveDown: () => ipcRenderer.invoke(IPC_EVENTS.WINDOW.MOVE_DOWN),

  // Screenshot
  takeScreenshot: () => ipcRenderer.invoke(IPC_EVENTS.SCREENSHOT.TAKE),
  clearScreenshot: (filepath: string) =>
    ipcRenderer.invoke(IPC_EVENTS.SCREENSHOT.CLEAR, filepath),

  // Listen for screenshot events pushed from main
  onScreenshotTaken: (cb: (data: { path: string; preview: string }) => void) => {
    const sub = (_: unknown, data: { path: string; preview: string }) => cb(data);
    ipcRenderer.on(IPC_EVENTS.SCREENSHOT.TAKEN, sub);
    return () => ipcRenderer.removeListener(IPC_EVENTS.SCREENSHOT.TAKEN, sub);
  },

  platform: process.platform,
} as const;

contextBridge.exposeInMainWorld('aura', auraAPI);

export type AuraAPI = typeof auraAPI;
