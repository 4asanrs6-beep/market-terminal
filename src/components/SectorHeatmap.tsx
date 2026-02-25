import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import type { StockQuote } from '../types/stock'
import type { ViewMode } from './StockTable'
import styles from '../styles/SectorHeatmap.module.css'

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

interface SectorHeatmapProps {
  quotes: StockQuote[]
  loading: boolean
  onSelectStock: (symbol: string) => void
  onRefresh: () => void
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
}

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

interface TreeNode {
  key: string
  value: number
  data?: StockQuote
  children?: TreeNode[]
}

// --- Squarified Treemap Layout ---
function squarify(items: TreeNode[], rect: Rect): (TreeNode & Rect)[] {
  if (items.length === 0 || rect.w <= 0 || rect.h <= 0) return []

  const totalValue = items.reduce((sum, it) => sum + it.value, 0)
  if (totalValue <= 0) return []

  const result: (TreeNode & Rect)[] = []
  layoutStrip(items, rect, totalValue, result)
  return result
}

function layoutStrip(
  items: TreeNode[],
  rect: Rect,
  totalValue: number,
  result: (TreeNode & Rect)[],
) {
  if (items.length === 0 || rect.w <= 0 || rect.h <= 0) return

  if (items.length === 1) {
    result.push({ ...items[0], ...rect })
    return
  }

  const area = rect.w * rect.h
  const sorted = [...items].sort((a, b) => b.value - a.value)

  let strip: TreeNode[] = []
  let stripValue = 0
  let remaining = [...sorted]
  let currentRect = { ...rect }
  let currentTotal = totalValue

  while (remaining.length > 0) {
    strip = [remaining[0]]
    stripValue = remaining[0].value

    let bestAspect = worstAspect(strip, stripValue, currentRect, currentTotal, area)

    let i = 1
    while (i < remaining.length) {
      const next = remaining[i]
      const testStrip = [...strip, next]
      const testValue = stripValue + next.value
      const testAspect = worstAspect(testStrip, testValue, currentRect, currentTotal, area)

      if (testAspect > bestAspect) break

      strip.push(next)
      stripValue = testValue
      bestAspect = testAspect
      i++
    }

    // Layout this strip
    const stripFraction = currentTotal > 0 ? stripValue / currentTotal : 0
    const isHorizontal = currentRect.w >= currentRect.h
    let sx = currentRect.x
    let sy = currentRect.y

    if (isHorizontal) {
      const stripW = currentRect.w * stripFraction
      let offset = 0
      for (const node of strip) {
        const frac = stripValue > 0 ? node.value / stripValue : 0
        const h = currentRect.h * frac
        result.push({ ...node, x: sx, y: sy + offset, w: stripW, h })
        offset += h
      }
      currentRect = {
        x: sx + stripW,
        y: currentRect.y,
        w: currentRect.w - stripW,
        h: currentRect.h,
      }
    } else {
      const stripH = currentRect.h * stripFraction
      let offset = 0
      for (const node of strip) {
        const frac = stripValue > 0 ? node.value / stripValue : 0
        const w = currentRect.w * frac
        result.push({ ...node, x: sx + offset, y: sy, w, h: stripH })
        offset += w
      }
      currentRect = {
        x: currentRect.x,
        y: sy + stripH,
        w: currentRect.w,
        h: currentRect.h - stripH,
      }
    }

    remaining = remaining.slice(strip.length)
    currentTotal -= stripValue
  }
}

function worstAspect(
  strip: TreeNode[],
  stripValue: number,
  rect: Rect,
  totalValue: number,
  totalArea: number,
): number {
  if (totalValue <= 0 || stripValue <= 0) return Infinity

  const isHorizontal = rect.w >= rect.h
  const stripFraction = stripValue / totalValue
  const stripLength = isHorizontal ? rect.w * stripFraction : rect.h * stripFraction
  const crossLength = isHorizontal ? rect.h : rect.w

  if (stripLength <= 0 || crossLength <= 0) return Infinity

  let worst = 0
  for (const node of strip) {
    const nodeFrac = node.value / stripValue
    const nodeLength = crossLength * nodeFrac
    if (nodeLength <= 0) continue
    const aspect = Math.max(stripLength / nodeLength, nodeLength / stripLength)
    worst = Math.max(worst, aspect)
  }
  return worst
}

// --- Color scale ---
function changeToColor(pct: number): string {
  const clamped = Math.max(-3, Math.min(3, pct))
  if (clamped >= 0) {
    const t = clamped / 3
    const r = Math.round(51 + (46 - 51) * t)
    const g = Math.round(51 + (125 - 51) * t)
    const b = Math.round(51 + (50 - 51) * t)
    return `rgb(${r},${g},${b})`
  } else {
    const t = -clamped / 3
    const r = Math.round(51 + (211 - 51) * t)
    const g = Math.round(51 + (47 - 51) * t)
    const b = Math.round(51 + (47 - 51) * t)
    return `rgb(${r},${g},${b})`
  }
}

function formatPct(v: number): string {
  const sign = v >= 0 ? '+' : ''
  return sign + v.toFixed(2) + '%'
}

