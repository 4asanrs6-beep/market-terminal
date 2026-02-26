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
  const fetchingRef = useRef(false)

  // All watchlisted symbols across all lists (for highlighting in table)
  const allWatchlistSymbols = useCallback(() => {
    const set = new Set<string>()
    for (const wl of watchlists) {
      for (const s of wl.symbols) set.add(s)
    }
    return Array.from(set)
  }, [watchlists])

  const fetchQuotes = useCallback(async (symbols: string[]) => {
    if (symbols.length === 0) {
      setQuotes([])
      setLoading(false)
      return
    }
    if (fetchingRef.current) return
    fetchingRef.current = true
    try {
      const data = await window.electronAPI.getStockQuotes(symbols)
      setQuotes(data)
      setLoading(false)

      const sectorMap = await window.electronAPI.getSectors(symbols)
      setQuotes(prev => prev.map(q => ({
        ...q,
        sector: sectorMap[q.symbol] || q.sector || '',
      })))

      try {
        const fiveDayMap = await window.electronAPI.get5DayChanges(symbols)
        setQuotes(prev => prev.map(q => ({
          ...q,
          fiveDayChangePercent: fiveDayMap[q.symbol] ?? undefined,
        })))
      } catch (err) {
        console.error('Failed to fetch 5-day changes:', err)
      }

    } catch (err) {
      console.error('Failed to fetch quotes:', err)
      setLoading(false)
    } finally {
      fetchingRef.current = false
    }
  }, [])

  const loadMarketData = useCallback(async () => {
    setLoading(true)
    try {
      const wlId = getWatchlistId(market)
      if (wlId) {
        const wl = watchlists.find(l => l.id === wlId)
        const symbols = wl ? wl.symbols : []
        setConstituents(symbols.map(s => ({ symbol: s, name: s, sector: '' })))
        await fetchQuotes(symbols)
      } else {
        const list = await window.electronAPI.getConstituents(market)
        setConstituents(list)
        const symbols = list.map(c => c.symbol)
        await fetchQuotes(symbols)
      }
    } catch (err) {
      console.error('Failed to load market data:', err)
      setLoading(false)
    }
  }, [market, watchlists, fetchQuotes])

  const refresh = useCallback(async () => {
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
      await fetchQuotes(symbols)
    }
  }, [market, watchlists, constituents, fetchQuotes])

  useEffect(() => {
    loadMarketData()
  }, [loadMarketData])

  return {
    constituents,
    quotes,
    loading,
    refresh,
    allWatchlistSymbols,
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
  }
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
