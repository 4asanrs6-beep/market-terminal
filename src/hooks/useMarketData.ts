import { useState, useEffect, useCallback, useRef } from 'react'
import type { StockQuote, ConstituentInfo, MarketIndex, ChartPoint, WatchlistInfo, WatchlistsData } from '../types/stock'

// Helper: extract watchlist ID from market string like 'watchlist:wl_1'
function getWatchlistId(market: MarketIndex): string | null {
  if (market.startsWith('watchlist:')) return market.slice('watchlist:'.length)
  return null
}

export function useMarketData(market: MarketIndex, watchlists: WatchlistInfo[]) {
  const [constituents, setConstituents] = useState<ConstituentInfo[]>([])
  const [quotes, setQuotes] = useState<StockQuote[]>([])
  const [loading, setLoading] = useState(true)
  const [deferredLoading, setDeferredLoading] = useState(false)
  const requestIdRef = useRef(0)

  const fetchQuotes = useCallback(async (symbols: string[], reqId: number, constituentNames?: Record<string, string>) => {
    if (symbols.length === 0) {
      setQuotes([])
      setLoading(false)
      return
    }
    try {
      const data = await window.electronAPI.getStockQuotes(symbols)
      if (requestIdRef.current !== reqId) return // stale request
      // Override shortName with constituent names if available (useful for futures with Japanese names)
      if (constituentNames) {
        for (const q of data) {
          if (constituentNames[q.symbol]) {
            q.shortName = constituentNames[q.symbol]
          }
        }
      }
      setQuotes(data)
      setLoading(false)

      const sectorMap = await window.electronAPI.getSectors(symbols)
      if (requestIdRef.current !== reqId) return
      setQuotes(prev => prev.map(q => ({
        ...q,
        sector: sectorMap[q.symbol] || q.sector || '',
      })))

      try {
        setDeferredLoading(true)
        const [fiveDayMap, prevDayMap] = await Promise.all([
          window.electronAPI.get5DayChanges(symbols),
          window.electronAPI.getPreviousDayChanges(symbols),
        ])
        if (requestIdRef.current !== reqId) return
        setQuotes(prev => prev.map(q => ({
          ...q,
          fiveDayChangePercent: fiveDayMap[q.symbol] ?? undefined,
          previousDayChangePercent: prevDayMap[q.symbol] ?? undefined,
        })))
      } catch (err) {
        console.error('Failed to fetch 5-day/previous-day changes:', err)
      } finally {
        if (requestIdRef.current === reqId) setDeferredLoading(false)
      }

    } catch (err) {
      if (requestIdRef.current !== reqId) return
      console.error('Failed to fetch quotes:', err)
      setLoading(false)
    }
  }, [])

  const loadMarketData = useCallback(async () => {
    const reqId = ++requestIdRef.current
    setLoading(true)
    try {
      const wlId = getWatchlistId(market)
      if (market === 'favorites') {
        const symbols = await window.electronAPI.getFavorites()
        if (requestIdRef.current !== reqId) return
        setConstituents(symbols.map(s => ({ symbol: s, name: s, sector: '' })))
        await fetchQuotes(symbols, reqId)
      } else if (wlId) {
        const wl = watchlists.find(l => l.id === wlId)
        const symbols = wl ? wl.symbols : []
        setConstituents(symbols.map(s => ({ symbol: s, name: s, sector: '' })))
        await fetchQuotes(symbols, reqId)
      } else {
        const list = await window.electronAPI.getConstituents(market)
        if (requestIdRef.current !== reqId) return
        setConstituents(list)
        const symbols = list.map(c => c.symbol)
        // Build name map for non-stock markets (futures etc.) where constituent names are more descriptive
        const nameMap: Record<string, string> = {}
        for (const c of list) {
          if (c.name && c.name !== c.symbol) {
            nameMap[c.symbol] = c.name
          }
        }
        await fetchQuotes(symbols, reqId, Object.keys(nameMap).length > 0 ? nameMap : undefined)
      }
    } catch (err) {
      if (requestIdRef.current !== reqId) return
      console.error('Failed to load market data:', err)
      setLoading(false)
    }
  }, [market, watchlists, fetchQuotes])

  const refresh = useCallback(async () => {
    const reqId = ++requestIdRef.current
    await window.electronAPI.clearCache()
    const wlId = getWatchlistId(market)
    let symbols: string[]
    if (wlId) {
      const wl = watchlists.find(l => l.id === wlId)
      symbols = wl ? wl.symbols : []
    } else {
      symbols = constituents.map(c => c.symbol)
    }
    if (symbols.length > 0) {
      await fetchQuotes(symbols, reqId)
    }
  }, [market, watchlists, constituents, fetchQuotes])

  useEffect(() => {
    loadMarketData()
  }, [loadMarketData])

  return {
    constituents,
    quotes,
    loading,
    deferredLoading,
    refresh,
    reload: loadMarketData,
  }
}

