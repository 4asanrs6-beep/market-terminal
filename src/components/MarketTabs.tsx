import type { MarketIndex } from '../types/stock'

interface MarketTabsProps {
  activeMarket: MarketIndex
  onMarketChange: (market: MarketIndex) => void
  onAddTicker: () => void
}

const tabStyle = {
  base: {
    display: 'block',
    width: '100%',
    padding: '10px 16px',
    textAlign: 'left' as const,
    fontSize: '12px',
    fontWeight: 600,
    letterSpacing: '0.5px',
    border: 'none',
    borderLeft: '3px solid transparent',
    cursor: 'pointer',
    transition: 'all 0.15s',
    fontFamily: 'inherit',
  },
  inactive: {
    background: 'transparent',
    color: 'var(--text-secondary)',
  },
  active: {
    background: 'var(--bg-active)',
    color: 'var(--accent-orange)',
    borderLeftColor: 'var(--accent-orange)',
  },
}

const tabs: { id: MarketIndex; label: string; sub: string }[] = [
  { id: 'sp500', label: 'S&P 500', sub: '全構成銘柄' },
  { id: 'nasdaq100', label: 'NASDAQ 100', sub: '全構成銘柄' },
  { id: 'watchlist', label: 'ウォッチリスト', sub: 'カスタム' },
]

export function MarketTabs({ activeMarket, onMarketChange, onAddTicker }: MarketTabsProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{
        padding: '12px 16px 8px',
        fontSize: '9px',
        fontWeight: 700,
        letterSpacing: '1.5px',
        color: 'var(--text-muted)',
        textTransform: 'uppercase',
      }}>
        マーケット
      </div>

      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onMarketChange(tab.id)}
          style={{
            ...tabStyle.base,
            ...(activeMarket === tab.id ? tabStyle.active : tabStyle.inactive),
          }}
          onMouseEnter={(e) => {
            if (activeMarket !== tab.id) {
              e.currentTarget.style.background = 'var(--bg-hover)'
              e.currentTarget.style.color = 'var(--text-primary)'
            }
          }}
          onMouseLeave={(e) => {
            if (activeMarket !== tab.id) {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = 'var(--text-secondary)'
            }
          }}
        >
          <div>{tab.label}</div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
            {tab.sub}
          </div>
        </button>
      ))}

      <div style={{ flex: 1 }} />

      <div style={{ padding: '12px' }}>
        <button
          onClick={onAddTicker}
          style={{
            width: '100%',
            padding: '8px',
            background: 'var(--bg-tertiary)',
            border: '1px dashed var(--border-light)',
            borderRadius: '4px',
            color: 'var(--text-secondary)',
            fontSize: '11px',
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--accent-orange)'
            e.currentTarget.style.color = 'var(--accent-orange)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-light)'
            e.currentTarget.style.color = 'var(--text-secondary)'
          }}
        >
          + 銘柄を追加
        </button>
      </div>
    </div>
  )
}
