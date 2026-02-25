const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

interface QuoteResult {
  symbol: string
  shortName: string
  sector: string
  regularMarketPrice: number
  regularMarketChange: number
  regularMarketChangePercent: number
  regularMarketVolume: number
  regularMarketPreviousClose: number
  regularMarketOpen: number
  regularMarketDayHigh: number
  regularMarketDayLow: number
  fiftyTwoWeekHigh: number
  fiftyTwoWeekLow: number
  marketCap: number
}

interface ChartPoint {
  time: string | number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

// Simple TTL cache
const cache = new Map<string, { data: unknown; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

function getCached<T>(key: string, ttl = CACHE_TTL): T | null {
  const entry = cache.get(key)
  if (entry && Date.now() - entry.timestamp < ttl) {
    return entry.data as T
  }
  cache.delete(key)
  return null
}

function setCache(key: string, data: unknown) {
  cache.set(key, { data, timestamp: Date.now() })
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// --- Yahoo Finance crumb/cookie auth ---
let _crumb = ''
let _cookie = ''
let _crumbExpiry = 0
const CRUMB_TTL = 30 * 60 * 1000 // 30 minutes

let _crumbLock: Promise<boolean> | null = null

async function ensureCrumb(): Promise<boolean> {
  if (_crumb && _cookie && Date.now() < _crumbExpiry) return true

  // Prevent multiple concurrent crumb requests
  if (_crumbLock) return _crumbLock
  _crumbLock = _fetchCrumb()
  const result = await _crumbLock
  _crumbLock = null
  return result
}

async function _fetchCrumb(): Promise<boolean> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res1 = await fetch('https://fc.yahoo.com/', {
        headers: { 'User-Agent': USER_AGENT },
        redirect: 'manual',
      })
      const setCookies = res1.headers.getSetCookie()
      _cookie = setCookies.map(c => c.split(';')[0]).join('; ')

      const res2 = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', {
        headers: { 'User-Agent': USER_AGENT, 'Cookie': _cookie },
      })
      if (res2.status === 429) {
        console.warn(`ensureCrumb: 429 rate limited, waiting 30s...`)
        await sleep(30000)
        continue
      }
      if (!res2.ok) {
        console.error('Failed to get crumb:', res2.status)
        return false
      }
      _crumb = await res2.text()
      _crumbExpiry = Date.now() + CRUMB_TTL
      console.log('Crumb obtained successfully')
      return true
    } catch (err) {
      console.error('ensureCrumb error:', err)
      if (attempt < 1) await sleep(5000)
    }
  }
  return false
}

// --- Quote fetching via v7 API (with crumb) ---
async function fetchQuotesV7(symbols: string[], retries = 2): Promise<any[]> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const hasCrumb = await ensureCrumb()
    if (!hasCrumb) return []

    const url = `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${symbols.join(',')}&crumb=${encodeURIComponent(_crumb)}`
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, 'Cookie': _cookie },
      })
      if (res.status === 401) {
        _crumb = ''
        _crumbExpiry = 0
        await sleep(1000)
        continue
      }
      if (res.status === 429) {
        console.warn(`fetchQuotesV7: 429 rate limited (attempt ${attempt + 1})`)
        if (attempt < retries) { await sleep(5000); continue }
        return []
      }
      if (!res.ok) {
        console.error(`fetchQuotesV7: ${res.status} (attempt ${attempt + 1})`)
        if (attempt < retries) { await sleep(1000); continue }
        return []
      }
      const data = await res.json() as any
      const results = data.quoteResponse?.result ?? []
      if (results.length === 0 && symbols.length > 0 && attempt < retries) {
        console.warn(`fetchQuotesV7: 0 results for ${symbols.length} symbols (attempt ${attempt + 1}), retrying...`)
        await sleep(2000)
        continue
      }
      return results
    } catch (err) {
      console.error(`fetchQuotesV7 network error (attempt ${attempt + 1}):`, err)
      if (attempt < retries) await sleep(1000)
    }
  }
  return []
}

