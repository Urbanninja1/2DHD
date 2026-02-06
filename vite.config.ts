import { defineConfig } from 'vite';
import glsl from 'vite-plugin-glsl';
import { resolve } from 'path';

export default defineConfig({
  plugins: [glsl()],
  resolve: {
    alias: {
      '@ecs': resolve(__dirname, 'src/ecs'),
      '@rooms': resolve(__dirname, 'src/rooms'),
      '@rendering': resolve(__dirname, 'src/rendering'),
      '@loaders': resolve(__dirname, 'src/loaders'),
      '@input': resolve(__dirname, 'src/input'),
    },
  },
  assetsInclude: ['**/*.glb', '**/*.hdr', '**/*.ktx2'],
});
