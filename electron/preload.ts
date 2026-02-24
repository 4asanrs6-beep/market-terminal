import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  getConstituents: (market: string) =>
    ipcRenderer.invoke('get-constituents', market),

  getStockQuotes: (symbols: string[]) =>
    ipcRenderer.invoke('get-stock-quotes', symbols),

  getChartData: (symbol: string, period: string, interval: string) =>
    ipcRenderer.invoke('get-chart-data', symbol, period, interval),

  getWatchlist: () =>
    ipcRenderer.invoke('get-watchlist'),

  addToWatchlist: (ticker: string) =>
    ipcRenderer.invoke('add-to-watchlist', ticker),

  removeFromWatchlist: (ticker: string) =>
    ipcRenderer.invoke('remove-from-watchlist', ticker),
})