export async function getStockQuotes(symbols: string[]): Promise<QuoteResult[]> {
  const cacheKey = `quotes:${[...symbols].sort().join(',')}`
  const cached = getCached<QuoteResult[]>(cacheKey)
  if (cached) return cached

  const results: QuoteResult[] = []

  // v7 API supports batch queries; process in batches of 50 with small delays
  const batchSize = 50
  for (let i = 0; i < symbols.length; i += batchSize) {
    const batch = symbols.slice(i, i + batchSize)
    try {
      const quotes = await fetchQuotesV7(batch)
      for (const q of quotes) {
        results.push({
          symbol: q.symbol ?? '',
          shortName: q.shortName || q.longName || q.symbol || '',
          sector: '',  // v7 API does not return sector; filled in by getSectors()
          regularMarketPrice: q.regularMarketPrice ?? 0,
          regularMarketChange: q.regularMarketChange ?? 0,
          regularMarketChangePercent: q.regularMarketChangePercent ?? 0,
          regularMarketVolume: q.regularMarketVolume ?? 0,
          regularMarketPreviousClose: q.regularMarketPreviousClose ?? 0,
          regularMarketOpen: q.regularMarketOpen ?? 0,
          regularMarketDayHigh: q.regularMarketDayHigh ?? 0,
          regularMarketDayLow: q.regularMarketDayLow ?? 0,
          fiftyTwoWeekHigh: q.fiftyTwoWeekHigh ?? 0,
          fiftyTwoWeekLow: q.fiftyTwoWeekLow ?? 0,
          marketCap: q.marketCap ?? 0,
        })
      }
      if (quotes.length === 0) {
        console.warn(`Batch ${Math.floor(i / batchSize) + 1}: 0 results for ${batch.length} symbols`)
      }
    } catch (err) {
      console.error(`fetchQuotesV7 batch ${Math.floor(i / batchSize) + 1} error:`, err)
    }
    // Longer delay between batches to avoid Yahoo rate limiting
    if (i + batchSize < symbols.length) {
      await sleep(500)
    }
  }

  console.log(`getStockQuotes: ${results.length}/${symbols.length} fetched`)
  setCache(cacheKey, results)
  return results
}

// --- Sector data (from hardcoded constituents, no API calls needed) ---
export { getSectorsForSymbols as getSectors } from './constituents'

