import { useState, useCallback } from 'react'
import type { MarketIndex } from './types/stock'
import { useMarketData, useWatchlists } from './hooks/useMarketData'
import { Header } from './components/Header'
import { MarketTabs } from './components/MarketTabs'
import { StockTable, type ViewMode } from './components/StockTable'
import { SectorHeatmap } from './components/SectorHeatmap'
import { AddTickerModal } from './components/AddTickerModal'
import { AIMarketPanel } from './components/AIMarketPanel'
import styles from './styles/App.module.css'

export default function App() {
  const [activeMarket, setActiveMarket] = useState<MarketIndex>('sp500')
  const [searchQuery, setSearchQuery] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('table')
  const [showAIPanel, setShowAIPanel] = useState(false)

  const {
    watchlists,
    createWatchlist,
    renameWatchlist,
    deleteWatchlist,
    addToWatchlist,
    removeFromWatchlist,
  } = useWatchlists()

  const { quotes, loading, refresh, allWatchlistSymbols, sparklines } = useMarketData(activeMarket, watchlists)

  const handleSelectStock = useCallback((symbol: string) => {
    window.electronAPI.openChartWindow(symbol)
  }, [])

  const handleAddTicker = useCallback(async (ticker: string, listId: string) => {
    await addToWatchlist(listId, ticker)
    // Switch to that watchlist so user can see the added ticker
    setActiveMarket(`watchlist:${listId}`)
  }, [addToWatchlist])

  const handleDeleteWatchlist = useCallback((id: string) => {
    deleteWatchlist(id)
    // If the deleted list was active, switch to sp500
    if (activeMarket === `watchlist:${id}`) {
      setActiveMarket('sp500')
    }
  }, [activeMarket, deleteWatchlist])

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
          onAddTicker={() => setShowAddModal(true)}
          watchlists={watchlists}
          onCreateWatchlist={createWatchlist}
          onRenameWatchlist={renameWatchlist}
          onDeleteWatchlist={handleDeleteWatchlist}
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
              searchQuery={searchQuery}
              selectedSymbol={null}
              onSelectStock={handleSelectStock}
              onRefresh={refresh}
              watchlist={activeMarket.startsWith('watchlist:') ? allWatchlistSymbols() : []}
              watchlists={watchlists}
              onAddToWatchlist={addToWatchlist}
              onRemoveFromWatchlist={removeFromWatchlist}
              sparklines={sparklines}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
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
        onAdd={handleAddTicker}
        watchlists={watchlists}
        activeListId={activeMarket.startsWith('watchlist:') ? activeMarket.slice('watchlist:'.length) : null}
      />
    </div>
  )
}
