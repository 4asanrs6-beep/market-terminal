import { useState, useEffect, useCallback, useRef } from 'react'
import type { StockQuote, ConstituentInfo, MarketIndex, ChartPoint } from '../types/stock'

const REFRESH_INTERVAL = 30_000 // 30 seconds

export function useMarketData(market: MarketIndex) {
  const [constituents, setConstituents] = useState<ConstituentInfo[]>([])
  const [quotes, setQuotes] = useState<StockQuote[]>([])
  const [loading, setLoading] = useState(true)
  const [watchlist, setWatchlist] = useState<string[]>([])
  const intervalRef = useRef<ReturnType<typeof setInterval>>()

  const fetchQuotes = useCallback(async (symbols: string[]) => {
    if (symbols.length === 0) {
      setQuotes([])
      setLoading(false)
      return
    }
    try {
      // Show quotes immediately
      const data = await window.electronAPI.getStockQuotes(symbols)
      setQuotes(data)
      setLoading(false)

      // Fill in 5-day changes asynchronously
      window.electronAPI.get5DayChanges(symbols).then(fiveDayMap => {
        setQuotes(prev => prev.map(q => ({
          ...q,
          fiveDayChangePercent: fiveDayMap[q.symbol] ?? undefined,
        })))
      }).catch(err => {
        console.error('Failed to fetch 5-day changes:', err)
      })
    } catch (err) {
      console.error('Failed to fetch quotes:', err)
      setLoading(false)
    }
  }, [])

  const loadMarketData = useCallback(async () => {
    setLoading(true)
    try {
      if (market === 'watchlist') {
        const wl = await window.electronAPI.getWatchlist()
        setWatchlist(wl)
        setConstituents(wl.map(s => ({ symbol: s, name: s, sector: '' })))
        await fetchQuotes(wl)
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
  }, [market, fetchQuotes])

  const refresh = useCallback(async () => {
    const symbols = market === 'watchlist'
      ? watchlist
      : constituents.map(c => c.symbol)
    if (symbols.length > 0) {
      await fetchQuotes(symbols)
    }
  }, [market, watchlist, constituents, fetchQuotes])

  useEffect(() => {
    loadMarketData()
  }, [loadMarketData])

  // Auto-refresh
  useEffect(() => {
    intervalRef.current = setInterval(refresh, REFRESH_INTERVAL)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [refresh])

  const addToWatchlist = useCallback(async (ticker: string) => {
    const updated = await window.electronAPI.addToWatchlist(ticker)
    setWatchlist(updated)
    if (market === 'watchlist') {
      setConstituents(updated.map(s => ({ symbol: s, name: s, sector: '' })))
      await fetchQuotes(updated)
    }
  }, [market, fetchQuotes])

  const removeFromWatchlist = useCallback(async (ticker: string) => {
    const updated = await window.electronAPI.removeFromWatchlist(ticker)
    setWatchlist(updated)
    if (market === 'watchlist') {
      setConstituents(updated.map(s => ({ symbol: s, name: s, sector: '' })))
      await fetchQuotes(updated)
    }
  }, [market, fetchQuotes])

  return {
    constituents,
    quotes,
    loading,
    refresh,
    watchlist,
    addToWatchlist,
    removeFromWatchlist,
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
