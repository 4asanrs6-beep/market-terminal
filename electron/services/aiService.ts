import { spawn } from 'child_process'

interface MarketSummary {
  marketName: string
  totalCount: number
  advancers: number
  decliners: number
  avgChangePercent: number
  avg5DayChangePercent?: number
  sectors: { name: string; avgChange: number; count: number }[]
  sectors5Day?: { name: string; avgChange: number; count: number }[]
  topGainers: { symbol: string; name: string; price: number; changePercent: number; fiveDayChange?: number }[]
  topLosers: { symbol: string; name: string; price: number; changePercent: number; fiveDayChange?: number }[]
  topVolume: { symbol: string; name: string; volume: number; changePercent: number }[]
  weeklyGainers?: { symbol: string; name: string; fiveDayChange: number }[]
  weeklyLosers?: { symbol: string; name: string; fiveDayChange: number }[]
  upcomingEarnings: { symbol: string; name: string; date: string }[]
}

// Cache with 1-hour TTL
const cache = new Map<string, { text: string; timestamp: number }>()
const CACHE_TTL = 60 * 60 * 1000

function getCachedCommentary(key: string): string | null {
  const entry = cache.get(key)
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return entry.text
  }
  if (entry) cache.delete(key)
  return null
}

function setCachedCommentary(key: string, text: string): void {
  cache.set(key, { text, timestamp: Date.now() })
}

function commentaryCacheKey(marketName: string, hasNews: boolean): string {
  return hasNews ? `${marketName}:with-news` : marketName
}

const SYSTEM_INSTRUCTION = `あなたはヘッジファンドのシニアマーケットアナリストです。
Bloomberg端末のユーザー向けに、マーケットブリーフィングを日本語で提供してください。

ルール:
- プロの金融アナリストの口調（簡潔・客観的）
- 箇条書きとセクション分けを活用
- 800-1200文字程度
- 投資推奨は行わない（分析と事実のみ）
- セクターローテーションや相場のテーマに言及
- マークダウン記法は使わない（プレーンテキストのみ）
- 【重要】当日の騰落だけでなく、5日間（週次）のトレンドも踏まえて分析すること
  - 当日と5日間で方向が異なる場合（例: 当日上昇だが5日間では下落）は特にその乖離に注目して言及
  - セクター間の週次のローテーション（資金の移動先・流出元）を分析すること
- 【重要】値動きの「なぜ」を必ず分析・説明すること
  - マクロ要因（金利動向、FRB政策、インフレ指標、地政学リスク等）
  - 個別要因（決算、ガイダンス、アナリスト格付変更、M&A、規制等）
  - テクニカル要因（出来高急増、サポート/レジスタンス、短期過熱感等）
  - ニュースが提供されている場合はそれを根拠に、ない場合は一般的な市場環境から推論すること
- 【重要】ニュースヘッドラインが提供された場合、必ず「報道によると〜」「〜と報じられている」等の形で具体的に引用し、値動きの背景を説明すること
- ニュースは英語原文で提供されるが、内容を日本語に訳して言及すること（原文をそのまま引用しない）
- ニュースがある銘柄は推測（「〜か」「〜とみられる」）ではなく、報道内容に基づき断定的に分析すること`

