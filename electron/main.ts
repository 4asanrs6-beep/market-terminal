import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import path from 'path'
import fs from 'fs'
import { getStockQuotes, getChartData, get5DayChanges, getPreviousDayChanges, getQuoteSummary, getFinancials, clearCache, searchTickers } from './services/marketData'
import { getConstituents, getSectorsForSymbols, MarketIndex, DEFAULT_FUTURES_LIST, updateFuturesSectorMap } from './services/constituents'
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

// --- Futures list persistence ---

interface FuturesEntry {
  symbol: string
  name: string
  sector: string
}

interface FuturesFileData {
  version: number
  list: FuturesEntry[]
}

// Bump this when DEFAULT_FUTURES_LIST changes to force a refresh
const FUTURES_LIST_VERSION = 2

function getFuturesPath() {
  return path.join(app.getPath('userData'), 'futures.json')
}

function loadFuturesList(): FuturesEntry[] {
  const filePath = getFuturesPath()
  try {
    const data = fs.readFileSync(filePath, 'utf-8')
    const parsed = JSON.parse(data)
    // Check versioned format
    if (parsed.version && parsed.version >= FUTURES_LIST_VERSION && Array.isArray(parsed.list)) {
      updateFuturesSectorMap(parsed.list)
      return parsed.list
    }
    // Old format or outdated version -> replace with new defaults
    saveFuturesList(DEFAULT_FUTURES_LIST as FuturesEntry[])
    return [...DEFAULT_FUTURES_LIST]
  } catch {
    // First run: use defaults
    saveFuturesList(DEFAULT_FUTURES_LIST as FuturesEntry[])
    return [...DEFAULT_FUTURES_LIST]
  }
}

function saveFuturesList(list: FuturesEntry[]) {
  const data: FuturesFileData = { version: FUTURES_LIST_VERSION, list }
  fs.writeFileSync(getFuturesPath(), JSON.stringify(data, null, 2))
  updateFuturesSectorMap(list)
}

// --- AI Briefing History persistence ---

interface BriefingEntry {
  id: string
  marketName: string
  timestamp: string
  text: string
}

interface BriefingHistoryData {
  entries: BriefingEntry[]
}

function getBriefingHistoryPath() {
  return path.join(app.getPath('userData'), 'ai-briefing-history.json')
}

function loadBriefingHistory(): BriefingHistoryData {
  try {
    const data = fs.readFileSync(getBriefingHistoryPath(), 'utf-8')
    return JSON.parse(data) as BriefingHistoryData
  } catch {
    return { entries: [] }
  }
}

function saveBriefingHistory(data: BriefingHistoryData) {
  // Keep max 100 entries
  if (data.entries.length > 100) {
    data.entries = data.entries.slice(-100)
  }
  fs.writeFileSync(getBriefingHistoryPath(), JSON.stringify(data, null, 2))
}

// --- Favorites persistence ---

function getFavoritesPath() {
  return path.join(app.getPath('userData'), 'favorites.json')
}

function loadFavorites(): string[] {
  try {
    const data = fs.readFileSync(getFavoritesPath(), 'utf-8')
    return JSON.parse(data) as string[]
  } catch {
    return []
  }
}

function saveFavorites(symbols: string[]) {
  fs.writeFileSync(getFavoritesPath(), JSON.stringify(symbols, null, 2))
}

// --- IPC Handlers ---

ipcMain.handle('get-constituents', async (_event, market: MarketIndex) => {
  if (market === 'futures') {
    const list = loadFuturesList()
    return list.map(f => ({ symbol: f.symbol, name: f.name, sector: f.sector }))
  }
  return getConstituents(market)
})

ipcMain.handle('add-to-futures', async (_event, entry: FuturesEntry) => {
  const list = loadFuturesList()
  if (!list.some(f => f.symbol === entry.symbol)) {
    list.push(entry)
    saveFuturesList(list)
  }
  return list
})

