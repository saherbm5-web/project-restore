'use client';

import { Toaster as SonnerToaster } from 'sonner';

export const Toaster = () => (
  <SonnerToaster
    position="top-center"
    toastOptions={{
      style: {
        background: '#162447',
        border: '1px solid rgba(201,168,106,0.3)',
        color: '#E8D5A3',
        fontFamily: 'inherit',
      },
    }}
  />
);

export { Toaster as SonnerToaster };
