'use client';

import * as React from 'react';

export type ToastProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export type ToastActionElement = React.ReactElement;

export function Toast({ ...props }: ToastProps) {
  return null;
}
