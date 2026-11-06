import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.fontaxi.app',
  appName: 'FON TAXI',
  webDir: 'out',
  android: {
    backgroundColor: '#0a0a0a',
    allowMixedContent: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#0a0a0a',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    App: {
      disableBackButtonHandler: false,
    },
  },
};

export default config;
