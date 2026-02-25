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

  removeFromWatchlist: (listId: string, ticker: string) =>
    ipcRenderer.invoke('remove-from-watchlist', listId, ticker),

  getQuoteSummary: (symbol: string) =>
    ipcRenderer.invoke('get-quote-summary', symbol),

  getFinancials: (symbol: string) =>
    ipcRenderer.invoke('get-financials', symbol),

  getSparklines: (symbols: string[]) =>
    ipcRenderer.invoke('get-sparklines', symbols),

  openChartWindow: (symbol: string) =>
    ipcRenderer.invoke('open-chart-window', symbol),

  clearCache: () =>
    ipcRenderer.invoke('clear-cache'),
})
