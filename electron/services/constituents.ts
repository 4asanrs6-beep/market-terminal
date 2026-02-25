export type MarketIndex = 'sp500' | 'nasdaq100'

export interface ConstituentInfo {
  symbol: string
  name: string
  sector: string
}

// GICS Sector mapping for S&P 500 & NASDAQ 100 constituents
// Grouped by sector for maintainability
const SECTOR_MAP: Record<string, string[]> = {
  'Technology': [
    'AAPL','ACN','ADBE','ADI','ADP','ADSK','AMAT','AMD','ANET','ANSS','APH',
    'AVGO','CDNS','CDW','CPAY','CRM','CRWD','CSCO','CTSH','DELL','ENPH',
    'EPAM','FFIV','FICO','FIS','FISV','FSLR','FTNT','GEN','GLW','GPN',
    'GRMN','HPE','HPQ','IBM','INTC','INTU','IT','JKHY','KEYS','KLAC',
    'LRCX','MCHP','MPWR','MRVL','MSFT','MSI','MU','NOW','NTAP','NVDA',
    'NXPI','ON','ORCL','PANW','PLTR','PTC','PYPL','QCOM','QRVO','ROP',
    'SMCI','SNPS','STX','SWKS','TDY','TEL','TER','TRMB','TXN','TYL',
    'VRSN','WDC','ZBRA',
    // NASDAQ-only
    'APP','ARM','ASML','COIN','DDOG','GFS','MDB','MSTR','TEAM','TTD','ZS',
  ],
  'Health Care': [
    'A','ABBV','ABT','ALGN','AMGN','BAX','BDX','BIIB','BIO','BMY','BSX',
    'CAH','CNC','COO','COR','CRL','CTVA','CVS','DXCM','EW','GEHC','GILD',
    'HCA','HOLX','HSIC','HUM','IDXX','ILMN','INCY','IQV','ISRG','JNJ',
    'LH','LLY','MCK','MDT','MET','MOH','MRK','MRNA','MTD','PODD','PFE',
    'REGN','RVTY','STE','SYK','TECH','TMO','UHS','UNH','VRTX','VTRS',
    'WAT','WST','ZBH','ZTS',
    // NASDAQ-only
    'AZN','MELI',
  ],
  'Financials': [
    'ACGL','AFL','AIG','AIZ','AJG','ALL','AMP','AON','APO','AXP','BAC',
    'BEN','BK','BKR','BLK','BRK-B','BRO','BX','C','CB','CBOE','CFG',
    'CINF','CMA','CME','COF','DFS','ERIE','FDS','FI','FICO','FITB',
    'FRT','GL','GS','HBAN','ICE','INVH','IVZ','JPM','KEY','KIM','KKR',
    'L','MA','MCO','MKTX','MMC','MS','MSCI','MTB','NDAQ','NTRS','PFG',
    'PNC','PRU','PSA','REG','RF','RJF','SBAC','SCHW','SPGI','STT',
    'SYF','TFC','TROW','TRV','USB','V','VICI','WFC','WRB','WTW',
  ],
  'Consumer Discretionary': [
    'ABNB','AMZN','APTV','AZO','BBWI','BBY','BKNG','BWA','CCL','CHD',
    'CMG','CZR','DAY','DG','DHI','DIS','DLTR','DPZ','DRI','EBAY','EXPE',
    'F','GOOG','GOOGL','GPC','GM','GNRC','GWW','HAS','HD','LEN','LKQ',
    'LOW','LULU','LVS','MAR','MCD','MGM','MHK','MTCH','NCLH','NKE',
    'NVR','ORLY','PARA','PHM','POOL','PVH','RCL','RL','ROST','SBUX',
    'TGT','TJX','TPR','TSCO','TSLA','TTWO','ULTA','VFC','WDAY','WYNN','YUM',
    // NASDAQ-only
    'DASH','PDD',
  ],
  'Communication Services': [
    'CHTR','CMCSA','DIS','EA','FOX','FOXA','GOOG','GOOGL','IPG','LYV',
    'META','MTCH','NFLX','NWS','NWSA','OMC','PARA','T','TMUS','TTWO',
    'VZ','WBD',
  ],
  'Industrials': [
    'AOS','AXON','BA','BLDR','CAT','CHRW','CMI','CPRT','CSX','CTAS',
    'DAL','DE','DOV','EMR','ETN','FAST','FDX','FTV','GD','GE','GEV',
    'GWW','HII','HON','HWM','IR','ITW','J','JBHT','JBL','JCI','LDOS',
    'LHX','LMT','MAS','MLM','MMM','NDSN','NOC','NSC','ODFL','OTIS',
    'PCAR','PH','PNR','PWR','ROK','ROL','RSG','RTX','SNA','SWK','SW',
    'TDG','TT','TXT','UAL','UBER','UNP','UPS','URI','VRSK','WAB','WM',
    'XYL',
  ],
  'Consumer Staples': [
    'ADM','BF-B','BG','CAG','CHD','CL','CLX','COST','CPB','DG','EL',
    'GIS','HRL','HSY','K','KDP','KHC','KMB','KO','KR','KVUE','LW',
    'MDLZ','MKC','MNST','MO','PEP','PG','PM','SJM','STZ','SYY','TAP',
    'TGT','TSN','WBA','WMT',
  ],
  'Energy': [
    'APA','BKR','COP','CTRA','CVX','DVN','EOG','EQT','FANG','HAL',
    'HES','KMI','LNG','MPC','MRO','OKE','OXY','PSX','SLB','TRGP',
    'VLO','WMB','XOM',
  ],
  'Utilities': [
    'AEE','AEP','AES','ATO','AWK','CEG','CMS','CNP','D','DTE','DUK',
    'ED','EIX','ES','ETR','EVRG','EXC','FE','NEE','NI','NRG','PCG',
    'PEG','PNW','PPL','SO','SRE','VST','WEC','XEL',
  ],
  'Real Estate': [
    'AMT','ARE','AVB','BXP','CCI','CPT','CSGP','DLR','EQIX','EQR',
    'ESS','EXR','FRT','HST','INVH','IRM','KIM','MAA','O','PLD','PSA',
    'REG','SBAC','SPG','UDR','VICI','VTR','WELL','WY',
  ],
  'Materials': [
    'AMCR','APD','AVY','BG','CE','CF','DD','DOW','ECL','EMN','FCX',
    'FMC','IFF','IP','LIN','LYB','MLM','MOS','NEM','NUE','PKG','PPG',
    'SEE','SHW','STLD','VMC','WRK',
  ],
}

