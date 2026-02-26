import { useMemo } from 'react'
import type { StockQuote } from '../types/stock'

interface ListSummaryProps {
  quotes: StockQuote[]
}

function formatVol(n: number): string {
  if (n >= 1_000_000_000_000) return (n / 1_000_000_000_000).toFixed(2) + 'T'
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + 'B'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return n.toString()
}

function formatTrillion(n: number): string {
  if (n >= 1_000_000_000_000) return '$' + (n / 1_000_000_000_000).toFixed(2) + 'T'
  if (n >= 1_000_000_000) return '$' + (n / 1_000_000_000).toFixed(1) + 'B'
  return '$' + (n / 1_000_000).toFixed(0) + 'M'
}

const containerStyle: React.CSSProperties = {
  padding: '6px 12px',
  background: 'var(--bg-tertiary)',
  borderBottom: '1px solid var(--border-color)',
  fontFamily: 'var(--font-mono)',
  fontSize: '11px',
  lineHeight: '1.6',
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '16px',
  alignItems: 'center',
  flexWrap: 'wrap',
}

const labelStyle: React.CSSProperties = {
  color: 'var(--text-muted)',
}

const valueStyle: React.CSSProperties = {
  fontWeight: 600,
  color: 'var(--text-primary)',
}

const positiveStyle: React.CSSProperties = {
  fontWeight: 700,
  color: 'var(--positive)',
}

const negativeStyle: React.CSSProperties = {
  fontWeight: 700,
  color: 'var(--negative)',
}

const topItemStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '3px',
}

const tickerStyle: React.CSSProperties = {
  color: 'var(--accent-blue)',
  fontWeight: 700,
}

export function ListSummary({ quotes }: ListSummaryProps) {
  const summary = useMemo(() => {
    if (!quotes || quotes.length === 0) return null

    let gainers = 0
    let losers = 0
    let unchanged = 0
    let totalChangePercent = 0
    let totalVolume = 0
    let totalMarketCap = 0

    for (const q of quotes) {
      if (q.regularMarketChange > 0) gainers++
      else if (q.regularMarketChange < 0) losers++
      else unchanged++
      totalChangePercent += q.regularMarketChangePercent
      totalVolume += q.regularMarketVolume
      totalMarketCap += q.marketCap
    }

    const avgChange = totalChangePercent / quotes.length

    const sorted = [...quotes].sort((a, b) => b.regularMarketChangePercent - a.regularMarketChangePercent)
    const top3 = sorted.slice(0, 3)
    const bottom3 = sorted.slice(-3).reverse()

    return { gainers, losers, unchanged, avgChange, totalVolume, totalMarketCap, top3, bottom3 }
  }, [quotes])

  if (!summary) return null

  const avgStyle = summary.avgChange >= 0 ? positiveStyle : negativeStyle
  const avgPrefix = summary.avgChange >= 0 ? '+' : ''

  return (
    <div style={containerStyle}>
      {/* Row 1: Gainers/Losers + Metrics */}
      <div style={rowStyle}>
        <span>
          <span style={labelStyle}>値上がり </span>
          <span style={positiveStyle}>{summary.gainers}</span>
        </span>
        <span>
          <span style={labelStyle}>値下がり </span>
          <span style={negativeStyle}>{summary.losers}</span>
        </span>
        {summary.unchanged > 0 && (
          <span>
            <span style={labelStyle}>変わらず </span>
            <span style={valueStyle}>{summary.unchanged}</span>
          </span>
        )}
        <span style={{ borderLeft: '1px solid var(--border-color)', paddingLeft: '12px' }}>
          <span style={labelStyle}>平均騰落 </span>
          <span style={avgStyle}>{avgPrefix}{summary.avgChange.toFixed(2)}%</span>
        </span>
        <span>
          <span style={labelStyle}>出来高 </span>
          <span style={valueStyle}>{formatVol(summary.totalVolume)}</span>
        </span>
        <span>
          <span style={labelStyle}>時価総額 </span>
          <span style={valueStyle}>{formatTrillion(summary.totalMarketCap)}</span>
        </span>
      </div>

      {/* Row 2: Top gainers & losers */}
      <div style={{ ...rowStyle, marginTop: '2px' }}>
        <span style={labelStyle}>TOP</span>
        {summary.top3.map(q => (
          <span key={q.symbol} style={topItemStyle}>
            <span style={tickerStyle}>{q.symbol}</span>
            <span style={positiveStyle}>+{q.regularMarketChangePercent.toFixed(1)}%</span>
          </span>
        ))}
        <span style={{ borderLeft: '1px solid var(--border-color)', paddingLeft: '12px', ...labelStyle }}>WORST</span>
        {summary.bottom3.map(q => (
          <span key={q.symbol} style={topItemStyle}>
            <span style={tickerStyle}>{q.symbol}</span>
            <span style={negativeStyle}>{q.regularMarketChangePercent.toFixed(1)}%</span>
          </span>
        ))}
      </div>
    </div>
  )
}
