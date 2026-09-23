'use client';

import { useEffect, useState } from 'react';
import { getDeviceId } from '@/lib/device-id';

/** Anonymous device ID; null until mounted (localStorage is client-only). */
export function useDeviceId(): string | null {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => setId(getDeviceId()), []);
  return id;
}