// --- 5-day change ---
async function fetch5DayForSymbol(symbol: string): Promise<{ symbol: string; change: number } | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=10d&interval=1d&includePrePost=false`
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
    if (!res.ok) return null

    const json = await res.json() as any
    const chartResult = json.chart?.result?.[0]
    if (!chartResult) return null

    const closes: number[] = chartResult.indicators?.quote?.[0]?.close ?? []
    const validCloses = closes.filter((c: any) => c != null)
    if (validCloses.length >= 2) {
      const daysBack = Math.min(5, validCloses.length - 1)
      const oldClose = validCloses[validCloses.length - 1 - daysBack]
      const newClose = validCloses[validCloses.length - 1]
      if (oldClose > 0) {
        return { symbol, change: ((newClose - oldClose) / oldClose) * 100 }
      }
    }
  } catch {
    // skip
  }
  return null
}

export async function get5DayChanges(symbols: string[]): Promise<Record<string, number>> {
  const cacheKey = `5day:${[...symbols].sort().join(',')}`
  const cached = getCached<Record<string, number>>(cacheKey)
  if (cached) return cached

  const result: Record<string, number> = {}
  const concurrency = 10

  for (let i = 0; i < symbols.length; i += concurrency) {
    const batch = symbols.slice(i, i + concurrency)
    const results = await Promise.all(batch.map(s => fetch5DayForSymbol(s)))
    for (const r of results) {
      if (r) result[r.symbol] = r.change
    }
    if (i + concurrency < symbols.length) {
      await sleep(200)
    }
  }

  console.log(`get5DayChanges: ${Object.keys(result).length}/${symbols.length} fetched`)
  setCache(cacheKey, result)
  return result
}

// --- Quote summary (fundamentals) ---
export interface QuoteSummary {
  shortName: string
  longName: string
  sector: string
  industry: string
  trailingPE: number | null
  forwardPE: number | null
  priceToBook: number | null
  epsTrailingTwelveMonths: number | null
  epsForward: number | null
  dividendYield: number | null
  trailingAnnualDividendRate: number | null
  fiftyTwoWeekHigh: number | null
  fiftyTwoWeekLow: number | null
  marketCap: number | null
  enterpriseValue: number | null
  revenuePerShare: number | null
  profitMargins: number | null
  returnOnEquity: number | null
  debtToEquity: number | null
  beta: number | null
  longBusinessSummary: string | null
  fullTimeEmployees: number | null
  website: string | null
  country: string | null
  city: string | null
}

// Fetch Japanese company description from Yahoo Finance Japan
async function fetchJapaneseProfile(symbol: string): Promise<string | null> {
  try {
    // Yahoo Finance Japan uses the same ticker for US stocks (e.g. AAPL, MSFT)
    const url = `https://finance.yahoo.co.jp/quote/${encodeURIComponent(symbol)}/profile`
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
    })
    if (!res.ok) return null

    const html = await res.text()

    // Extract __PRELOADED_STATE__ JSON from the page
    const match = html.match(/window\.__PRELOADED_STATE__\s*=\s*(\{.+?\});\s*<\/script>/s)
    if (match) {
      try {
        const state = JSON.parse(match[1])
        // Navigate to mainUsStocksProfile.section for the description
        const section = state?.mainUsStocksProfile?.section
        if (section) {
          // The description can be in section.text, section.body, or as items
          const text = section.text || section.body || ''
          if (text) return text
        }
        // Alternative path: try items array
        const items = state?.mainUsStocksProfile?.items
        if (items && Array.isArray(items)) {
          for (const item of items) {
            if (item.title === '特色' && item.text) return item.text
          }
        }
      } catch { /* JSON parse error */ }
    }

    // Fallback: try to extract the "特色" section from HTML directly
    // Look for text between 特色 heading and next section
    const tokushokuMatch = html.match(/特色<\/h2>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i)
    if (tokushokuMatch) {
      // Strip HTML tags
      const text = tokushokuMatch[1].replace(/<[^>]+>/g, '').trim()
      if (text.length > 20) return text
    }
  } catch (err) {
    console.error(`fetchJapaneseProfile(${symbol}) error:`, err)
  }
  return null
}

