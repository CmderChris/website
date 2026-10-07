import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'

const pipWalkRoot = fileURLToPath(new URL('../../packages/pip-walk', import.meta.url)).split(String.fromCharCode(92)).join('/')

// The scene's model, textures and environment map are served under /pip-walk/
// (the site passes that folder to <PipWalk assetBase>).
const pipWalkAssets = [
  'models/new_dog4.glb',
  'models/pomeranian_model/spitz_textures/texture/Spitz_Albedo3.png',
  'models/pomeranian_model/spitz_textures/texture/Spitz_Normal.png',
  'models/pomeranian_model/spitz_textures/texture/Spitz_Roughness.png',
  'models/pomeranian_model/spitz_textures/texture/Spitz_AO.png',
  'textures/Ground103_1K-PNG_NormalGL.png',
  'env/park.hdr',
]

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    viteStaticCopy({
      targets: pipWalkAssets.map((asset) => ({
        src: `${pipWalkRoot}/public/${asset}`,
        rename: { stripBase: true },
        dest: `pip-walk/${asset.slice(0, asset.lastIndexOf('/'))}`,
      })),
    }),
  ],
  resolve: {
    // In dev, use pip-walk's source so edits hot-reload; builds use its built output.
    alias:
      command === 'serve'
        ? [{ find: 'pip-walk', replacement: `${pipWalkRoot}/src/lib/index.ts` }]
        : [],
    // Make sure only one copy of these is ever bundled.
    dedupe: ['react', 'react-dom', 'three', '@react-three/fiber'],
  },
}))
