import { BrowserWindowConstructorOptions } from 'electron';

export interface WindowVisibilityConfig {
  opacity: number;
  ignoreMouseEvents: boolean;
  skipTaskbar: boolean;
  alwaysOnTop: boolean;
  alwaysOnTopLevel:
    | 'normal'
    | 'floating'
    | 'torn-off-menu'
    | 'modal-panel'
    | 'main-menu'
    | 'status'
    | 'pop-up-menu'
    | 'screen-saver';
  visibleOnAllWorkspaces: boolean;
  visibleOnFullScreen: boolean;
  focusable: boolean;
  contentProtection: boolean;
}

export interface WindowPlatformConfig {
  darwin?: {
    hiddenInMissionControl: boolean;
    windowButtonVisibility: boolean;
    backgroundColor: string;
    hasShadow: boolean;
  };
  win32?: {
    thickFrame: boolean;
  };
}

export interface WindowBehaviorConfig {
  showBehavior: WindowVisibilityConfig;
  hideBehavior: WindowVisibilityConfig;
  platformSpecific: WindowPlatformConfig;
}

export interface WindowConfig {
  baseSettings: BrowserWindowConstructorOptions;
  behavior: WindowBehaviorConfig;
}
