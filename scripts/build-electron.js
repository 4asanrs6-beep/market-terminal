const esbuild = require('esbuild')
const path = require('path')
const fs = require('fs')

async function build() {
  const outDir = path.join(__dirname, '../dist-electron')

  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true })
  }

  // Build main process
  await esbuild.build({
    entryPoints: [path.join(__dirname, '../electron/main.ts')],
    bundle: true,
    platform: 'node',
    outfile: path.join(outDir, 'main.js'),
    external: ['electron'],
    format: 'cjs',
    sourcemap: true,
    target: 'node18',
  })

  // Build preload
  await esbuild.build({
    entryPoints: [path.join(__dirname, '../electron/preload.ts')],
    bundle: true,
    platform: 'node',
    outfile: path.join(outDir, 'preload.js'),
    external: ['electron'],
    format: 'cjs',
    sourcemap: true,
    target: 'node18',
  })

  console.log('Electron build complete')
}

build().catch(err => {
  console.error(err)
  process.exit(1)
})