export function useWatchlists() {
  const [watchlistsData, setWatchlistsData] = useState<WatchlistsData>({ lists: [] })

  useEffect(() => {
    window.electronAPI.getWatchlists().then(setWatchlistsData)
  }, [])

  const createWatchlist = useCallback(async (name: string) => {
    const data = await window.electronAPI.createWatchlist(name)
    setWatchlistsData(data)
    return data
  }, [])

  const renameWatchlist = useCallback(async (id: string, name: string) => {
    const data = await window.electronAPI.renameWatchlist(id, name)
    setWatchlistsData(data)
  }, [])

  const deleteWatchlist = useCallback(async (id: string) => {
    const data = await window.electronAPI.deleteWatchlist(id)
    setWatchlistsData(data)
  }, [])

  const addToWatchlist = useCallback(async (listId: string, ticker: string) => {
    const data = await window.electronAPI.addToWatchlist(listId, ticker)
    setWatchlistsData(data)
  }, [])

  const addTickersToWatchlist = useCallback(async (listId: string, tickers: string[]) => {
    const data = await window.electronAPI.addTickersToWatchlist(listId, tickers)
    setWatchlistsData(data)
  }, [])

  const removeFromWatchlist = useCallback(async (listId: string, ticker: string) => {
    const data = await window.electronAPI.removeFromWatchlist(listId, ticker)
    setWatchlistsData(data)
  }, [])

  const exportWatchlists = useCallback(async () => {
    return window.electronAPI.exportWatchlists()
  }, [])

  const importWatchlists = useCallback(async () => {
    const data = await window.electronAPI.importWatchlists()
    if (data) setWatchlistsData(data)
    return data
  }, [])

  const reloadWatchlists = useCallback(async () => {
    const data = await window.electronAPI.getWatchlists()
    setWatchlistsData(data)
  }, [])

  return {
    watchlists: watchlistsData.lists,
    createWatchlist,
    renameWatchlist,
    deleteWatchlist,
    addToWatchlist,
    addTickersToWatchlist,
    removeFromWatchlist,
    exportWatchlists,
    importWatchlists,
    reloadWatchlists,
  }
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<string[]>([])

  useEffect(() => {
    window.electronAPI.getFavorites().then(setFavorites)
  }, [])

  const toggleFavorite = useCallback(async (symbol: string) => {
    const updated = await window.electronAPI.toggleFavorite(symbol)
    setFavorites(updated)
  }, [])

  const reloadFavorites = useCallback(() => {
    window.electronAPI.getFavorites().then(setFavorites)
  }, [])

  return { favorites, toggleFavorite, reloadFavorites }
}

export function useChartData(symbol: string | null, period: string, interval: string) {
  const [data, setData] = useState<ChartPoint[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!symbol) {
      setData([])
      return
    }

    let cancelled = false
    setLoading(true)

    window.electronAPI.getChartData(symbol, period, interval)
      .then(result => {
        if (!cancelled) {
          setData(result)
        }
      })
      .catch(err => {
        console.error('Failed to fetch chart data:', err)
        if (!cancelled) setData([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [symbol, period, interval])

  return { data, loading }
}
