import type { StockQuote } from '../types/stock'
import { StockChart } from './StockChart'
import styles from '../styles/StockDetailPage.module.css'

interface StockDetailPageProps {
  symbol: string
  quote: StockQuote | null
  onBack: () => void
}

function formatNumber(n: number, decimals = 2): string {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

export function StockDetailPage({ symbol, quote, onBack }: StockDetailPageProps) {
  const isPositive = quote ? quote.regularMarketChange >= 0 : true
  const changeClass = isPositive ? styles.positive : styles.negative

  return (
    <div className={styles.container}>
      <div className={styles.toolbar}>
        <button className={styles.backBtn} onClick={onBack}>
          &#x2190; 一覧に戻る
        </button>
        <div className={styles.tickerInfo}>
          <span className={styles.tickerSymbol}>{symbol}</span>
          {quote && (
            <>
              <span className={styles.tickerName}>{quote.shortName}</span>
              <span className={`${styles.tickerPrice} ${changeClass}`}>
                {formatNumber(quote.regularMarketPrice)}
              </span>
              <span className={`${styles.tickerChange} ${changeClass}`}>
                {isPositive ? '+' : ''}{formatNumber(quote.regularMarketChange)}
                ({isPositive ? '+' : ''}{formatNumber(quote.regularMarketChangePercent)}%)
              </span>
            </>
          )}
        </div>
      </div>

      <div className={styles.chartsGrid}>
        <StockChart symbol={symbol} label="5分足" period="1d" interval="5m" />
        <StockChart symbol={symbol} label="日足" period="6mo" interval="1d" />
        <StockChart symbol={symbol} label="週足" period="5y" interval="1wk" />
      </div>
    </div>
  )
}
