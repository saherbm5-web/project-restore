'use client';

type BackgroundModePlugin = {
  enable: () => Promise<void>;
  disable: () => Promise<void>;
  isEnabled: () => Promise<boolean>;
  configure: (options: Record<string, unknown>) => Promise<void>;
};

type LocalNotificationsPlugin = {
  requestPermissions: () => Promise<{ display: string }>;
  schedule: (options: {
    notifications: {
      id: number;
      title: string;
      body: string;
      sound?: string;
      schedule?: { at: Date };
    }[];
  }) => Promise<void>;
};

type AppPlugin = {
  addListener: (event: string, callback: (data: unknown) => void) => Promise<void>;
};

let backgroundMode: BackgroundModePlugin | null = null;
let localNotifications: LocalNotificationsPlugin | null = null;
let app: AppPlugin | null = null;
let notificationsInitialized = false;

async function loadPlugins() {
  if (typeof window === 'undefined') return;
  try {
    if (!backgroundMode) {
      const mod = await import('@anuradev/capacitor-background-mode');
      backgroundMode = mod.BackgroundMode as unknown as BackgroundModePlugin;
    }
    if (!localNotifications) {
      const mod = await import('@capacitor/local-notifications');
      localNotifications = mod.LocalNotifications as unknown as LocalNotificationsPlugin;
    }
    if (!app) {
      const mod = await import('@capacitor/app');
      app = mod.App as unknown as AppPlugin;
    }
  } catch {
    // Web/SSR — plugins not available
  }
}

export async function enableBackgroundMode() {
  await loadPlugins();
  if (!backgroundMode) return;
  try {
    await backgroundMode.enable();
    await backgroundMode.configure({
      title: 'FOCUS ON-TAXI',
      text: 'جاري البحث عن سيارة...',
      silent: false,
    });
  } catch {
    // ignore
  }
}

export async function disableBackgroundMode() {
  await loadPlugins();
  if (!backgroundMode) return;
  try {
    await backgroundMode.disable();
  } catch {
    // ignore
  }
}

let notificationId = 1;

export async function notifyTaxiArrived() {
  await loadPlugins();
  if (!localNotifications) return;
  try {
    if (!notificationsInitialized) {
      await localNotifications.requestPermissions();
      notificationsInitialized = true;
    }
    await localNotifications.schedule({
      notifications: [
        {
          id: notificationId++,
          title: 'FOCUS ON-TAXI',
          body: 'التاكسي وصل لموقعك! تعال بسرعة',
          sound: 'default',
          schedule: { at: new Date() },
        },
      ],
    });
  } catch {
    // ignore
  }
}

export async function bringAppToForeground() {
  await loadPlugins();
  if (!app) return;
  try {
    // On native, focus the app
    // @ts-expect-error - activateIfExists is available on native
    if (typeof app.activateIfExists === 'function') {
      // @ts-expect-error
      await app.activateIfExists();
    }
  } catch {
    // ignore
  }
}
