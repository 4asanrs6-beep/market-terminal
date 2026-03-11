import { useState, useCallback, useMemo } from 'react'
import type { MarketIndex } from './types/stock'
import { useMarketData, useWatchlists } from './hooks/useMarketData'
import { Header } from './components/Header'
import { MarketTabs } from './components/MarketTabs'
import { StockTable, type ViewMode } from './components/StockTable'
import { SectorHeatmap } from './components/SectorHeatmap'
import { AddTickerModal } from './components/AddTickerModal'
import { AddFuturesModal } from './components/AddFuturesModal'
import { AIMarketPanel } from './components/AIMarketPanel'
import styles from './styles/App.module.css'

export default function App() {
  const [activeMarket, setActiveMarket] = useState<MarketIndex>('sp500')
  const [searchQuery, setSearchQuery] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showAddFuturesModal, setShowAddFuturesModal] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('table')
  const [showAIPanel, setShowAIPanel] = useState(false)

  const {
    watchlists,
    createWatchlist,
    renameWatchlist,
    deleteWatchlist,
    addToWatchlist,
    addTickersToWatchlist,
    removeFromWatchlist,
    exportWatchlists,
    importWatchlists,
  } = useWatchlists()

  const { quotes, loading, deferredLoading, refresh, reload, allWatchlistSymbols } = useMarketData(activeMarket, watchlists)

  const handleSelectStock = useCallback((symbol: string) => {
    window.electronAPI.openChartWindow(symbol)
  }, [])

  const handleAddTickers = useCallback(async (tickers: string[], listId: string) => {
    await addTickersToWatchlist(listId, tickers)
    // Switch to that watchlist so user can see the added tickers
    setActiveMarket(`watchlist:${listId}`)
  }, [addTickersToWatchlist])

  const handleDeleteWatchlist = useCallback((id: string) => {
    deleteWatchlist(id)
    // If the deleted list was active, switch to sp500
    if (activeMarket === `watchlist:${id}`) {
      setActiveMarket('sp500')
    }
  }, [activeMarket, deleteWatchlist])

  const isFuturesMarket = activeMarket === 'futures'

  const handleAddButtonClick = useCallback(() => {
    if (isFuturesMarket) {
      setShowAddFuturesModal(true)
    } else {
      setShowAddModal(true)
    }
  }, [isFuturesMarket])

  const handleAddToFutures = useCallback(async (entry: { symbol: string; name: string; sector: string }) => {
    await window.electronAPI.addToFutures(entry)
    await window.electronAPI.clearCache()
    reload()
  }, [reload])

  const handleRemoveFromFutures = useCallback(async (symbol: string) => {
    await window.electronAPI.removeFromFutures(symbol)
    await window.electronAPI.clearCache()
    reload()
  }, [reload])

  const futuresSymbolSet = useMemo(() => {
    if (!isFuturesMarket) return new Set<string>()
    return new Set(quotes.map(q => q.symbol))
  }, [isFuturesMarket, quotes])

  const handleToggleAI = useCallback(() => {
    setShowAIPanel(prev => !prev)
  }, [])

  return (
    <div className={`${styles.app} ${showAIPanel ? styles.withAI : ''}`}>
      <div className={styles.header}>
        <Header
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          aiActive={showAIPanel}
          onToggleAI={handleToggleAI}
        />
      </div>

      <div className={styles.sidebar}>
        <MarketTabs
          activeMarket={activeMarket}
          onMarketChange={setActiveMarket}
          onAddTicker={handleAddButtonClick}
          watchlists={watchlists}
          onCreateWatchlist={createWatchlist}
          onRenameWatchlist={renameWatchlist}
          onDeleteWatchlist={handleDeleteWatchlist}
          onExportWatchlists={exportWatchlists}
          onImportWatchlists={importWatchlists}
        />
      </div>

      <div className={styles.main}>
        <div className={styles.tableSection}>
          {viewMode === 'heatmap' ? (
            <SectorHeatmap
              quotes={quotes}
              loading={loading}
              onSelectStock={handleSelectStock}
              onRefresh={refresh}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
            />
          ) : (
            <StockTable
              quotes={quotes}
              loading={loading}
              deferredLoading={deferredLoading}
              searchQuery={searchQuery}
              selectedSymbol={null}
              onSelectStock={handleSelectStock}
              onRefresh={refresh}
              watchlist={activeMarket.startsWith('watchlist:') ? [] : allWatchlistSymbols()}
              watchlists={watchlists}
              onAddToWatchlist={addToWatchlist}
              onRemoveFromWatchlist={removeFromWatchlist}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              isFuturesMarket={isFuturesMarket}
              onRemoveFromFutures={handleRemoveFromFutures}
            />
          )}
        </div>
      </div>

      {showAIPanel && (
        <div className={styles.aiPanel}>
          <AIMarketPanel
            quotes={quotes}
            activeMarket={activeMarket}
            onClose={() => setShowAIPanel(false)}
          />
        </div>
      )}

      <AddTickerModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAddTickers}
        watchlists={watchlists}
        activeListId={activeMarket.startsWith('watchlist:') ? activeMarket.slice('watchlist:'.length) : null}
      />

      <AddFuturesModal
        isOpen={showAddFuturesModal}
        onClose={() => setShowAddFuturesModal(false)}
        onAdd={handleAddToFutures}
        existingSymbols={futuresSymbolSet}
      />
    </div>
  )
}