function buildPrompt(summary: MarketSummary, news?: Record<string, { title: string; publisher: string; publishedAt?: string }[]>): string {
  const date = new Date().toLocaleDateString('ja-JP', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    timeZone: 'America/New_York',
  })

  let msg = `${SYSTEM_INSTRUCTION}\n\n---\n\n`
  msg += `以下のマーケットデータに基づき、本日のマーケットブリーフを作成してください。\n`
  msg += `当日の値動きだけでなく、5日間のトレンドも踏まえて総合的に分析してください。\n\n`
  msg += `【${summary.marketName}】${date}\n`
  msg += `銘柄数: ${summary.totalCount} | 上昇: ${summary.advancers} | 下落: ${summary.decliners}\n`
  msg += `当日平均騰落率: ${summary.avgChangePercent.toFixed(2)}%`
  if (summary.avg5DayChangePercent != null) {
    msg += ` | 5日平均騰落率: ${summary.avg5DayChangePercent >= 0 ? '+' : ''}${summary.avg5DayChangePercent.toFixed(2)}%`
  }
  msg += '\n\n'

  msg += `【セクター別動向 (当日)】\n`
  for (const s of summary.sectors) {
    const sign = s.avgChange >= 0 ? '+' : ''
    msg += `${s.name}: ${sign}${s.avgChange.toFixed(2)}% (${s.count}銘柄)\n`
  }

  if (summary.sectors5Day && summary.sectors5Day.length > 0) {
    msg += `\n【セクター別動向 (5日間)】\n`
    for (const s of summary.sectors5Day) {
      const sign = s.avgChange >= 0 ? '+' : ''
      msg += `${s.name}: ${sign}${s.avgChange.toFixed(2)}% (${s.count}銘柄)\n`
    }
  }

  msg += `\n【当日 上昇率上位】\n`
  for (let i = 0; i < summary.topGainers.length; i++) {
    const g = summary.topGainers[i]
    let line = `${i + 1}. ${g.symbol} +${g.changePercent.toFixed(2)}% ($${g.price.toFixed(2)}) - ${g.name}`
    if (g.fiveDayChange != null) {
      line += ` [5日: ${g.fiveDayChange >= 0 ? '+' : ''}${g.fiveDayChange.toFixed(2)}%]`
    }
    msg += line + '\n'
  }

  msg += `\n【当日 下落率上位】\n`
  for (let i = 0; i < summary.topLosers.length; i++) {
    const l = summary.topLosers[i]
    let line = `${i + 1}. ${l.symbol} ${l.changePercent.toFixed(2)}% ($${l.price.toFixed(2)}) - ${l.name}`
    if (l.fiveDayChange != null) {
      line += ` [5日: ${l.fiveDayChange >= 0 ? '+' : ''}${l.fiveDayChange.toFixed(2)}%]`
    }
    msg += line + '\n'
  }

  if (summary.weeklyGainers && summary.weeklyGainers.length > 0) {
    msg += `\n【5日間 上昇率上位】\n`
    for (let i = 0; i < Math.min(summary.weeklyGainers.length, 10); i++) {
      const g = summary.weeklyGainers[i]
      msg += `${i + 1}. ${g.symbol} +${g.fiveDayChange.toFixed(2)}% - ${g.name}\n`
    }
  }

  if (summary.weeklyLosers && summary.weeklyLosers.length > 0) {
    msg += `\n【5日間 下落率上位】\n`
    for (let i = 0; i < Math.min(summary.weeklyLosers.length, 10); i++) {
      const l = summary.weeklyLosers[i]
      msg += `${i + 1}. ${l.symbol} ${l.fiveDayChange.toFixed(2)}% - ${l.name}\n`
    }
  }

  msg += `\n【出来高上位】\n`
  for (let i = 0; i < summary.topVolume.length; i++) {
    const v = summary.topVolume[i]
    const sign = v.changePercent >= 0 ? '+' : ''
    msg += `${i + 1}. ${v.symbol} ${sign}${v.changePercent.toFixed(2)}% (出来高: ${(v.volume / 1e6).toFixed(1)}M) - ${v.name}\n`
  }

  if (summary.upcomingEarnings.length > 0) {
    msg += `\n【今週の決算予定】\n`
    msg += summary.upcomingEarnings.map(e => `${e.symbol} (${e.date})`).join(', ')
    msg += '\n'
  }

  if (news) {
    const entries = Object.entries(news).filter(([, items]) => items.length > 0)
    if (entries.length > 0) {
      msg += `\n【主要銘柄ニュース（英語原文）】\n`
      for (const [symbol, items] of entries) {
        msg += `${symbol}:\n`
        for (const item of items) {
          const date = item.publishedAt ? `, ${item.publishedAt}` : ''
          msg += `- "${item.title}" (${item.publisher}${date})\n`
        }
      }
    }
  }

  return msg
}

export async function* generateMarketCommentary(
  summary: MarketSummary,
  news?: Record<string, { title: string; publisher: string; publishedAt?: string }[]>
): AsyncGenerator<string> {
  // Check cache first
  const hasNews = !!news && Object.values(news).some(items => items.length > 0)
  const cacheKey = commentaryCacheKey(summary.marketName, hasNews)
  const cached = getCachedCommentary(cacheKey)
  if (cached) {
    yield cached
    return
  }

  const prompt = buildPrompt(summary, news)

  const env = { ...process.env }
  delete env.CLAUDECODE

  const proc = spawn('claude', ['-p'], {
    shell: true,
    stdio: ['pipe', 'pipe', 'pipe'],
    env,
  })

  proc.stdin.write(prompt)
  proc.stdin.end()

  let fullText = ''
  let stderrText = ''

  proc.stderr.on('data', (chunk: Buffer) => {
    stderrText += chunk.toString()
  })

  for await (const chunk of proc.stdout) {
    const text = chunk.toString()
    fullText += text
    yield text
  }

  const exitCode = await new Promise<number | null>((resolve) => {
    proc.on('close', resolve)
  })

  if (exitCode !== 0) {
    throw new Error(stderrText || `claude exited with code ${exitCode}`)
  }

  if (fullText) {
    setCachedCommentary(cacheKey, fullText)
  }
}
