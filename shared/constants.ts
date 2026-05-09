export const IPC_EVENTS = {
  OVERLAY: {
    TOGGLE: 'overlay:toggle',
    SHOW: 'overlay:show',
    HIDE: 'overlay:hide',
    EXPAND: 'overlay:expand',
    COLLAPSE: 'overlay:collapse',
  },
  SCREENSHOT: {
    TAKE: 'screenshot:take',
    TAKEN: 'screenshot:taken',
    CLEAR: 'screenshot:clear',
  },
  WINDOW: {
    UPDATE_DIMENSIONS: 'window:update-dimensions',
    MOVE_LEFT: 'window:move-left',
    MOVE_RIGHT: 'window:move-right',
    MOVE_UP: 'window:move-up',
    MOVE_DOWN: 'window:move-down',
  },
  AUTH: {
    SET_TOKEN: 'auth:set-token',
    GET_TOKEN: 'auth:get-token',
    CLEAR_TOKEN: 'auth:clear-token',
    IS_AUTHENTICATED: 'auth:is-authenticated',
  },
} as const;