export async function getQuoteSummary(symbol: string): Promise<QuoteSummary | null> {
  const cacheKey = `summary:${symbol}`
  const cached = getCached<QuoteSummary>(cacheKey)
  if (cached) return cached

  try {
    const hasCrumb = await ensureCrumb()
    if (!hasCrumb) return null

    // v7 quote API has most fields we need
    const url = `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}&crumb=${encodeURIComponent(_crumb)}`
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, 'Cookie': _cookie },
    })
    if (!res.ok) return null

    const data = await res.json() as any
    const q = data.quoteResponse?.result?.[0]
    if (!q) return null

    // Also try v10 quoteSummary for extra fields (profitMargins, ROE, D/E, etc.)
    let summaryData: any = {}
    try {
      const v10Url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=defaultKeyStatistics,financialData,assetProfile&crumb=${encodeURIComponent(_crumb)}`
      const v10Res = await fetch(v10Url, {
        headers: { 'User-Agent': USER_AGENT, 'Cookie': _cookie },
      })
      if (v10Res.ok) {
        const v10Data = await v10Res.json() as any
        const result = v10Data.quoteSummary?.result?.[0]
        const profile = result?.assetProfile || {}
        summaryData = {
          ...result?.defaultKeyStatistics,
          ...result?.financialData,
          _profile: profile,
        }
      }
    } catch { /* v10 is supplementary, not critical */ }

    const summary: QuoteSummary = {
      shortName: q.shortName || '',
      longName: q.longName || '',
      sector: q.sector || '',
      industry: q.industry || '',
      trailingPE: q.trailingPE ?? null,
      forwardPE: q.forwardPE ?? null,
      priceToBook: q.priceToBook ?? null,
      epsTrailingTwelveMonths: q.epsTrailingTwelveMonths ?? null,
      epsForward: q.epsForward ?? null,
      dividendYield: q.trailingAnnualDividendYield != null ? q.trailingAnnualDividendYield * 100 : null,
      trailingAnnualDividendRate: q.trailingAnnualDividendRate ?? null,
      fiftyTwoWeekHigh: q.fiftyTwoWeekHigh ?? null,
      fiftyTwoWeekLow: q.fiftyTwoWeekLow ?? null,
      marketCap: q.marketCap ?? null,
      enterpriseValue: summaryData.enterpriseValue?.raw ?? null,
      revenuePerShare: summaryData.revenuePerShare?.raw ?? null,
      profitMargins: summaryData.profitMargins?.raw != null ? summaryData.profitMargins.raw * 100 : null,
      returnOnEquity: summaryData.returnOnEquity?.raw != null ? summaryData.returnOnEquity.raw * 100 : null,
      debtToEquity: summaryData.debtToEquity?.raw ?? null,
      beta: summaryData.beta?.raw ?? q.beta ?? null,
      // Japanese description will be filled in below
      longBusinessSummary: summaryData._profile?.longBusinessSummary || null,
      fullTimeEmployees: summaryData._profile?.fullTimeEmployees ?? null,
      website: summaryData._profile?.website || null,
      country: summaryData._profile?.country || null,
      city: summaryData._profile?.city || null,
    }

    // Try to get Japanese description from Yahoo Finance Japan
    try {
      const jaDesc = await fetchJapaneseProfile(symbol)
      if (jaDesc) {
        summary.longBusinessSummary = jaDesc
      }
    } catch { /* fallback to English description */ }

    setCache(cacheKey, summary)
    return summary
  } catch (err) {
    console.error(`Failed to fetch quote summary for ${symbol}:`, err)
    return null
  }
}

// --- Financials (income statement) ---
export interface IncomeStatement {
  endDate: string          // e.g. "2024-09-28"
  totalRevenue: number | null
  operatingIncome: number | null
  netIncome: number | null
  grossProfit: number | null
  ebit: number | null
}

export interface FinancialsData {
  annual: IncomeStatement[]
  quarterly: IncomeStatement[]
}

export async function getFinancials(symbol: string): Promise<FinancialsData | null> {
  const cacheKey = `financials:${symbol}`
  const cached = getCached<FinancialsData>(cacheKey)
  if (cached) return cached

  try {
    // Ensure we have a valid cookie (crumb not needed for timeseries, but cookie is)
    const hasCrumb = await ensureCrumb()
    if (!hasCrumb) return null

    const now = Math.floor(Date.now() / 1000)
    const fiveYearsAgo = now - 5 * 365 * 24 * 3600

    const types = [
      'annualTotalRevenue', 'annualGrossProfit', 'annualOperatingIncome', 'annualNetIncome',
      'quarterlyTotalRevenue', 'quarterlyGrossProfit', 'quarterlyOperatingIncome', 'quarterlyNetIncome',
    ].join(',')

    const url = `https://query2.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${encodeURIComponent(symbol)}?type=${types}&period1=${fiveYearsAgo}&period2=${now}`
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, 'Cookie': _cookie },
    })
    if (!res.ok) {
      console.error(`getFinancials timeseries: ${res.status}`)
      return null
    }

    const data = await res.json() as any
    const seriesList: any[] = data.timeseries?.result || []

    // Extract a named series into a date->value map
    function extractSeries(name: string): Map<string, number> {
      const map = new Map<string, number>()
      for (const s of seriesList) {
        if (!Array.isArray(s[name])) continue
        for (const v of s[name]) {
          if (v.asOfDate && v.reportedValue?.raw != null) {
            map.set(v.asOfDate, v.reportedValue.raw)
          }
        }
      }
      return map
    }

    function buildStatements(prefix: string): IncomeStatement[] {
      const revenue = extractSeries(`${prefix}TotalRevenue`)
      const gross = extractSeries(`${prefix}GrossProfit`)
      const opIncome = extractSeries(`${prefix}OperatingIncome`)
      const net = extractSeries(`${prefix}NetIncome`)

      // Collect all unique dates, sort descending (newest first)
      const allDates = new Set([...revenue.keys(), ...gross.keys(), ...opIncome.keys(), ...net.keys()])
      const dates = [...allDates].sort().reverse()

      return dates.map(date => ({
        endDate: date,
        totalRevenue: revenue.get(date) ?? null,
        grossProfit: gross.get(date) ?? null,
        operatingIncome: opIncome.get(date) ?? null,
        netIncome: net.get(date) ?? null,
        ebit: null,
      }))
    }

    const financials: FinancialsData = {
      annual: buildStatements('annual'),
      quarterly: buildStatements('quarterly'),
    }

    console.log(`getFinancials(${symbol}): annual=${financials.annual.length}, quarterly=${financials.quarterly.length}`)
    setCache(cacheKey, financials)
    return financials
  } catch (err) {
    console.error(`Failed to fetch financials for ${symbol}:`, err)
    return null
  }
}

