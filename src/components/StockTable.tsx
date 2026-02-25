import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import type { StockQuote, SortField, SortDirection, WatchlistInfo } from '../types/stock'
import { Sparkline } from './Sparkline'
import styles from '../styles/StockTable.module.css'

export type ViewMode = 'table' | 'heatmap'

interface StockTableProps {
  quotes: StockQuote[]
  loading: boolean
  searchQuery: string
  selectedSymbol: string | null
  onSelectStock: (symbol: string) => void
  onRefresh: () => void
  watchlist: string[]
  watchlists: WatchlistInfo[]
  onAddToWatchlist: (listId: string, ticker: string) => void
  onRemoveFromWatchlist: (listId: string, ticker: string) => void
  sparklines: Record<string, number[]>
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
}

function formatNumber(n: number, decimals = 2): string {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

function formatVolume(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + 'B'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return n.toString()
}

function formatMarketCap(n: number): string {
  if (n === 0) return '-'
  const oku = n / 100_000_000
  return oku.toLocaleString('en-US', { maximumFractionDigits: 0 })
}

// GICS sector English -> Japanese mapping
const SECTOR_MAP: Record<string, string> = {
  'Technology': '情報技術',
  'Health Care': 'ヘルスケア',
  'Healthcare': 'ヘルスケア',
  'Financials': '金融',
  'Financial Services': '金融',
  'Consumer Discretionary': '一般消費財',
  'Consumer Cyclical': '一般消費財',
  'Communication Services': 'コミュニケーション',
  'Industrials': '資本財',
  'Consumer Staples': '生活必需品',
  'Consumer Defensive': '生活必需品',
  'Energy': 'エネルギー',
  'Utilities': '公益事業',
  'Real Estate': '不動産',
  'Materials': '素材',
  'Basic Materials': '素材',
}

function sectorJa(sector: string): string {
  return SECTOR_MAP[sector] || sector || '-'
}

interface ColumnDef {
  key: SortField | 'sector' | 'sparkline'
  label: string
  defaultWidth: number
  minWidth: number
}

const COLUMNS: ColumnDef[] = [
  { key: 'symbol', label: 'ティッカー', defaultWidth: 80, minWidth: 60 },
  { key: 'shortName', label: '銘柄名', defaultWidth: 160, minWidth: 80 },
  { key: 'regularMarketPrice', label: '終値 ($)', defaultWidth: 90, minWidth: 60 },
  { key: 'regularMarketChange', label: '前日比 ($)', defaultWidth: 90, minWidth: 60 },
  { key: 'regularMarketChangePercent', label: '騰落率 (%)', defaultWidth: 90, minWidth: 60 },
  { key: 'sparkline', label: '推移', defaultWidth: 90, minWidth: 60 },
  { key: 'fiveDayChangePercent', label: '5日騰落率 (%)', defaultWidth: 100, minWidth: 60 },
  { key: 'regularMarketVolume', label: '出来高 (株)', defaultWidth: 90, minWidth: 60 },
  { key: 'marketCap', label: '時価総額 (億$)', defaultWidth: 110, minWidth: 60 },
  { key: 'sector', label: 'セクター', defaultWidth: 100, minWidth: 60 },
]

// Context menu state
interface ContextMenu {
  x: number
  y: number
  symbol: string
  inWatchlist: boolean
}

export function StockTable({
  quotes,
  loading,
  searchQuery,
  selectedSymbol,
  onSelectStock,
  onRefresh,
  watchlist,
  watchlists,
  onAddToWatchlist,
  onRemoveFromWatchlist,
  sparklines,
  viewMode,
  onViewModeChange,
}: StockTableProps) {
  const [sortField, setSortField] = useState<SortField>('regularMarketChangePercent')
  const [sortDir, setSortDir] = useState<SortDirection>('desc')
  const [refreshing, setRefreshing] = useState(false)
  const [activeSector, setActiveSector] = useState<string>('all')
  const [colWidths, setColWidths] = useState<number[]>(COLUMNS.map(c => c.defaultWidth))
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null)

  const resizingRef = useRef<{ colIndex: number; startX: number; startWidth: number } | null>(null)

  const watchlistSet = useMemo(() => new Set(watchlist), [watchlist])

  // Close context menu on click anywhere
  useEffect(() => {
    const handler = () => setContextMenu(null)
    window.addEventListener('click', handler)
    return () => window.removeEventListener('click', handler)
  }, [])

  const handleSort = (field: SortField | 'sector' | 'sparkline') => {
    if (field === 'sector' || field === 'sparkline') return // not sortable
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await onRefresh()
    setRefreshing(false)
  }

  // --- Column resize ---
  const handleResizeStart = useCallback((e: React.MouseEvent, colIndex: number) => {
    e.preventDefault()
    e.stopPropagation()
    resizingRef.current = { colIndex, startX: e.clientX, startWidth: colWidths[colIndex] }

    const handleMouseMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return
      const { colIndex: ci, startX, startWidth } = resizingRef.current
      const delta = ev.clientX - startX
      const newWidth = Math.max(COLUMNS[ci].minWidth, startWidth + delta)
      setColWidths(prev => {
        const next = [...prev]
        next[ci] = newWidth
        return next
      })
    }

    const handleMouseUp = () => {
      resizingRef.current = null
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [colWidths])

  // --- Context menu ---
  const handleContextMenu = useCallback((e: React.MouseEvent, symbol: string) => {
    e.preventDefault()
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      symbol,
      inWatchlist: watchlistSet.has(symbol),
    })
  }, [watchlistSet])

  // Collect unique sectors from data
  const sectors = useMemo(() => {
    const set = new Set<string>()
    for (const q of quotes) {
      if (q.sector) set.add(q.sector)
    }
    return Array.from(set).sort((a, b) => sectorJa(a).localeCompare(sectorJa(b), 'ja'))
  }, [quotes])

  const filtered = useMemo(() => {
    let data = [...quotes]

    if (activeSector !== 'all') {
      data = data.filter(s => s.sector === activeSector)
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      data = data.filter(
        s => s.symbol.toLowerCase().includes(q) ||
             s.shortName.toLowerCase().includes(q)
      )
    }

    data.sort((a, b) => {
      const aVal = a[sortField as keyof StockQuote]
      const bVal = b[sortField as keyof StockQuote]
      const aNum = typeof aVal === 'number' ? aVal : (aVal == null ? -Infinity : 0)
      const bNum = typeof bVal === 'number' ? bVal : (bVal == null ? -Infinity : 0)
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal)
      }
      return sortDir === 'asc'
        ? (aNum as number) - (bNum as number)
        : (bNum as number) - (aNum as number)
    })

    return data
  }, [quotes, searchQuery, sortField, sortDir, activeSector])

  if (loading && quotes.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          データ取得中
          <span className={styles.loadingDot}>.</span>
          <span className={styles.loadingDot}>.</span>
          <span className={styles.loadingDot}>.</span>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      {sectors.length > 0 && (
        <div className={styles.sectorBar}>
          <button
            className={`${styles.sectorBtn} ${activeSector === 'all' ? styles.sectorActive : ''}`}
            onClick={() => setActiveSector('all')}
          >
            全セクター
          </button>
          {sectors.map(s => (
            <button
              key={s}
              className={`${styles.sectorBtn} ${activeSector === s ? styles.sectorActive : ''}`}
              onClick={() => setActiveSector(activeSector === s ? 'all' : s)}
            >
              {sectorJa(s)}
            </button>
          ))}
        </div>
      )}

      <div className={styles.toolbar}>
        <div className={styles.viewToggle}>
          <button
            className={`${styles.viewBtn} ${viewMode === 'table' ? styles.viewBtnActive : ''}`}
            onClick={() => onViewModeChange('table')}
          >
            テーブル
          </button>
          <button
            className={`${styles.viewBtn} ${viewMode === 'heatmap' ? styles.viewBtnActive : ''}`}
            onClick={() => onViewModeChange('heatmap')}
          >
            ヒートマップ
          </button>
        </div>
        <span className={styles.stockCount}>
          {filtered.length} / {quotes.length} 銘柄
        </span>
        <button
          className={`${styles.refreshBtn} ${refreshing ? styles.loading : ''}`}
          onClick={handleRefresh}
          disabled={refreshing}
        >
          {refreshing ? '更新中...' : '更新'}
        </button>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table} style={{ tableLayout: 'fixed', width: colWidths.reduce((a, b) => a + b, 0) }}>
          <colgroup>
            {colWidths.map((w, i) => (
              <col key={i} style={{ width: w }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {COLUMNS.map((col, i) => {
                const isSortable = col.key !== 'sector' && col.key !== 'sparkline'
                const isSorted = sortField === col.key
                return (
                  <th
                    key={col.key}
                    className={`${isSorted ? styles.sorted : ''} ${!isSortable ? styles.noSort : ''}`}
                    onClick={() => handleSort(col.key)}
                    style={{ position: 'relative' }}
                  >
                    {col.label}
                    {isSorted && (
                      <span className={styles.sortArrow}>
                        {sortDir === 'asc' ? '▲' : '▼'}
                      </span>
                    )}
                    <span
                      className={styles.resizeHandle}
                      onMouseDown={e => handleResizeStart(e, i)}
                    />
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {filtered.map(stock => {
              const isPositive = stock.regularMarketChange >= 0
              const changeClass = isPositive ? styles.positive : styles.negative
              const fiveDay = stock.fiveDayChangePercent
              const fiveDayPositive = fiveDay != null && fiveDay >= 0
              const fiveDayClass = fiveDay != null
                ? (fiveDayPositive ? styles.positive : styles.negative)
                : styles.volume
              const isInWatchlist = watchlistSet.has(stock.symbol)
              return (
                <tr
                  key={stock.symbol}
                  className={[
                    styles.row,
                    selectedSymbol === stock.symbol ? styles.selected : '',
                    isInWatchlist ? styles.watchlisted : '',
                  ].join(' ')}
                  onClick={() => onSelectStock(stock.symbol)}
                  onContextMenu={e => handleContextMenu(e, stock.symbol)}
                >
                  <td>
                    {isInWatchlist && <span className={styles.starIcon}>★</span>}
                    {stock.symbol}
                  </td>
                  <td>{stock.shortName}</td>
                  <td>{formatNumber(stock.regularMarketPrice)}</td>
                  <td className={changeClass}>
                    {isPositive ? '+' : ''}{formatNumber(stock.regularMarketChange)}
                  </td>
                  <td className={changeClass}>
                    {isPositive ? '+' : ''}{formatNumber(stock.regularMarketChangePercent)}%
                  </td>
                  <td className={styles.sparklineCell}>
                    <Sparkline data={sparklines[stock.symbol] || []} width={76} height={28} />
                  </td>
                  <td className={fiveDayClass}>
                    {fiveDay != null
                      ? `${fiveDayPositive ? '+' : ''}${formatNumber(fiveDay)}%`
                      : '-'}
                  </td>
                  <td className={styles.volume}>{formatVolume(stock.regularMarketVolume)}</td>
                  <td className={styles.volume}>{formatMarketCap(stock.marketCap)}</td>
                  <td className={styles.sectorCell}>{sectorJa(stock.sector)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          className={styles.contextMenu}
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={e => e.stopPropagation()}
        >
          {watchlists.map(wl => {
            const isIn = wl.symbols.includes(contextMenu.symbol)
            return (
              <button
                key={wl.id}
                className={styles.contextMenuItem}
                onClick={() => {
                  if (isIn) {
                    onRemoveFromWatchlist(wl.id, contextMenu.symbol)
                  } else {
                    onAddToWatchlist(wl.id, contextMenu.symbol)
                  }
                  setContextMenu(null)
                }}
              >
                {isIn ? '★' : '☆'} {wl.name}
              </button>
            )
          })}
          {watchlists.length === 0 && (
            <div className={styles.contextMenuItem} style={{ color: 'var(--text-muted)', cursor: 'default' }}>
              リストがありません
            </div>
          )}
        </div>
      )}
    </div>
  )
}
