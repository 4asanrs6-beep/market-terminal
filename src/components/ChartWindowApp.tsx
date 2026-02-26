import { useState, useCallback, useEffect } from 'react'
import { StockChart } from './StockChart'
import type { QuoteSummary, FinancialsData, IncomeStatement } from '../types/stock'
import styles from '../styles/ChartWindow.module.css'

function getInitialSymbol(): string {
  const params = new URLSearchParams(window.location.search)
  return params.get('symbol') || ''
}

function fmt(v: number | null, decimals = 2): string {
  if (v == null) return '-'
  return v.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

function fmtPct(v: number | null): string {
  if (v == null) return '-'
  return v.toFixed(2) + '%'
}

const TIMEZONE_LABELS: Record<string, string> = {
  'America/New_York': 'NY時間',
  'America/Chicago': 'シカゴ時間',
  'America/Los_Angeles': 'LA時間',
  'America/Toronto': 'トロント時間',
  'Europe/London': 'ロンドン時間',
  'Europe/Paris': 'パリ時間',
  'Europe/Berlin': 'ベルリン時間',
  'Europe/Zurich': 'チューリッヒ時間',
  'Asia/Tokyo': '東京時間',
  'Asia/Hong_Kong': '香港時間',
  'Asia/Shanghai': '上海時間',
  'Asia/Taipei': '台北時間',
  'Asia/Seoul': 'ソウル時間',
  'Asia/Singapore': 'シンガポール時間',
  'Asia/Kolkata': 'インド時間',
  'Australia/Sydney': 'シドニー時間',
}

function timezoneLabel(tz: string | null | undefined): string {
  if (!tz) return '現地時間'
  return TIMEZONE_LABELS[tz] || tz.split('/').pop()?.replace('_', ' ') + '時間' || '現地時間'
}

function fmtCap(v: number | null): string {
  if (v == null) return '-'
  if (v >= 1e12) return (v / 1e12).toFixed(2) + 'T'
  if (v >= 1e9) return (v / 1e9).toFixed(2) + 'B'
  if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M'
  return v.toLocaleString()
}

function fmtRevenue(v: number | null): string {
  if (v == null) return '-'
  const abs = Math.abs(v)
  const sign = v < 0 ? '-' : ''
  if (abs >= 1e12) return sign + (abs / 1e12).toFixed(2) + 'T'
  if (abs >= 1e9) return sign + (abs / 1e9).toFixed(2) + 'B'
  if (abs >= 1e6) return sign + (abs / 1e6).toFixed(1) + 'M'
  if (abs >= 1e3) return sign + (abs / 1e3).toFixed(0) + 'K'
  return v.toLocaleString()
}

function fmtEndDate(d: string): string {
  if (!d) return '-'
  // "2024-09-28" → "2024/09"
  const parts = d.split('-')
  if (parts.length >= 2) return `${parts[0]}/${parts[1]}`
  return d
}

function marginPct(part: number | null, total: number | null): string {
  if (part == null || total == null || total === 0) return '-'
  return ((part / total) * 100).toFixed(1) + '%'
}

function yoyPct(
  statements: IncomeStatement[],
  index: number,
  field: keyof IncomeStatement,
  offset: number,
): string {
  const prevIdx = index + offset
  if (prevIdx >= statements.length) return '-'
  const current = statements[index][field] as number | null
  const previous = statements[prevIdx][field] as number | null
  if (current == null || previous == null || previous === 0) return '-'
  const pct = ((current - previous) / Math.abs(previous)) * 100
  const sign = pct > 0 ? '+' : ''
  return sign + pct.toFixed(1) + '%'
}

export function ChartWindowApp() {
  const [symbol, setSymbol] = useState(getInitialSymbol)
  const [inputValue, setInputValue] = useState(symbol)
  const [summary, setSummary] = useState<QuoteSummary | null>(null)
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [financials, setFinancials] = useState<FinancialsData | null>(null)
  const [loadingFinancials, setLoadingFinancials] = useState(false)

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = inputValue.trim().toUpperCase()
    if (trimmed) {
      setSymbol(trimmed)
    }
  }, [inputValue])

  const handleClose = useCallback(() => {
    window.close()
  }, [])

  useEffect(() => {
    if (!symbol) {
      setSummary(null)
      return
    }
    let cancelled = false
    setLoadingSummary(true)
    window.electronAPI.getQuoteSummary(symbol)
      .then(data => {
        if (!cancelled) setSummary(data)
      })
      .catch(() => {
        if (!cancelled) setSummary(null)
      })
      .finally(() => {
        if (!cancelled) setLoadingSummary(false)
      })
    return () => { cancelled = true }
  }, [symbol])

  useEffect(() => {
    if (!symbol) {
      setFinancials(null)
      return
    }
    let cancelled = false
    setLoadingFinancials(true)
    window.electronAPI.getFinancials(symbol)
      .then(data => {
        if (!cancelled) setFinancials(data)
      })
      .catch(() => {
        if (!cancelled) setFinancials(null)
      })
      .finally(() => {
        if (!cancelled) setLoadingFinancials(false)
      })
    return () => { cancelled = true }
  }, [symbol])

  const renderFinCell = (
    value: number | null,
    statements: IncomeStatement[],
    index: number,
    field: keyof IncomeStatement,
    offset: number,
  ) => {
    const yoy = yoyPct(statements, index, field, offset)
    return (
      <>
        {fmtRevenue(value)}
        {yoy !== '-' && <span className={styles.finYoy}> ({yoy})</span>}
      </>
    )
  }

  const renderIncomeTable = (statements: IncomeStatement[], title: string, compareOffset: number) => {
    if (!statements || statements.length === 0) return null
    // Detect currency unit from the largest revenue value
    let unit = 'USD'
    const maxRev = Math.max(...statements.map(s => Math.abs(s.totalRevenue ?? 0)))
    if (maxRev >= 1e12) unit = 'USD (T)'
    else if (maxRev >= 1e9) unit = 'USD (B)'
    else if (maxRev >= 1e6) unit = 'USD (M)'
    return (
      <div className={styles.finSection}>
        <div className={styles.finTitle}>{title} <span className={styles.finUnit}>{unit}</span></div>
        <table className={styles.finTable}>
          <thead>
            <tr>
              <th className={styles.finTh}>期間</th>
              {statements.map((s, i) => (
                <th key={i} className={styles.finTh}>{fmtEndDate(s.endDate)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={styles.finTdLabel}>売上高</td>
              {statements.map((s, i) => (
                <td key={i} className={styles.finTd}>
                  {renderFinCell(s.totalRevenue, statements, i, 'totalRevenue', compareOffset)}
                </td>
              ))}
            </tr>
            <tr>
              <td className={styles.finTdLabel}>営業利益</td>
              {statements.map((s, i) => (
                <td key={i} className={styles.finTd}>
                  {renderFinCell(s.operatingIncome, statements, i, 'operatingIncome', compareOffset)}
                </td>
              ))}
            </tr>
            <tr>
              <td className={styles.finTdLabel}>  営業利益率</td>
              {statements.map((s, i) => (
                <td key={i} className={styles.finTd}>{marginPct(s.operatingIncome, s.totalRevenue)}</td>
              ))}
            </tr>
            <tr>
              <td className={styles.finTdLabel}>純利益</td>
              {statements.map((s, i) => (
                <td key={i} className={styles.finTd}>
                  {renderFinCell(s.netIncome, statements, i, 'netIncome', compareOffset)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.toolbar}>
        <form className={styles.tickerForm} onSubmit={handleSubmit}>
          <input
            type="text"
            className={styles.tickerInput}
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            placeholder="ティッカーを入力 (例: AAPL, ^GSPC, BTC-USD)"
            spellCheck={false}
          />
          <button type="submit" className={styles.goBtn}>
            表示
          </button>
        </form>
        {symbol && (
          <span className={styles.currentSymbol}>{symbol}</span>
        )}
        <button className={styles.closeBtn} onClick={handleClose}>
          ✕ 閉じる
        </button>
      </div>

      {symbol ? (
        <>
          <div className={styles.chartsGrid}>
            <StockChart symbol={symbol} label={`5分足 (${timezoneLabel(summary?.exchangeTimezone)})`} period="1d" interval="5m" />
            <StockChart symbol={symbol} label="日足" period="6mo" interval="1d" maPeriods={[25, 75, 200]} />
            <StockChart symbol={symbol} label="週足" period="2y" interval="1wk" />
          </div>

          <div className={styles.fundamentals}>
            {loadingSummary ? (
              <span className={styles.fundLoading}>指標取得中...</span>
            ) : summary ? (
              <>
                {/* Header: Company + Market Cap */}
                <div className={styles.fundHeaderBar}>
                  <div className={styles.fundHeaderLeft}>
                    <span className={styles.fundName}>
                      {summary.longName || summary.shortName}
                    </span>
                    {summary.sector && (
                      <span className={styles.fundSectorTag}>
                        {summary.sector}{summary.industry ? ` / ${summary.industry}` : ''}
                      </span>
                    )}
                    {summary.country && (
                      <span className={styles.fundMeta}>
                        {summary.city ? `${summary.city}, ` : ''}{summary.country}
                        {summary.fullTimeEmployees != null && ` | ${summary.fullTimeEmployees.toLocaleString()}名`}
                      </span>
                    )}
                  </div>
                  <div className={styles.fundHeaderRight}>
                    <div className={styles.fundCapBlock}>
                      <span className={styles.fundCapLabel}>時価総額</span>
                      <span className={styles.fundCapValue}>{fmtCap(summary.marketCap)}</span>
                    </div>
                    {summary.enterpriseValue != null && (
                      <div className={styles.fundCapBlock}>
                        <span className={styles.fundCapLabel}>企業価値</span>
                        <span className={styles.fundCapValueSm}>{fmtCap(summary.enterpriseValue)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Categorized stats grid */}
                <div className={styles.fundSections}>
                  {/* Valuation */}
                  <div className={styles.fundSection}>
                    <div className={styles.fundSectionTitle}>バリュエーション</div>
                    <table className={styles.fundTable}>
                      <tbody>
                        <tr>
                          <td className={styles.ftLabel}>PER (実績)</td>
                          <td className={styles.ftValue}>{fmt(summary.trailingPE)}</td>
                        </tr>
                        <tr>
                          <td className={styles.ftLabel}>PER (予想)</td>
                          <td className={styles.ftValue}>{fmt(summary.forwardPE)}</td>
                        </tr>
                        <tr>
                          <td className={styles.ftLabel}>PBR</td>
                          <td className={styles.ftValue}>{fmt(summary.priceToBook)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Earnings */}
                  <div className={styles.fundSection}>
                    <div className={styles.fundSectionTitle}>収益</div>
                    <table className={styles.fundTable}>
                      <tbody>
                        <tr>
                          <td className={styles.ftLabel}>EPS (実績)</td>
                          <td className={styles.ftValue}>{fmt(summary.epsTrailingTwelveMonths)}</td>
                        </tr>
                        <tr>
                          <td className={styles.ftLabel}>EPS (予想)</td>
                          <td className={styles.ftValue}>{fmt(summary.epsForward)}</td>
                        </tr>
                        <tr>
                          <td className={styles.ftLabel}>売上/株</td>
                          <td className={styles.ftValue}>{fmt(summary.revenuePerShare)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Profitability */}
                  <div className={styles.fundSection}>
                    <div className={styles.fundSectionTitle}>収益性</div>
                    <table className={styles.fundTable}>
                      <tbody>
                        <tr>
                          <td className={styles.ftLabel}>利益率</td>
                          <td className={styles.ftValue}>{fmtPct(summary.profitMargins)}</td>
                        </tr>
                        <tr>
                          <td className={styles.ftLabel}>ROE</td>
                          <td className={styles.ftValue}>{fmtPct(summary.returnOnEquity)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Dividends */}
                  <div className={styles.fundSection}>
                    <div className={styles.fundSectionTitle}>配当</div>
                    <table className={styles.fundTable}>
                      <tbody>
                        <tr>
                          <td className={styles.ftLabel}>配当利回り</td>
                          <td className={styles.ftValue}>{fmtPct(summary.dividendYield)}</td>
                        </tr>
                        <tr>
                          <td className={styles.ftLabel}>年間配当</td>
                          <td className={styles.ftValue}>{fmt(summary.trailingAnnualDividendRate)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Range & Risk */}
                  <div className={styles.fundSection}>
                    <div className={styles.fundSectionTitle}>レンジ</div>
                    <table className={styles.fundTable}>
                      <tbody>
                        <tr>
                          <td className={styles.ftLabel}>52W 高値</td>
                          <td className={styles.ftValue}>{fmt(summary.fiftyTwoWeekHigh)}</td>
                        </tr>
                        <tr>
                          <td className={styles.ftLabel}>52W 安値</td>
                          <td className={styles.ftValue}>{fmt(summary.fiftyTwoWeekLow)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Risk */}
                  <div className={styles.fundSection}>
                    <div className={styles.fundSectionTitle}>リスク</div>
                    <table className={styles.fundTable}>
                      <tbody>
                        <tr>
                          <td className={styles.ftLabel}>Beta</td>
                          <td className={styles.ftValue}>{fmt(summary.beta)}</td>
                        </tr>
                        <tr>
                          <td className={styles.ftLabel}>D/E 比率</td>
                          <td className={styles.ftValue}>{fmt(summary.debtToEquity)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Business description */}
                {summary.longBusinessSummary && (
                  <div className={styles.fundProfile}>
                    <div className={styles.fundProfileHeader}>企業概要</div>
                    <p className={styles.fundProfileText}>
                      {summary.longBusinessSummary}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <span className={styles.fundLoading}>指標データなし</span>
            )}
          </div>

          <div className={styles.financials}>
            {loadingFinancials ? (
              <span className={styles.fundLoading}>業績データ取得中...</span>
            ) : financials ? (
              <div className={styles.finContainer}>
                {renderIncomeTable(financials.annual, '通期業績', 1)}
                {renderIncomeTable(financials.quarterly, '四半期業績', 4)}
              </div>
            ) : (
              <span className={styles.fundLoading}>業績データなし</span>
            )}
          </div>
        </>
      ) : (
        <div className={styles.empty}>
          ティッカーシンボルを入力してください
        </div>
      )}
    </div>
  )
}
