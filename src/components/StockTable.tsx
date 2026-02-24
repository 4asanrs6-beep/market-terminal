import { useState, useMemo } from 'react'
import type { StockQuote, SortField, SortDirection } from '../types/stock'
import styles from '../styles/StockTable.module.css'

interface StockTableProps {
  quotes: StockQuote[]
  loading: boolean
  searchQuery: string
  selectedSymbol: string | null
  onSelectStock: (symbol: string) => void
  onRefresh: () => void
}

function formatNumber(n: number, decimals = 2): string {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

function formatVolume(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + '億'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + '百万'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + '千'
  return n.toString()
}

function formatMarketCap(n: number): string {
  if (n === 0) return '-'
  const oku = n / 100_000_000 // 億ドル
  return oku.toLocaleString('en-US', { maximumFractionDigits: 0 })
}

const COLUMNS: { key: SortField; label: string }[] = [
  { key: 'symbol', label: 'ティッカー' },
  { key: 'shortName', label: '銘柄名' },
  { key: 'regularMarketPrice', label: '株価' },
  { key: 'regularMarketChange', label: '前日比' },
  { key: 'regularMarketChangePercent', label: '騰落率' },
  { key: 'regularMarketVolume', label: '出来高' },
]

export function StockTable({
  quotes,
  loading,
  searchQuery,
  selectedSymbol,
  onSelectStock,
  onRefresh,
}: StockTableProps) {
  const [sortField, setSortField] = useState<SortField>('regularMarketChangePercent')
  const [sortDir, setSortDir] = useState<SortDirection>('desc')
  const [refreshing, setRefreshing] = useState(false)

  const handleSort = (field: SortField) => {
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

  const filtered = useMemo(() => {
    let data = [...quotes]

    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      data = data.filter(
        s => s.symbol.toLowerCase().includes(q) ||
             s.shortName.toLowerCase().includes(q)
      )
    }

    data.sort((a, b) => {
      const aVal = a[sortField]
      const bVal = b[sortField]
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal)
      }
      return sortDir === 'asc'
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number)
    })

    return data
  }, [quotes, searchQuery, sortField, sortDir])

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
      <div className={styles.toolbar}>
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
        <table className={styles.table}>
          <thead>
            <tr>
              {COLUMNS.map(col => (
                <th
                  key={col.key}
                  className={sortField === col.key ? styles.sorted : ''}
                  onClick={() => handleSort(col.key)}
                >
                  {col.label}
                  {sortField === col.key && (
                    <span className={styles.sortArrow}>
                      {sortDir === 'asc' ? '▲' : '▼'}
                    </span>
                  )}
                </th>
              ))}
              <th>時価総額 (億$)</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(stock => {
              const isPositive = stock.regularMarketChange >= 0
              const changeClass = isPositive ? styles.positive : styles.negative
              return (
                <tr
                  key={stock.symbol}
                  className={`${styles.row} ${selectedSymbol === stock.symbol ? styles.selected : ''}`}
                  onClick={() => onSelectStock(stock.symbol)}
                >
                  <td>{stock.symbol}</td>
                  <td>{stock.shortName}</td>
                  <td>{formatNumber(stock.regularMarketPrice)}</td>
                  <td className={changeClass}>
                    {isPositive ? '+' : ''}{formatNumber(stock.regularMarketChange)}
                  </td>
                  <td className={changeClass}>
                    {isPositive ? '+' : ''}{formatNumber(stock.regularMarketChangePercent)}%
                  </td>
                  <td className={styles.volume}>{formatVolume(stock.regularMarketVolume)}</td>
                  <td className={styles.volume}>{formatMarketCap(stock.marketCap)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