export function SectorHeatmap({
  quotes,
  loading,
  onSelectStock,
  onRefresh,
  viewMode,
  onViewModeChange,
}: SectorHeatmapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [refreshing, setRefreshing] = useState(false)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; stock: StockQuote } | null>(null)

  // Observe container size
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      const entry = entries[0]
      if (entry) {
        setSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        })
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await onRefresh()
    setRefreshing(false)
  }, [onRefresh])

  // Build sector tree
  const sectorTree = useMemo(() => {
    const sectorMap = new Map<string, StockQuote[]>()
    for (const q of quotes) {
      const sector = q.sector || 'Other'
      if (!sectorMap.has(sector)) sectorMap.set(sector, [])
      sectorMap.get(sector)!.push(q)
    }

    const sectors: TreeNode[] = []
    for (const [sector, stocks] of sectorMap) {
      const totalCap = stocks.reduce((sum, s) => sum + (s.marketCap || 0), 0)
      if (totalCap <= 0) continue
      sectors.push({
        key: sector,
        value: totalCap,
        children: stocks
          .filter(s => s.marketCap > 0)
          .sort((a, b) => b.marketCap - a.marketCap)
          .map(s => ({
            key: s.symbol,
            value: s.marketCap,
            data: s,
          })),
      })
    }
    return sectors.sort((a, b) => b.value - a.value)
  }, [quotes])

  // Layout sectors then stocks within
  const layout = useMemo((): { sectorRects: (TreeNode & Rect)[]; blocks: { stock: StockQuote; rect: Rect; sector: string; sectorRect: Rect }[] } | null => {
    if (size.width === 0 || size.height === 0 || sectorTree.length === 0) return null

    const sectorRects = squarify(sectorTree, { x: 0, y: 0, w: size.width, h: size.height })

    const blocks: { stock: StockQuote; rect: Rect; sector: string; sectorRect: Rect }[] = []

    for (const sr of sectorRects) {
      if (!sr.children || sr.children.length === 0) continue

      // Reserve space for sector label
      const labelH = 18
      const innerRect: Rect = {
        x: sr.x + 1,
        y: sr.y + labelH,
        w: Math.max(0, sr.w - 2),
        h: Math.max(0, sr.h - labelH - 1),
      }

      const stockRects = squarify(sr.children, innerRect)
      for (const st of stockRects) {
        if (st.data) {
          blocks.push({
            stock: st.data,
            rect: { x: st.x, y: st.y, w: st.w, h: st.h },
            sector: sr.key,
            sectorRect: { x: sr.x, y: sr.y, w: sr.w, h: sr.h },
          })
        }
      }
    }

    return { sectorRects, blocks }
  }, [sectorTree, size])

  if (loading && quotes.length === 0) {
    return (
      <div className={styles.container}>
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
        </div>
        <div className={styles.loading}>データ取得中...</div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
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
        <span className={styles.stockCount}>{quotes.length} 銘柄</span>
        <button
          className={`${styles.refreshBtn} ${refreshing ? styles.refreshing : ''}`}
          onClick={handleRefresh}
          disabled={refreshing}
        >
          {refreshing ? '更新中...' : '更新'}
        </button>
      </div>

      <div
        className={styles.mapContainer}
        ref={containerRef}
        onMouseLeave={() => setTooltip(null)}
      >
        {layout?.sectorRects.map(sr => (
          <div
            key={sr.key}
            className={styles.sectorOutline}
            style={{
              left: sr.x,
              top: sr.y,
              width: sr.w,
              height: sr.h,
            }}
          >
            <div className={styles.sectorLabel}>
              {sectorJa(sr.key)}
            </div>
          </div>
        ))}

        {layout?.blocks.map(({ stock, rect }) => {
          const pct = stock.regularMarketChangePercent
          const bg = changeToColor(pct)
          const showTicker = rect.w > 35 && rect.h > 20
          const showPct = rect.w > 35 && rect.h > 32

          return (
            <div
              key={stock.symbol}
              className={styles.block}
              style={{
                left: rect.x + 0.5,
                top: rect.y + 0.5,
                width: Math.max(0, rect.w - 1),
                height: Math.max(0, rect.h - 1),
                backgroundColor: bg,
              }}
              onClick={() => onSelectStock(stock.symbol)}
              onMouseEnter={(e) => {
                setTooltip({
                  x: e.clientX,
                  y: e.clientY,
                  stock,
                })
              }}
              onMouseMove={(e) => {
                if (tooltip) {
                  setTooltip({
                    x: e.clientX,
                    y: e.clientY,
                    stock,
                  })
                }
              }}
              onMouseLeave={() => setTooltip(null)}
            >
              {showTicker && (
                <span className={styles.blockTicker}>{stock.symbol}</span>
              )}
              {showPct && (
                <span className={styles.blockChange}>{formatPct(pct)}</span>
              )}
            </div>
          )
        })}

        {/* Tooltip */}
        {tooltip && (
          <div
            className={styles.tooltip}
            style={{
              left: tooltip.x + 12,
              top: tooltip.y + 12,
            }}
          >
            <div className={styles.tooltipTicker}>{tooltip.stock.symbol}</div>
            <div className={styles.tooltipName}>{tooltip.stock.shortName}</div>
            <div className={styles.tooltipRow}>
              <span>株価</span>
              <span>{tooltip.stock.regularMarketPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div className={styles.tooltipRow}>
              <span>前日比</span>
              <span style={{ color: tooltip.stock.regularMarketChange >= 0 ? 'var(--positive)' : 'var(--negative)' }}>
                {tooltip.stock.regularMarketChange >= 0 ? '+' : ''}
                {tooltip.stock.regularMarketChange.toFixed(2)}
                {' ('}
                {formatPct(tooltip.stock.regularMarketChangePercent)}
                {')'}
              </span>
            </div>
            <div className={styles.tooltipRow}>
              <span>時価総額</span>
              <span>
                {tooltip.stock.marketCap >= 1e12
                  ? (tooltip.stock.marketCap / 1e12).toFixed(2) + 'T'
                  : tooltip.stock.marketCap >= 1e9
                  ? (tooltip.stock.marketCap / 1e9).toFixed(1) + 'B'
                  : (tooltip.stock.marketCap / 1e6).toFixed(0) + 'M'}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
