import { useState, useEffect, useRef, useCallback } from 'react'
import type { StockQuote, MarketIndex } from '../types/stock'
import type { MarketSummary } from '../types/ai'
import styles from '../styles/AIMarketPanel.module.css'

interface AIMarketPanelProps {
  quotes: StockQuote[]
  activeMarket: MarketIndex
  onClose: () => void
}

type PanelState = 'idle' | 'loading' | 'streaming' | 'done' | 'error'

function buildMarketSummary(quotes: StockQuote[], activeMarket: MarketIndex): MarketSummary {
  const marketName = activeMarket === 'sp500' ? 'S&P 500'
    : activeMarket === 'nasdaq100' ? 'NASDAQ 100'
    : 'Watchlist'

  const advancers = quotes.filter(q => q.regularMarketChangePercent > 0).length
  const decliners = quotes.filter(q => q.regularMarketChangePercent < 0).length
  const avgChangePercent = quotes.length > 0
    ? quotes.reduce((sum, q) => sum + q.regularMarketChangePercent, 0) / quotes.length
    : 0

  // Sector aggregation
  const sectorMap = new Map<string, { total: number; count: number }>()
  for (const q of quotes) {
    const sector = q.sector || 'Unknown'
    const entry = sectorMap.get(sector) || { total: 0, count: 0 }
    entry.total += q.regularMarketChangePercent
    entry.count += 1
    sectorMap.set(sector, entry)
  }
  const sectors = Array.from(sectorMap.entries())
    .map(([name, { total, count }]) => ({ name, avgChange: total / count, count }))
    .sort((a, b) => b.avgChange - a.avgChange)

  // Top gainers / losers / volume
  const sorted = [...quotes].sort((a, b) => b.regularMarketChangePercent - a.regularMarketChangePercent)
  const topGainers = sorted.slice(0, 10).map(q => ({
    symbol: q.symbol, name: q.shortName, price: q.regularMarketPrice, changePercent: q.regularMarketChangePercent,
  }))
  const topLosers = sorted.slice(-10).reverse().map(q => ({
    symbol: q.symbol, name: q.shortName, price: q.regularMarketPrice, changePercent: q.regularMarketChangePercent,
  }))
  const topVolume = [...quotes].sort((a, b) => b.regularMarketVolume - a.regularMarketVolume).slice(0, 10).map(q => ({
    symbol: q.symbol, name: q.shortName, volume: q.regularMarketVolume, changePercent: q.regularMarketChangePercent,
  }))

  // Upcoming earnings (within 7 days)
  const now = new Date()
  const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  const upcomingEarnings = quotes
    .filter(q => {
      if (!q.earningsDate) return false
      const d = new Date(q.earningsDate)
      return d >= now && d <= weekLater
    })
    .map(q => ({ symbol: q.symbol, name: q.shortName, date: q.earningsDate! }))
    .sort((a, b) => a.date.localeCompare(b.date))

  return {
    marketName,
    totalCount: quotes.length,
    advancers,
    decliners,
    avgChangePercent,
    sectors,
    topGainers,
    topLosers,
    topVolume,
    upcomingEarnings,
  }
}

export function AIMarketPanel({ quotes, activeMarket, onClose }: AIMarketPanelProps) {
  const [state, setState] = useState<PanelState>('idle')
  const [commentary, setCommentary] = useState('')
  const [error, setError] = useState('')
  const [timestamp, setTimestamp] = useState<string | null>(null)
  const requestIdRef = useRef<string | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  // Register/cleanup stream listeners
  useEffect(() => {
    window.electronAPI.onAIStreamChunk((data) => {
      if (data.requestId === requestIdRef.current) {
        setCommentary(prev => prev + data.text)
        setState('streaming')
      }
    })
    window.electronAPI.onAIStreamDone((data) => {
      if (data.requestId === requestIdRef.current) {
        setState('done')
        setTimestamp(new Date().toLocaleString('ja-JP'))
      }
    })
    window.electronAPI.onAIStreamError((data) => {
      if (data.requestId === requestIdRef.current) {
        setState('error')
        setError(data.error)
      }
    })
    return () => {
      window.electronAPI.removeAIStreamListeners()
    }
  }, [])

  // Auto-scroll during streaming
  useEffect(() => {
    if (state === 'streaming' && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight
    }
  }, [commentary, state])

  const handleGenerate = useCallback(async () => {
    if (quotes.length === 0) return
    setState('loading')
    setCommentary('')
    setError('')
    const summary = buildMarketSummary(quotes, activeMarket)
    try {
      const reqId = await window.electronAPI.aiMarketCommentary(summary)
      requestIdRef.current = reqId
    } catch (err: any) {
      setState('error')
      setError(err.message || 'Failed to start commentary')
    }
  }, [quotes, activeMarket])

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <span className={styles.panelTitle}>AI MARKET BRIEF</span>
        {(state === 'done' || state === 'streaming') && (
          <button className={styles.headerBtn} onClick={handleGenerate} title="更新">
            &#x21BB;
          </button>
        )}
        <button className={styles.headerBtn} onClick={onClose} title="閉じる">
          &#x2715;
        </button>
      </div>

      {timestamp && (
        <div className={styles.timestamp}>
          Updated: {timestamp}
        </div>
      )}

      {state === 'idle' && (
        <div className={styles.generatePrompt}>
          <button className={styles.generateBtn} onClick={handleGenerate}>
            解説を生成
          </button>
          <div className={styles.generateHint}>
            現在表示中のマーケットデータに基づき<br />
            AIがマーケットブリーフを作成します
          </div>
        </div>
      )}

      {state === 'loading' && (
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <div className={styles.loadingText}>Generating market brief...</div>
        </div>
      )}

      {(state === 'streaming' || state === 'done') && (
        <div className={styles.content} ref={contentRef}>
          <div className={styles.commentaryText}>
            {commentary}
            {state === 'streaming' && <span className={styles.cursor} />}
          </div>
        </div>
      )}

      {state === 'error' && (
        <div className={styles.error}>
          <div className={styles.errorText}>Error: {error}</div>
          <button className={styles.retryBtn} onClick={handleGenerate}>
            リトライ
          </button>
        </div>
      )}
    </div>
  )
}
