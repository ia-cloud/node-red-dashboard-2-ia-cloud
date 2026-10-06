import { resolve } from 'path'

import vue from '@vitejs/plugin-vue'
import { defineConfig, normalizePath } from 'vite'
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import vueDevTools from 'vite-plugin-vue-devtools'

// Set to this to the name of this collection of components
// This must match node-red-dashboard-2.widgets[libraryName] in package.json
const LIBRARY_NAME = {
    'ui-dateset-2': 'ui/entries/ui-dateset-2.js',
    'ui-lamps-2': 'ui/entries/ui-lamps-2.js',
    'ui-num-dt-2': 'ui/entries/ui-num-dt-2.js',
    'ui-oprstatus-2': 'ui/entries/ui-oprstatus-2.js',
    'ui-spreadsheet-2': 'ui/entries/ui-spreadsheet-2.js',
    'ui-table-2': 'ui/entries/ui-table-2.js'
}

const NAME = process.env.WIDGET || 'ui-table-2'
if (!LIBRARY_NAME[NAME]) throw new Error(`Unknown widget: ${NAME}`)

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        vue(),
        cssInjectedByJsPlugin(),
        viteStaticCopy({
            targets: [
                {
                    // Copy the build output into Node-RED's /resources folder
                    src: normalizePath(resolve(__dirname, `./ui/dist/${NAME}.umd.js`)),
                    dest: normalizePath(resolve(__dirname, 'resources'))
                }
            ]
        }),
        vueDevTools()
    ],
    build: {
        // Generate a source map in dev mode
        sourcemap: process.env.NODE_ENV === 'development',

        // Configure build as a UMD library
        lib: {
            entry: resolve(__dirname, LIBRARY_NAME[NAME]),
            name: NAME,
            formats: ['umd'],
            fileName: (format, name) => `${NAME}.${format}.js`
        },

        // This is the target location for the build output
        outDir: './ui/dist',

        // Declare dependencies that shouldn't be bundled into the library
        rollupOptions: {
            // Don't rollup the Vue dependency into the build
            external: ['vue', 'vuex'],
            output: {
                // Provide global variables to use in the UMD build
                globals: {
                    vue: 'Vue',
                    vuex: 'vuex'
                }
            }
        }
    }
})