// --- Sparkline data (batch close prices) ---
export async function getSparklines(symbols: string[]): Promise<Record<string, number[]>> {
  const cacheKey = `sparklines:${[...symbols].sort().join(',')}`
  const cached = getCached<Record<string, number[]>>(cacheKey)
  if (cached) return cached

  const result: Record<string, number[]> = {}
  const concurrency = 5

  async function fetchOne(symbol: string): Promise<void> {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1mo&interval=1d&includePrePost=false`
      const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
      if (!res.ok) return
      const json = await res.json() as any
      const closes: (number | null)[] = json.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? []
      const valid = closes.filter((c): c is number => c != null)
      if (valid.length >= 2) {
        result[symbol] = valid
      }
    } catch { /* skip */ }
  }

  for (let i = 0; i < symbols.length; i += concurrency) {
    const batch = symbols.slice(i, i + concurrency)
    await Promise.all(batch.map(s => fetchOne(s)))
    if (i + concurrency < symbols.length) {
      await sleep(200)
    }
  }

  console.log(`getSparklines: ${Object.keys(result).length}/${symbols.length} fetched`)
  setCache(cacheKey, result)
  return result
}

// --- Chart data ---
export async function getChartData(
  symbol: string,
  period: string = '1mo',
  interval: string = '1d'
): Promise<ChartPoint[]> {
  const cacheKey = `chart:${symbol}:${period}:${interval}`
  const cached = getCached<ChartPoint[]>(cacheKey)
  if (cached) return cached

  try {
    const range = period === '1w' ? '5d' : period
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}&includePrePost=false`
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
    if (!res.ok) return []

    const json = await res.json()
    const result = (json as any).chart?.result?.[0]
    if (!result) return []

    const timestamps: number[] = result.timestamp || []
    const quote = result.indicators?.quote?.[0]
    if (!quote) return []

    // Get exchange timezone offset (seconds) for intraday time adjustment
    const gmtoffset: number = result.meta?.gmtoffset ?? 0

    const points: ChartPoint[] = []
    for (let i = 0; i < timestamps.length; i++) {
      const open = quote.open?.[i]
      const high = quote.high?.[i]
      const low = quote.low?.[i]
      const close = quote.close?.[i]
      const volume = quote.volume?.[i]

      if (open == null || close == null) continue

      const isIntraday = interval.includes('m') && !interval.includes('mo')
      let timeStr: string | number
      if (isIntraday) {
        // Adjust UTC timestamp by exchange gmtoffset so lightweight-charts
        // displays exchange local time (e.g. NY 9:30-16:00)
        timeStr = timestamps[i] + gmtoffset
      } else {
        const date = new Date(timestamps[i] * 1000)
        timeStr = date.toISOString().split('T')[0]
      }

      points.push({
        time: timeStr,
        open: open ?? 0,
        high: high ?? 0,
        low: low ?? 0,
        close: close ?? 0,
        volume: volume ?? 0,
      })
    }

    setCache(cacheKey, points)
    return points
  } catch (err) {
    console.error(`Failed to fetch chart data for ${symbol}:`, err)
    return []
  }
}
