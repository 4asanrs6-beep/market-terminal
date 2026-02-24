import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import fs from 'fs'
import { getStockQuotes, getChartData, get5DayChanges } from './services/marketData'
import { getConstituents, MarketIndex } from './services/constituents'

const DIST = path.join(__dirname, '../dist')
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

let win: BrowserWindow | null = null

function createWindow() {
  win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    title: 'Market Terminal',
    backgroundColor: '#0a0a0a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(DIST, 'index.html'))
  }
}

// --- Watchlist persistence ---
let _watchlistPath = ''

function getWatchlistPath() {
  if (!_watchlistPath) {
    _watchlistPath = path.join(app.getPath('userData'), 'watchlist.json')
  }
  return _watchlistPath
}

function loadWatchlist(): string[] {
  try {
    const data = fs.readFileSync(getWatchlistPath(), 'utf-8')
    return JSON.parse(data)
  } catch {
    return []
  }
}

function saveWatchlist(list: string[]) {
  fs.writeFileSync(getWatchlistPath(), JSON.stringify(list, null, 2))
}

// --- IPC Handlers ---

ipcMain.handle('get-constituents', async (_event, market: MarketIndex) => {
  return getConstituents(market)
})

ipcMain.handle('get-stock-quotes', async (_event, symbols: string[]) => {
  try {
    return await getStockQuotes(symbols)
  } catch (err) {
    console.error('get-stock-quotes error:', err)
    return []
  }
})

ipcMain.handle('get-5day-changes', async (_event, symbols: string[]) => {
  try {
    return await get5DayChanges(symbols)
  } catch (err) {
    console.error('get-5day-changes error:', err)
    return {}
  }
})

ipcMain.handle('get-chart-data', async (_event, symbol: string, period: string, interval: string) => {
  try {
    return await getChartData(symbol, period, interval)
  } catch (err) {
    console.error('get-chart-data error:', err)
    return []
  }
})

ipcMain.handle('get-watchlist', async () => {
  return loadWatchlist()
})

ipcMain.handle('add-to-watchlist', async (_event, ticker: string) => {
  const list = loadWatchlist()
  if (!list.includes(ticker.toUpperCase())) {
    list.push(ticker.toUpperCase())
    saveWatchlist(list)
  }
  return list
})

ipcMain.handle('remove-from-watchlist', async (_event, ticker: string) => {
  let list = loadWatchlist()
  list = list.filter(t => t !== ticker.toUpperCase())
  saveWatchlist(list)
  return list
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(createWindow)