ipcMain.handle('remove-from-futures', async (_event, symbol: string) => {
  let list = loadFuturesList()
  list = list.filter(f => f.symbol !== symbol)
  saveFuturesList(list)
  return list
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

ipcMain.handle('get-previous-day-changes', async (_event, symbols: string[]) => {
  try {
    return await getPreviousDayChanges(symbols)
  } catch (err) {
    console.error('get-previous-day-changes error:', err)
    return {}
  }
})

ipcMain.handle('get-sectors', async (_event, symbols: string[]) => {
  return getSectorsForSymbols(symbols)
})

ipcMain.handle('get-favorites', async () => {
  return loadFavorites()
})

ipcMain.handle('toggle-favorite', async (_event, symbol: string) => {
  const favorites = loadFavorites()
  const upper = symbol.toUpperCase()
  const idx = favorites.indexOf(upper)
  if (idx >= 0) {
    favorites.splice(idx, 1)
  } else {
    favorites.push(upper)
  }
  saveFavorites(favorites)
  return favorites
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

ipcMain.handle('export-data', async (_event, options: { watchlists: boolean; futures: boolean; favorites: boolean }) => {
  const exportData: any = {}

  if (options.watchlists) {
    const data = loadWatchlists()
    exportData.lists = data.lists.map(l => ({ name: l.name, symbols: l.symbols }))
  }
  if (options.futures) {
    exportData.futures = loadFuturesList()
  }
  if (options.favorites) {
    exportData.favorites = loadFavorites()
  }

  if (Object.keys(exportData).length === 0) return false

  const result = await dialog.showSaveDialog({
    title: 'データをエクスポート',
    defaultPath: 'market-terminal-export.json',
    filters: [{ name: 'JSON', extensions: ['json'] }],
  })
  if (result.canceled || !result.filePath) return false

  fs.writeFileSync(result.filePath, JSON.stringify(exportData, null, 2))
  return true
})

ipcMain.handle('import-data', async () => {
  const result = await dialog.showOpenDialog({
    title: 'データをインポート',
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile'],
  })
  if (result.canceled || result.filePaths.length === 0) return null

  try {
    const raw = fs.readFileSync(result.filePaths[0], 'utf-8')
    const imported = JSON.parse(raw)
    const imported_: { watchlists: boolean; futures: boolean; favorites: boolean } = {
      watchlists: false, futures: false, favorites: false,
    }

    // Import watchlists
    if (Array.isArray(imported.lists)) {
      const data = loadWatchlists()
      for (const entry of imported.lists) {
        if (!entry.name || !Array.isArray(entry.symbols)) continue
        const existing = data.lists.find(l => l.name === entry.name)
        if (existing) {
          for (const s of entry.symbols) {
            const upper = s.toUpperCase()
            if (!existing.symbols.includes(upper)) {
              existing.symbols.push(upper)
            }
          }
        } else {
          data.lists.push({
            id: generateId(),
            name: entry.name,
            symbols: entry.symbols.map((s: string) => s.toUpperCase()),
          })
        }
      }
      saveWatchlists(data)
      imported_.watchlists = true
    }

    // Import futures
    if (Array.isArray(imported.futures)) {
      const current = loadFuturesList()
      for (const entry of imported.futures) {
        if (!entry.symbol) continue
        if (!current.some(f => f.symbol === entry.symbol)) {
          current.push({ symbol: entry.symbol, name: entry.name || entry.symbol, sector: entry.sector || '' })
        }
      }
      saveFuturesList(current)
      imported_.futures = true
    }

    // Import favorites
    if (Array.isArray(imported.favorites)) {
      const current = loadFavorites()
      for (const s of imported.favorites) {
        const upper = (s as string).toUpperCase()
        if (!current.includes(upper)) {
          current.push(upper)
        }
      }
      saveFavorites(current)
      imported_.favorites = true
    }

    return imported_
  } catch (err) {
    console.error('import-data error:', err)
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

// --- Briefing History IPC Handlers ---

ipcMain.handle('save-briefing', async (_event, entry: { marketName: string; text: string }) => {
  const data = loadBriefingHistory()
  const newEntry: BriefingEntry = {
    id: `br_${Date.now()}`,
    marketName: entry.marketName,
    timestamp: new Date().toISOString(),
    text: entry.text,
  }
  data.entries.push(newEntry)
  saveBriefingHistory(data)
  return data
})

ipcMain.handle('get-briefing-history', async () => {
  return loadBriefingHistory()
})

ipcMain.handle('delete-briefing', async (_event, id: string) => {
  const data = loadBriefingHistory()
  data.entries = data.entries.filter(e => e.id !== id)
  saveBriefingHistory(data)
  return data
})

// --- AI IPC Handlers ---

ipcMain.handle('ai-market-commentary', async (event, summary) => {
  const requestId = Date.now().toString()
  const sender = event.sender

  // 1) Fetch news BEFORE returning requestId (renderer shows loading spinner)
  //    Cover daily top movers, weekly top movers, and top volume for comprehensive news
  const gainers = (summary.topGainers ?? []).slice(0, 10).map((g: any) => g.symbol as string)
  const losers = (summary.topLosers ?? []).slice(0, 10).map((l: any) => l.symbol as string)
  const weeklyGainers = (summary.weeklyGainers ?? []).slice(0, 10).map((g: any) => g.symbol as string)
  const weeklyLosers = (summary.weeklyLosers ?? []).slice(0, 10).map((l: any) => l.symbol as string)
  const topVol = (summary.topVolume ?? []).slice(0, 5).map((v: any) => v.symbol as string)
  const newsSymbols = [...new Set([...gainers, ...losers, ...weeklyGainers, ...weeklyLosers, ...topVol])]

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