// Build reverse lookup: symbol -> sector
const _symbolSectorMap: Record<string, string> = {}
for (const [sector, symbols] of Object.entries(SECTOR_MAP)) {
  for (const sym of symbols) {
    // First assignment wins (some symbols appear in multiple sectors due to reclassification)
    if (!_symbolSectorMap[sym]) {
      _symbolSectorMap[sym] = sector
    }
  }
}

export function getSectorForSymbol(symbol: string): string {
  return _symbolSectorMap[symbol] || ''
}

export function getSectorsForSymbols(symbols: string[]): Record<string, string> {
  const result: Record<string, string> = {}
  for (const sym of symbols) {
    const sector = _symbolSectorMap[sym]
    if (sector) result[sym] = sector
  }
  return result
}

// Full S&P 500 constituents (~503 tickers, as of early 2025)
const SP500_SYMBOLS: string[] = [
  'A','AAL','AAPL','ABBV','ABNB','ABT','ACGL','ACN','ADBE','ADI',
  'ADM','ADP','ADSK','AEE','AEP','AES','AFL','AIG','AIZ','AJG',
  'ALL','ALLE','AMAT','AMCR','AMD','AME','AMGN','AMP','AMT','AMZN',
  'ANET','ANSS','AON','AOS','APA','APD','APH','APO','APTV','ARE',
  'ATO','AVGO','AVB','AVY','AWK','AXON','AXP','AZO',
  'BA','BAC','BAX','BBWI','BBY','BDX','BEN','BF-B','BG','BIIB',
  'BIO','BK','BKNG','BKR','BLDR','BLK','BMY','BR','BRK-B','BRO',
  'BSX','BWA','BX','BXP',
  'C','CAG','CAH','CARR','CAT','CB','CBOE','CBRE','CCI','CCL',
  'CDNS','CDW','CE','CEG','CF','CFG','CHD','CHRW','CHTR','CI',
  'CINF','CL','CLX','CMA','CMCSA','CME','CMG','CMI','CMS','CNC',
  'CNP','COF','COO','COP','COR','COST','CPAY','CPB','CPRT','CPT',
  'CRL','CRM','CRWD','CSCO','CSGP','CSX','CTAS','CTRA','CTSH',
  'CTVA','CVS','CVX','CZR',
  'D','DAL','DAY','DD','DE','DECK','DELL','DFS','DG','DGX','DHI',
  'DHR','DIS','DLTR','DOV','DOW','DPZ','DRI','DTE','DUK','DVA',
  'DVN','DXCM',
  'EA','EBAY','ECL','ED','EFX','EIX','EL','EMN','EMR','ENPH',
  'EOG','EPAM','EQIX','EQR','EQT','ERIE','ES','ESS','ETN','ETR',
  'EVRG','EW','EXC','EXPD','EXPE','EXR',
  'F','FANG','FAST','FBHS','FCX','FDS','FDX','FE','FFIV','FI',
  'FICO','FIS','FISV','FITB','FMC','FOX','FOXA','FRT','FSLR',
  'FTNT','FTV',
  'GD','GDDY','GE','GEHC','GEN','GEV','GILD','GIS','GL','GLW',
  'GM','GNRC','GOOG','GOOGL','GPC','GPN','GRMN','GS','GWW',
  'HAL','HAS','HBAN','HCA','HD','HOLX','HON','HPE','HPQ','HRL',
  'HSIC','HST','HSY','HUBB','HUM','HWM',
  'IBM','ICE','IDXX','IEX','IFF','ILMN','INCY','INTC','INTU',
  'INVH','IP','IPG','IQV','IR','IRM','ISRG','IT','ITW','IVZ',
  'J','JBHT','JBL','JCI','JKHY','JNJ','JNPR','JPM',
  'K','KDP','KEY','KEYS','KHC','KIM','KKR','KLAC','KMB','KMI',
  'KMX','KO','KR','KVUE',
  'L','LDOS','LEN','LH','LHX','LIN','LKQ','LLY','LNG','LRCX',
  'LULU','LUV','LVS','LW','LYB','LYV',
  'MA','MAA','MAR','MAS','MCD','MCHP','MCK','MCO','MDLZ','MDT',
  'MET','META','MGM','MHK','MKC','MKTX','MLM','MMC','MMM','MNST',
  'MO','MOH','MOS','MPC','MPWR','MRK','MRNA','MRVL','MS','MSCI',
  'MSFT','MSI','MTB','MTCH','MTD','MU',
  'NCLH','NDAQ','NDSN','NEE','NEM','NFLX','NI','NKE','NOC','NOW',
  'NRG','NSC','NTAP','NTRS','NUE','NVDA','NVR','NWS','NWSA','NXPI',
  'O','ODFL','OKE','OMC','ON','ORCL','ORLY','OTIS','OXY',
  'PANW','PARA','PAYC','PAYX','PCAR','PCG','PEG','PEP','PFE','PFG',
  'PG','PGR','PH','PHM','PKG','PLD','PLTR','PM','PNC','PNR','PNW',
  'PODD','POOL','PPG','PPL','PRU','PSA','PSX','PTC','PVH','PWR',
  'PYPL',
  'QCOM','QRVO',
  'RCL','REG','REGN','RF','RJF','RL','RMD','ROK','ROL','ROP',
  'ROST','RSG','RTX','RVTY',
  'SBAC','SBUX','SCHW','SEE','SHW','SJM','SLB','SMCI','SNA',
  'SNPS','SO','SOLV','SPG','SPGI','SRE','STE','STLD','STT','STX',
  'STZ','SW','SWK','SWKS','SYF','SYK','SYY',
  'T','TAP','TDG','TDY','TECH','TEL','TER','TFC','TFX','TGT',
  'TJX','TMO','TMUS','TPL','TPR','TRGP','TRMB','TROW','TRV','TSCO',
  'TSLA','TSN','TT','TTWO','TXN','TXT','TYL',
  'UAL','UBER','UDR','UHS','ULTA','UNH','UNP','UPS','URI','USB',
  'V','VICI','VLO','VLTO','VMC','VRSK','VRSN','VRTX','VST','VTR',
  'VTRS','VZ',
  'WAB','WAT','WBA','WBD','WDC','WDAY','WEC','WELL','WFC','WM',
  'WMB','WMT','WRB','WRK','WST','WTW','WY','WYNN',
  'XEL','XOM','XYL',
  'YUM',
  'ZBH','ZBRA','ZTS',
]

