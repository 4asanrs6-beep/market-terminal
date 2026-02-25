export interface AIConfig {
  apiKey: string
  model: string  // default: 'claude-sonnet-4-20250514'
}

export interface MarketSummary {
  marketName: string
  totalCount: number
  advancers: number
  decliners: number
  avgChangePercent: number
  sectors: { name: string; avgChange: number; count: number }[]
  topGainers: { symbol: string; name: string; price: number; changePercent: number }[]
  topLosers: { symbol: string; name: string; price: number; changePercent: number }[]
  topVolume: { symbol: string; name: string; volume: number; changePercent: number }[]
  upcomingEarnings: { symbol: string; name: string; date: string }[]
}

export interface NewsItem {
  title: string
  publisher: string
  publishedAt: string
}

export interface AIStreamChunk {
  requestId: string
  text: string
}
