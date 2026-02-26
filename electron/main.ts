import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import path from 'path'
import fs from 'fs'
import { getStockQuotes, getChartData, get5DayChanges, getQuoteSummary, getFinancials, clearCache, searchTickers } from './services/marketData'
import { getConstituents, getSectorsForSymbols, MarketIndex } from './services/constituents'
import { generateMarketCommentary } from './services/aiService'
import { fetchNewsForSymbols } from './services/newsService'

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

ipcMain.handle('add-tickers-to-watchlist', async (_event, listId: string, tickers: string[]) => {
  const data = loadWatchlists()
  const list = data.lists.find(l => l.id === listId)
  if (list) {
    for (const t of tickers) {
      const upper = t.toUpperCase()
      if (!list.symbols.includes(upper)) {
        list.symbols.push(upper)
      }
    }
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

ipcMain.handle('export-watchlists', async () => {
  const data = loadWatchlists()
  if (data.lists.length === 0) return false

  const result = await dialog.showSaveDialog({
    title: 'ウォッチリストをエクスポート',
    defaultPath: 'watchlists.json',
    filters: [{ name: 'JSON', extensions: ['json'] }],
  })
  if (result.canceled || !result.filePath) return false

  const exportData = {
    lists: data.lists.map(l => ({ name: l.name, symbols: l.symbols })),
  }
  fs.writeFileSync(result.filePath, JSON.stringify(exportData, null, 2))
  return true
})

ipcMain.handle('import-watchlists', async () => {
  const result = await dialog.showOpenDialog({
    title: 'ウォッチリストをインポート',
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile'],
  })
  if (result.canceled || result.filePaths.length === 0) return null

  try {
    const raw = fs.readFileSync(result.filePaths[0], 'utf-8')
    const imported = JSON.parse(raw) as { lists: { name: string; symbols: string[] }[] }
    if (!Array.isArray(imported.lists)) return null

    const data = loadWatchlists()
    for (const entry of imported.lists) {
      if (!entry.name || !Array.isArray(entry.symbols)) continue
      const existing = data.lists.find(l => l.name === entry.name)
      if (existing) {
        // Merge symbols into existing list
        for (const s of entry.symbols) {
          const upper = s.toUpperCase()
          if (!existing.symbols.includes(upper)) {
            existing.symbols.push(upper)
          }
        }
      } else {
        // Create new list
        data.lists.push({
          id: generateId(),
          name: entry.name,
          symbols: entry.symbols.map(s => s.toUpperCase()),
        })
      }
    }
    saveWatchlists(data)
    return data
  } catch (err) {
    console.error('import-watchlists error:', err)
    return null
  }
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


ipcMain.handle('open-chart-window', async (_event, symbol: string) => {
  openChartWindow(symbol)
})

ipcMain.handle('clear-cache', async () => {
  clearCache()
})

ipcMain.handle('search-tickers', async (_event, query: string) => {
  try {
    return await searchTickers(query)
  } catch (err) {
    console.error('search-tickers error:', err)
    return []
  }
})

// --- AI IPC Handlers ---

ipcMain.handle('ai-market-commentary', async (event, summary) => {
  const requestId = Date.now().toString()
  const sender = event.sender

  // 1) Fetch news BEFORE returning requestId (renderer shows loading spinner)
  const gainers = (summary.topGainers ?? []).slice(0, 5).map((g: any) => g.symbol as string)
  const losers = (summary.topLosers ?? []).slice(0, 5).map((l: any) => l.symbol as string)
  const newsSymbols = [...new Set([...gainers, ...losers])]

  let news: Record<string, { title: string; publisher: string; publishedAt?: string }[]> = {}
  try {
    if (newsSymbols.length > 0) {
      news = await fetchNewsForSymbols(newsSymbols)
      const totalArticles = Object.values(news).reduce((sum, items) => sum + items.length, 0)
      console.log(`[news] ${totalArticles} articles for ${newsSymbols.length} symbols`)
    }
  } catch (err) {
    console.error('News fetch failed, continuing without news:', err)
  }

  // 2) Start streaming AFTER returning requestId
  //    (setTimeout guarantees renderer has received requestId)
  setTimeout(async () => {
    try {
      const gen = generateMarketCommentary(summary, news)
      for await (const text of gen) {
        if (!sender.isDestroyed()) {
          sender.send('ai-stream-chunk', { requestId, text })
        }
      }
      if (!sender.isDestroyed()) {
        sender.send('ai-stream-done', { requestId })
      }
    } catch (err: any) {
      if (!sender.isDestroyed()) {
        sender.send('ai-stream-error', { requestId, error: err.message || 'Unknown error' })
      }
    }
  }, 0)

  return requestId
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
