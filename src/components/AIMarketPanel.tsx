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
type PanelView = 'current' | 'history' | 'detail'

interface BriefingEntry {
  id: string
  marketName: string
  timestamp: string
  text: string
}

function getMarketLabel(market: MarketIndex): string {
  if (market === 'sp500') return 'S&P 500'
  if (market === 'nasdaq100') return 'NASDAQ 100'
  if (market === 'futures') return '先物・指数・通貨'
  if (market === 'favorites') return 'お気に入り'
  return 'Watchlist'
}

function buildMarketSummary(quotes: StockQuote[], activeMarket: MarketIndex): MarketSummary {
  const marketName = getMarketLabel(activeMarket)

  const advancers = quotes.filter(q => q.regularMarketChangePercent > 0).length
  const decliners = quotes.filter(q => q.regularMarketChangePercent < 0).length
  const avgChangePercent = quotes.length > 0
    ? quotes.reduce((sum, q) => sum + q.regularMarketChangePercent, 0) / quotes.length
    : 0

  // 5-day average
  const with5Day = quotes.filter(q => q.fiveDayChangePercent != null)
  const avg5DayChangePercent = with5Day.length > 0
    ? with5Day.reduce((sum, q) => sum + q.fiveDayChangePercent!, 0) / with5Day.length
    : undefined

  // Sector aggregation (daily)
  const sectorMap = new Map<string, { total: number; count: number; total5d: number; count5d: number }>()
  for (const q of quotes) {
    const sector = q.sector || 'Unknown'
    const entry = sectorMap.get(sector) || { total: 0, count: 0, total5d: 0, count5d: 0 }
    entry.total += q.regularMarketChangePercent
    entry.count += 1
    if (q.fiveDayChangePercent != null) {
      entry.total5d += q.fiveDayChangePercent
      entry.count5d += 1
    }
    sectorMap.set(sector, entry)
  }
  const sectors = Array.from(sectorMap.entries())
    .map(([name, { total, count }]) => ({ name, avgChange: total / count, count }))
    .sort((a, b) => b.avgChange - a.avgChange)

  // Sector 5-day aggregation
  const sectors5Day = Array.from(sectorMap.entries())
    .filter(([, d]) => d.count5d > 0)
    .map(([name, { total5d, count5d, count }]) => ({ name, avgChange: total5d / count5d, count }))
    .sort((a, b) => b.avgChange - a.avgChange)

  // Top gainers / losers / volume (with 5-day)
  const sorted = [...quotes].sort((a, b) => b.regularMarketChangePercent - a.regularMarketChangePercent)
  const topGainers = sorted.slice(0, 10).map(q => ({
    symbol: q.symbol, name: q.shortName, price: q.regularMarketPrice,
    changePercent: q.regularMarketChangePercent, fiveDayChange: q.fiveDayChangePercent,
  }))
  const topLosers = sorted.slice(-10).reverse().map(q => ({
    symbol: q.symbol, name: q.shortName, price: q.regularMarketPrice,
    changePercent: q.regularMarketChangePercent, fiveDayChange: q.fiveDayChangePercent,
  }))
  const topVolume = [...quotes].sort((a, b) => b.regularMarketVolume - a.regularMarketVolume).slice(0, 10).map(q => ({
    symbol: q.symbol, name: q.shortName, volume: q.regularMarketVolume, changePercent: q.regularMarketChangePercent,
  }))

  // Weekly top movers (5-day)
  const sorted5d = [...quotes].filter(q => q.fiveDayChangePercent != null)
    .sort((a, b) => b.fiveDayChangePercent! - a.fiveDayChangePercent!)
  const weeklyGainers = sorted5d.slice(0, 10).map(q => ({
    symbol: q.symbol, name: q.shortName, fiveDayChange: q.fiveDayChangePercent!,
  }))
  const weeklyLosers = sorted5d.slice(-10).reverse().map(q => ({
    symbol: q.symbol, name: q.shortName, fiveDayChange: q.fiveDayChangePercent!,
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
    avg5DayChangePercent,
    sectors,
    sectors5Day,
    topGainers,
    topLosers,
    topVolume,
    weeklyGainers,
    weeklyLosers,
    upcomingEarnings,
  }
}

function formatHistoryDate(isoString: string): string {
  const d = new Date(isoString)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${yyyy}/${mm}/${dd} ${hh}:${min}`
}

export function AIMarketPanel({ quotes, activeMarket, onClose }: AIMarketPanelProps) {
  const [state, setState] = useState<PanelState>('idle')
  const [view, setView] = useState<PanelView>('current')
  const [commentary, setCommentary] = useState('')
  const [error, setError] = useState('')
  const [timestamp, setTimestamp] = useState<string | null>(null)
  const [history, setHistory] = useState<BriefingEntry[]>([])
  const [selectedEntry, setSelectedEntry] = useState<BriefingEntry | null>(null)
  const requestIdRef = useRef<string | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const detailRef = useRef<HTMLDivElement>(null)
  const savedRef = useRef(false)

  // Load history on mount
  useEffect(() => {
    window.electronAPI.getBriefingHistory().then(data => {
      setHistory(data.entries)
    })
  }, [])

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

  // Auto-save when streaming completes
  useEffect(() => {
    if (state === 'done' && commentary && !savedRef.current) {
      savedRef.current = true
      const marketName = getMarketLabel(activeMarket)
      window.electronAPI.saveBriefing({ marketName, text: commentary }).then(data => {
        setHistory(data.entries)
      })
    }
  }, [state, commentary, activeMarket])

  // Auto-scroll during streaming, reset to top when done
  const wasStreamingRef = useRef(false)
  useEffect(() => {
    if (state === 'streaming') {
      wasStreamingRef.current = true
      if (contentRef.current) {
        contentRef.current.scrollTop = contentRef.current.scrollHeight
      }
    } else if (state === 'done' && wasStreamingRef.current) {
      wasStreamingRef.current = false
      if (contentRef.current) {
        contentRef.current.scrollTop = 0
      }
    }
  }, [commentary, state])

  const handleGenerate = useCallback(async () => {
    if (quotes.length === 0) return
    setState('loading')
    setCommentary('')
    setError('')
    setView('current')
    savedRef.current = false
    const summary = buildMarketSummary(quotes, activeMarket)
    try {
      const reqId = await window.electronAPI.aiMarketCommentary(summary)
      requestIdRef.current = reqId
    } catch (err: any) {
      setState('error')
      setError(err.message || 'Failed to start commentary')
    }
  }, [quotes, activeMarket])

  const handleShowHistory = useCallback(() => {
    setView('history')
    setSelectedEntry(null)
    window.electronAPI.getBriefingHistory().then(data => {
      setHistory(data.entries)
    })
  }, [])

  const handleSelectEntry = useCallback((entry: BriefingEntry) => {
    setSelectedEntry(entry)
    setView('detail')
  }, [])

  const handleDeleteEntry = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const data = await window.electronAPI.deleteBriefing(id)
    setHistory(data.entries)
  }, [])

  const handleBackToCurrent = useCallback(() => {
    setView('current')
    setSelectedEntry(null)
  }, [])

  const handleBackToHistory = useCallback(() => {
    setView('history')
    setSelectedEntry(null)
  }, [])

  // Scroll detail to top when entry changes
  useEffect(() => {
    if (view === 'detail' && detailRef.current) {
      detailRef.current.scrollTop = 0
    }
  }, [selectedEntry, view])

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <span className={styles.panelTitle}>AI MARKET BRIEF</span>
        {view !== 'current' && (
          <button
            className={styles.headerBtn}
            onClick={view === 'detail' ? handleBackToHistory : handleBackToCurrent}
            title="戻る"
          >
            &#x2190;
          </button>
        )}
        {view === 'current' && (state === 'done' || state === 'streaming') && (
          <button className={styles.headerBtn} onClick={handleGenerate} title="更新">
            &#x21BB;
          </button>
        )}
        {view === 'current' && (
          <button className={styles.headerBtn} onClick={handleShowHistory} title="履歴">
            &#x1F4CB;
          </button>
        )}
        <button className={styles.headerBtn} onClick={onClose} title="閉じる">
          &#x2715;
        </button>
      </div>

      {/* --- History list view --- */}
      {view === 'history' && (
        <>
          <div className={styles.historyHeader}>BRIEFING HISTORY</div>
          <div className={styles.historyList}>
            {history.length === 0 && (
              <div className={styles.historyEmpty}>履歴がありません</div>
            )}
            {[...history].reverse().map(entry => (
              <div
                key={entry.id}
                className={styles.historyItem}
                onClick={() => handleSelectEntry(entry)}
              >
                <div className={styles.historyItemHeader}>
                  <span className={styles.historyMarket}>{entry.marketName}</span>
                  <button
                    className={styles.historyDeleteBtn}
                    onClick={(e) => handleDeleteEntry(entry.id, e)}
                    title="削除"
                  >
                    &#x2715;
                  </button>
                </div>
                <div className={styles.historyDate}>
                  {formatHistoryDate(entry.timestamp)}
                </div>
                <div className={styles.historyPreview}>
                  {entry.text.slice(0, 80)}...
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* --- History detail view --- */}
      {view === 'detail' && selectedEntry && (
        <>
          <div className={styles.detailHeader}>
            <span className={styles.detailMarket}>{selectedEntry.marketName}</span>
            <span className={styles.detailDate}>{formatHistoryDate(selectedEntry.timestamp)}</span>
          </div>
          <div className={styles.content} ref={detailRef}>
            <div className={styles.commentaryText}>{selectedEntry.text}</div>
          </div>
        </>
      )}

      {/* --- Current briefing view --- */}
      {view === 'current' && (
        <>
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
              {history.length > 0 && (
                <button className={styles.historyLink} onClick={handleShowHistory}>
                  過去の履歴を見る ({history.length}件)
                </button>
              )}
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
        </>
      )}
    </div>
  )
}
