const { execSync, spawn } = require('child_process')
const path = require('path')
const http = require('http')

const rootDir = path.join(__dirname, '..')

// Build electron main/preload
console.log('Building electron main process...')
execSync('node scripts/build-electron.js', { cwd: rootDir, stdio: 'inherit' })

// Wait for Vite dev server
function waitForVite(url, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    const check = () => {
      http.get(url, (res) => {
        if (res.statusCode === 200) {
          resolve()
        } else {
          retry()
        }
      }).on('error', retry)
    }
    const retry = () => {
      if (Date.now() - start > timeout) {
        reject(new Error('Vite server timeout'))
      } else {
        setTimeout(check, 500)
      }
    }
    check()
  })
}

async function main() {
  console.log('Waiting for Vite dev server...')
  await waitForVite('http://localhost:5173')
  console.log('Vite is ready, starting Electron...')

  // Set env for Electron to connect to Vite dev server
  // IMPORTANT: Remove ELECTRON_RUN_AS_NODE (set by VS Code) so Electron runs as a real app
  const env = { ...process.env, VITE_DEV_SERVER_URL: 'http://localhost:5173' }
  delete env.ELECTRON_RUN_AS_NODE

  const electronPath = require('electron')
  const child = spawn(electronPath, ['.'], {
    cwd: rootDir,
    stdio: 'inherit',
    env,
  })

  child.on('close', (code) => {
    process.exit(code)
  })
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
