import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { federation } from '@module-federation/vite'

// Module Federation remote. Exposes RemoteLogin for platform-core (or any
// other module) to load at runtime - see src/remote/RemoteLogin.tsx.
//
// Federation's remote side needs a real build (`vite build --watch`,
// served statically), not `vite dev` - the dev server has no bundling
// step to emit remoteEntry.js from. See docker-compose.yml's command for
// this service.
export default defineConfig({
  plugins: [
    react(),
    federation({
      name: 'platformAuth',
      filename: 'remoteEntry.js',
      exposes: {
        './RemoteLogin': './src/remote/RemoteLogin.tsx',
      },
      shared: {
        react: { singleton: true, requiredVersion: '^19.0.0' },
        'react-dom': { singleton: true, requiredVersion: '^19.0.0' },
      },
      // We load remotes dynamically at runtime (loadRemote), never as a
      // build-time typed import - this cross-app .d.ts generation feature
      // is unused and fails on this project's tsconfig setup.
      dts: false,
    }),
  ],
  // Origin the browser actually reaches this module at - must match the
  // gateway's external port (see root docker-compose.yml/nginx), since
  // remoteEntry.js embeds this to resolve its own shared-chunk URLs.
  server: { origin: 'http://localhost:41830' },
  build: { target: 'chrome89' },
})