// Full NASDAQ 100 constituents (~101 tickers, as of early 2025)
const NASDAQ100_SYMBOLS: string[] = [
  'AAPL','ABNB','ADBE','ADI','ADP','ADSK','AEP','AMAT','AMGN','AMZN',
  'ANSS','APP','ARM','ASML','AVGO','AZN',
  'BIIB','BKNG','BKR',
  'CDNS','CDW','CEG','CHTR','CMCSA','COIN','COST','CPRT','CRWD','CSCO',
  'CSGP','CTAS','CTSH',
  'DASH','DDOG','DLTR','DXCM',
  'EA','EXC',
  'FANG','FAST','FTNT',
  'GEHC','GFS','GILD','GOOG','GOOGL',
  'HON',
  'IDXX','ILMN','INTC','INTU','ISRG',
  'KDP','KHC','KLAC',
  'LIN','LRCX','LULU',
  'MAR','MCHP','MDB','MDLZ','MELI','META','MNST','MRNA','MRVL','MSFT',
  'MSTR','MU',
  'NFLX','NVDA','NXPI',
  'ODFL','ON','ORLY',
  'PANW','PAYX','PCAR','PDD','PEP','PLTR','PYPL',
  'QCOM',
  'REGN','ROST','ROP',
  'SBUX','SMCI','SNPS',
  'TEAM','TMUS','TSLA','TTD','TTWO','TXN',
  'VRSK','VRTX',
  'WBD','WDAY',
  'XEL',
  'ZS',
]

function symbolsToConstituents(symbols: string[]): ConstituentInfo[] {
  return symbols.map(symbol => ({
    symbol,
    name: symbol,
    sector: _symbolSectorMap[symbol] || '',
  }))
}

export function getConstituents(market: MarketIndex): ConstituentInfo[] {
  switch (market) {
    case 'sp500':
      return symbolsToConstituents(SP500_SYMBOLS)
    case 'nasdaq100':
      return symbolsToConstituents(NASDAQ100_SYMBOLS)
    default:
      return []
  }
}
