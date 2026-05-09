import { WindowConfig } from './WindowConfig';

export const AuraWindowConfig: WindowConfig = {
  baseSettings: {
    width: 420,
    height: 420,
    alwaysOnTop: true,
    show: true,
    fullscreenable: false,
    focusable: true,
    enableLargerThanScreen: true,
    frame: false,
    hasShadow: false,
    transparent: true,
    skipTaskbar: true,
    titleBarStyle: 'hidden',
    backgroundColor: '#00000000',
    paintWhenInitiallyHidden: true,
    movable: true,
    resizable: false,
  },
  behavior: {
    showBehavior: {
      opacity: 1,
      ignoreMouseEvents: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      alwaysOnTopLevel: 'screen-saver',
      visibleOnAllWorkspaces: true,
      visibleOnFullScreen: true,
      focusable: true,
      contentProtection: true,
    },
    hideBehavior: {
      opacity: 0,
      ignoreMouseEvents: true,
      skipTaskbar: true,
      alwaysOnTop: true,
      alwaysOnTopLevel: 'screen-saver',
      visibleOnAllWorkspaces: true,
      visibleOnFullScreen: true,
      focusable: false,
      contentProtection: true,
    },
    platformSpecific: {
      darwin: {
        hiddenInMissionControl: true,
        windowButtonVisibility: false,
        backgroundColor: '#00000000',
        hasShadow: false,
      },
      win32: {
        thickFrame: false,
      },
    },
  },
};
