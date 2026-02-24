/**
 * Simple packaging script: copies Electron dist + app files into a standalone folder.
 * The resulting folder can be launched by double-clicking "Market Terminal.exe".
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const OUT = path.join(ROOT, 'release', 'Market Terminal')
const ELECTRON_DIST = path.join(ROOT, 'node_modules', 'electron', 'dist')

// ------- helpers -------
function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true })
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath)
    } else {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

// ------- main -------
console.log('Packaging Market Terminal...')

// 1. Clean output
if (fs.existsSync(OUT)) {
  fs.rmSync(OUT, { recursive: true })
}
fs.mkdirSync(OUT, { recursive: true })

// 2. Copy Electron runtime
console.log('  Copying Electron runtime...')
copyDirSync(ELECTRON_DIST, OUT)

// 3. Rename electron.exe -> "Market Terminal.exe"
const electronExe = path.join(OUT, 'electron.exe')
const appExe = path.join(OUT, 'Market Terminal.exe')
if (fs.existsSync(electronExe)) {
  fs.renameSync(electronExe, appExe)
}

// 4. Create app directory structure inside resources/app
const appDir = path.join(OUT, 'resources', 'app')
fs.mkdirSync(appDir, { recursive: true })

// 5. Copy package.json (strip devDependencies and scripts)
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8'))
const prodPkg = {
  name: pkg.name,
  version: pkg.version,
  description: pkg.description,
  main: pkg.main,
}
fs.writeFileSync(path.join(appDir, 'package.json'), JSON.stringify(prodPkg, null, 2))

// 6. Copy built files
console.log('  Copying dist...')
copyDirSync(path.join(ROOT, 'dist'), path.join(appDir, 'dist'))

console.log('  Copying dist-electron...')
copyDirSync(path.join(ROOT, 'dist-electron'), path.join(appDir, 'dist-electron'))

console.log('')
console.log('Done! Packaged to:')
console.log('  ' + OUT)
console.log('')
console.log('Double-click "Market Terminal.exe" to launch.')
