'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import orpc from '@/lib/orpc/client';

export function DemoSeedButton() {
  const [busy, setBusy] = useState(false);
  return <Button variant="outline" disabled={busy} onClick={async () => { setBusy(true); try { await orpc.demo.seed.call(); window.location.reload(); } finally { setBusy(false); } }}>{busy ? 'Loading demo…' : 'Load demo'}</Button>;
}
