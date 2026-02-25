import { ensureCrumb, getCrumb, getCookie, USER_AGENT, getCached, setCache, sleep } from './marketData'

export interface NewsItem {
  title: string
  publisher: string
  publishedAt: string
}

export async function fetchNewsForSymbols(
  symbols: string[]
): Promise<Record<string, NewsItem[]>> {
  const cacheKey = `news:${[...symbols].sort().join(',')}`
  const cached = getCached<Record<string, NewsItem[]>>(cacheKey)
  if (cached) return cached

  const result: Record<string, NewsItem[]> = {}
  const concurrency = 5

  for (let i = 0; i < symbols.length; i += concurrency) {
    const batch = symbols.slice(i, i + concurrency)
    const settled = await Promise.allSettled(
      batch.map(s => fetchNewsForSymbol(s))
    )
    for (let j = 0; j < batch.length; j++) {
      const r = settled[j]
      result[batch[j]] = r.status === 'fulfilled' ? r.value : []
    }
    if (i + concurrency < symbols.length) {
      await sleep(300)
    }
  }

  console.log(`fetchNewsForSymbols: fetched news for ${symbols.length} symbols`)
  setCache(cacheKey, result)
  return result
}

async function fetchNewsForSymbol(symbol: string): Promise<NewsItem[]> {
  try {
    const hasCrumb = await ensureCrumb()
    if (!hasCrumb) return []

    const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(symbol)}&newsCount=5&quotesCount=0&crumb=${encodeURIComponent(getCrumb())}`
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, 'Cookie': getCookie() },
    })
    if (!res.ok) {
      console.warn(`fetchNewsForSymbol(${symbol}): ${res.status}`)
      return []
    }

    const data = await res.json() as any
    const news: any[] = data.news ?? []

    return news.map((item: any) => ({
      title: item.title ?? '',
      publisher: item.publisher ?? '',
      publishedAt: item.providerPublishTime
        ? formatDate(item.providerPublishTime)
        : '',
    }))
  } catch (err) {
    console.error(`fetchNewsForSymbol(${symbol}) error:`, err)
    return []
  }
}

function formatDate(unixTimestamp: number): string {
  const d = new Date(unixTimestamp * 1000)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${mm}/${dd}`
}
