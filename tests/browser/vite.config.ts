import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  root: 'tests/fixtures/browser',
  plugins: [react()],
});
