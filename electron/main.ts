import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import fs from 'fs'
import { getStockQuotes, getChartData, get5DayChanges, getQuoteSummary, getFinancials, getSparklines } from './services/marketData'
import { getConstituents, getSectorsForSymbols, MarketIndex } from './services/constituents'

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

function openChartWindow(symbol: string) {
  const chartWin = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 500,
    title: `${symbol} - Chart`,
    backgroundColor: '#0a0a0a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (VITE_DEV_SERVER_URL) {
    chartWin.loadURL(`${VITE_DEV_SERVER_URL}chart.html?symbol=${encodeURIComponent(symbol)}`)
  } else {
    chartWin.loadFile(path.join(DIST, 'chart.html'), {
      query: { symbol },
    })
  }
}

// --- Watchlists persistence (multiple named lists) ---

interface WatchlistEntry {
  id: string
  name: string
  symbols: string[]
}

interface WatchlistsData {
  lists: WatchlistEntry[]
}

let _nextId = 1

function getWatchlistsPath() {
  return path.join(app.getPath('userData'), 'watchlists.json')
}

function loadWatchlists(): WatchlistsData {
  const filePath = getWatchlistsPath()
  try {
    const data = fs.readFileSync(filePath, 'utf-8')
    const parsed = JSON.parse(data) as WatchlistsData
    // Update _nextId to avoid collisions
    for (const l of parsed.lists) {
      const m = l.id.match(/^wl_(\d+)$/)
      if (m) _nextId = Math.max(_nextId, parseInt(m[1], 10) + 1)
    }
    return parsed
  } catch {
    // Migrate from old watchlist.json if it exists
    const oldPath = path.join(app.getPath('userData'), 'watchlist.json')
    try {
      const oldData = fs.readFileSync(oldPath, 'utf-8')
      const oldList: string[] = JSON.parse(oldData)
      if (oldList.length > 0) {
        const migrated: WatchlistsData = {
          lists: [{ id: 'wl_1', name: 'ウォッチリスト', symbols: oldList }],
        }
        _nextId = 2
        saveWatchlists(migrated)
        return migrated
      }
    } catch { /* no old file either */ }
    return { lists: [] }
  }
}

function saveWatchlists(data: WatchlistsData) {
  fs.writeFileSync(getWatchlistsPath(), JSON.stringify(data, null, 2))
}

function generateId(): string {
  return `wl_${_nextId++}`
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

ipcMain.handle('get-sectors', async (_event, symbols: string[]) => {
  return getSectorsForSymbols(symbols)
})

ipcMain.handle('get-chart-data', async (_event, symbol: string, period: string, interval: string) => {
  try {
    return await getChartData(symbol, period, interval)
  } catch (err) {
    console.error('get-chart-data error:', err)
    return []
  }
})

ipcMain.handle('get-watchlists', async () => {
  return loadWatchlists()
})

ipcMain.handle('create-watchlist', async (_event, name: string) => {
  const data = loadWatchlists()
  const newList: WatchlistEntry = { id: generateId(), name, symbols: [] }
  data.lists.push(newList)
  saveWatchlists(data)
  return data
})

ipcMain.handle('rename-watchlist', async (_event, id: string, name: string) => {
  const data = loadWatchlists()
  const list = data.lists.find(l => l.id === id)
  if (list) {
    list.name = name
    saveWatchlists(data)
  }
  return data
})

ipcMain.handle('delete-watchlist', async (_event, id: string) => {
  const data = loadWatchlists()
  data.lists = data.lists.filter(l => l.id !== id)
  saveWatchlists(data)
  return data
})

ipcMain.handle('add-to-watchlist', async (_event, listId: string, ticker: string) => {
  const data = loadWatchlists()
  const list = data.lists.find(l => l.id === listId)
  if (list && !list.symbols.includes(ticker.toUpperCase())) {
    list.symbols.push(ticker.toUpperCase())
    saveWatchlists(data)
  }
  return data
})

ipcMain.handle('remove-from-watchlist', async (_event, listId: string, ticker: string) => {
  const data = loadWatchlists()
  const list = data.lists.find(l => l.id === listId)
  if (list) {
    list.symbols = list.symbols.filter(s => s !== ticker.toUpperCase())
    saveWatchlists(data)
  }
  return data
})

ipcMain.handle('get-quote-summary', async (_event, symbol: string) => {
  try {
    return await getQuoteSummary(symbol)
  } catch (err) {
    console.error('get-quote-summary error:', err)
    return null
  }
})

ipcMain.handle('get-financials', async (_event, symbol: string) => {
  try {
    return await getFinancials(symbol)
  } catch (err) {
    console.error('get-financials error:', err)
    return null
  }
})

ipcMain.handle('get-sparklines', async (_event, symbols: string[]) => {
  try {
    return await getSparklines(symbols)
  } catch (err) {
    console.error('get-sparklines error:', err)
    return {}
  }
})

ipcMain.handle('open-chart-window', async (_event, symbol: string) => {
  openChartWindow(symbol)
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
