import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Unmount React trees between UI tests (vitest globals are off, so RTL can't auto-register this).
afterEach(() => {
  cleanup();
});
