const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

interface QuoteResult {
  symbol: string
  shortName: string
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

function getCached<T>(key: string): T | null {
  const entry = cache.get(key)
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return entry.data as T
  }
  cache.delete(key)
  return null
}

function setCache(key: string, data: unknown) {
  cache.set(key, { data, timestamp: Date.now() })
}

// --- Yahoo Finance crumb/cookie auth ---
let _crumb = ''
let _cookie = ''
let _crumbExpiry = 0
const CRUMB_TTL = 30 * 60 * 1000 // 30 minutes

async function ensureCrumb(): Promise<boolean> {
  if (_crumb && _cookie && Date.now() < _crumbExpiry) return true

  try {
    // Step 1: Get cookie from fc.yahoo.com
    const res1 = await fetch('https://fc.yahoo.com/', {
      headers: { 'User-Agent': USER_AGENT },
      redirect: 'manual',
    })
    const setCookies = res1.headers.getSetCookie()
    _cookie = setCookies.map(c => c.split(';')[0]).join('; ')

    // Step 2: Get crumb using cookie
    const res2 = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', {
      headers: { 'User-Agent': USER_AGENT, 'Cookie': _cookie },
    })
    if (!res2.ok) {
      console.error('Failed to get crumb:', res2.status)
      return false
    }
    _crumb = await res2.text()
    _crumbExpiry = Date.now() + CRUMB_TTL
    return true
  } catch (err) {
    console.error('ensureCrumb error:', err)
    return false
  }
}

// --- Quote fetching via v7 API (with crumb) ---
async function fetchQuotesV7(symbols: string[]): Promise<any[]> {
  const hasCrumb = await ensureCrumb()
  if (!hasCrumb) return []

  const url = `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${symbols.join(',')}&crumb=${encodeURIComponent(_crumb)}`
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, 'Cookie': _cookie },
  })
  if (res.status === 401) {
    // Crumb expired, retry once
    _crumb = ''
    const retryOk = await ensureCrumb()
    if (!retryOk) return []
    const url2 = `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${symbols.join(',')}&crumb=${encodeURIComponent(_crumb)}`
    const res2 = await fetch(url2, {
      headers: { 'User-Agent': USER_AGENT, 'Cookie': _cookie },
    })
    if (!res2.ok) return []
    const data2 = await res2.json() as any
    return data2.quoteResponse?.result ?? []
  }
  if (!res.ok) return []
  const data = await res.json() as any
  return data.quoteResponse?.result ?? []
}

export async function getStockQuotes(symbols: string[]): Promise<QuoteResult[]> {
  const cacheKey = `quotes:${[...symbols].sort().join(',')}`
  const cached = getCached<QuoteResult[]>(cacheKey)
  if (cached) return cached

  const results: QuoteResult[] = []

  // v7 API supports batch queries; process in batches of 50
  const batchSize = 50
  for (let i = 0; i < symbols.length; i += batchSize) {
    const batch = symbols.slice(i, i + batchSize)
    try {
      const quotes = await fetchQuotesV7(batch)
      for (const q of quotes) {
        results.push({
          symbol: q.symbol ?? '',
          shortName: q.shortName || q.longName || q.symbol || '',
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
    } catch (err) {
      console.error('fetchQuotesV7 batch error:', err)
    }
  }

  setCache(cacheKey, results)
  return results
}

export async function getChartData(
  symbol: string,
  period: string = '1mo',
  interval: string = '1d'
): Promise<ChartPoint[]> {
  const cacheKey = `chart:${symbol}:${period}:${interval}`
  const cached = getCached<ChartPoint[]>(cacheKey)
  if (cached) return cached

  try {
    // Yahoo Finance API uses '5d' instead of '1w'
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

    const points: ChartPoint[] = []
    for (let i = 0; i < timestamps.length; i++) {
      const open = quote.open?.[i]
      const high = quote.high?.[i]
      const low = quote.low?.[i]
      const close = quote.close?.[i]
      const volume = quote.volume?.[i]

      // Skip entries with null values
      if (open == null || close == null) continue

      const isIntraday = interval.includes('m') && !interval.includes('mo')
      let timeStr: string | number
      if (isIntraday) {
        // Intraday: use Unix timestamp for lightweight-charts UTCTimestamp
        timeStr = timestamps[i]
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
