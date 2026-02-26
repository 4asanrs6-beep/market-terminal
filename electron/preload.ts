import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  getConstituents: (market: string) =>
    ipcRenderer.invoke('get-constituents', market),

  getStockQuotes: (symbols: string[]) =>
    ipcRenderer.invoke('get-stock-quotes', symbols),

  getChartData: (symbol: string, period: string, interval: string) =>
    ipcRenderer.invoke('get-chart-data', symbol, period, interval),

  get5DayChanges: (symbols: string[]) =>
    ipcRenderer.invoke('get-5day-changes', symbols),

  getSectors: (symbols: string[]) =>
    ipcRenderer.invoke('get-sectors', symbols),

  getWatchlists: () =>
    ipcRenderer.invoke('get-watchlists'),

  createWatchlist: (name: string) =>
    ipcRenderer.invoke('create-watchlist', name),

  renameWatchlist: (id: string, name: string) =>
    ipcRenderer.invoke('rename-watchlist', id, name),

  deleteWatchlist: (id: string) =>
    ipcRenderer.invoke('delete-watchlist', id),

  addToWatchlist: (listId: string, ticker: string) =>
    ipcRenderer.invoke('add-to-watchlist', listId, ticker),

  addTickersToWatchlist: (listId: string, tickers: string[]) =>
    ipcRenderer.invoke('add-tickers-to-watchlist', listId, tickers),

  removeFromWatchlist: (listId: string, ticker: string) =>
    ipcRenderer.invoke('remove-from-watchlist', listId, ticker),

  searchTickers: (query: string) =>
    ipcRenderer.invoke('search-tickers', query),

  exportWatchlists: () =>
    ipcRenderer.invoke('export-watchlists'),

  importWatchlists: () =>
    ipcRenderer.invoke('import-watchlists'),

  getQuoteSummary: (symbol: string) =>
    ipcRenderer.invoke('get-quote-summary', symbol),

  getFinancials: (symbol: string) =>
    ipcRenderer.invoke('get-financials', symbol),

  openChartWindow: (symbol: string) =>
    ipcRenderer.invoke('open-chart-window', symbol),

  clearCache: () =>
    ipcRenderer.invoke('clear-cache'),

  // AI
  aiMarketCommentary: (summary: any) =>
    ipcRenderer.invoke('ai-market-commentary', summary),

  onAIStreamChunk: (cb: (data: { requestId: string; text: string }) => void) =>
    ipcRenderer.on('ai-stream-chunk', (_e, d) => cb(d)),

  onAIStreamDone: (cb: (data: { requestId: string }) => void) =>
    ipcRenderer.on('ai-stream-done', (_e, d) => cb(d)),

  onAIStreamError: (cb: (data: { requestId: string; error: string }) => void) =>
    ipcRenderer.on('ai-stream-error', (_e, d) => cb(d)),

  removeAIStreamListeners: () => {
    ipcRenderer.removeAllListeners('ai-stream-chunk')
    ipcRenderer.removeAllListeners('ai-stream-done')
    ipcRenderer.removeAllListeners('ai-stream-error')
  },
})
