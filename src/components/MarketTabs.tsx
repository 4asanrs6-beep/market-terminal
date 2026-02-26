import { useState, useCallback, useRef, useEffect } from 'react'
import type { MarketIndex, WatchlistInfo } from '../types/stock'

interface MarketTabsProps {
  activeMarket: MarketIndex
  onMarketChange: (market: MarketIndex) => void
  onAddTicker: () => void
  watchlists: WatchlistInfo[]
  onCreateWatchlist: (name: string) => void
  onRenameWatchlist: (id: string, name: string) => void
  onDeleteWatchlist: (id: string) => void
  onExportWatchlists: () => Promise<boolean>
  onImportWatchlists: () => Promise<any>
}

const tabStyle = {
  base: {
    display: 'block',
    width: '100%',
    padding: '10px 16px',
    textAlign: 'left' as const,
    fontSize: '12px',
    fontWeight: 600,
    letterSpacing: '0.5px',
    border: 'none',
    borderLeft: '3px solid transparent',
    cursor: 'pointer',
    transition: 'all 0.15s',
    fontFamily: 'inherit',
  },
  inactive: {
    background: 'transparent',
    color: 'var(--text-secondary)',
  },
  active: {
    background: 'var(--bg-active)',
    color: 'var(--accent-orange)',
    borderLeftColor: 'var(--accent-orange)',
  },
}

const fixedTabs: { id: MarketIndex; label: string; sub: string }[] = [
  { id: 'sp500', label: 'S&P 500', sub: '全構成銘柄' },
  { id: 'nasdaq100', label: 'NASDAQ 100', sub: '全構成銘柄' },
]

interface CtxMenu {
  x: number
  y: number
  listId: string
  listName: string
}

export function MarketTabs({
  activeMarket,
  onMarketChange,
  onAddTicker,
  watchlists,
  onCreateWatchlist,
  onRenameWatchlist,
  onDeleteWatchlist,
  onExportWatchlists,
  onImportWatchlists,
}: MarketTabsProps) {
  const [contextMenu, setContextMenu] = useState<CtxMenu | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [creating, setCreating] = useState(false)
  const [newListName, setNewListName] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null)
  const createInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (creating && createInputRef.current) {
      createInputRef.current.focus()
    }
  }, [creating])

  const handleCreateList = useCallback(() => {
    setCreating(true)
    setNewListName('')
  }, [])

  const handleFinishCreate = useCallback(() => {
    if (newListName.trim()) {
      onCreateWatchlist(newListName.trim())
    }
    setCreating(false)
    setNewListName('')
  }, [newListName, onCreateWatchlist])

  const handleContextMenu = useCallback((e: React.MouseEvent, list: WatchlistInfo) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, listId: list.id, listName: list.name })
  }, [])

  const handleStartRename = useCallback(() => {
    if (!contextMenu) return
    setEditingId(contextMenu.listId)
    setEditName(contextMenu.listName)
    setContextMenu(null)
  }, [contextMenu])

  const handleFinishRename = useCallback(() => {
    if (editingId && editName.trim()) {
      onRenameWatchlist(editingId, editName.trim())
    }
    setEditingId(null)
    setEditName('')
  }, [editingId, editName, onRenameWatchlist])

  const handleDelete = useCallback(() => {
    if (!contextMenu) return
    setConfirmDelete({ id: contextMenu.listId, name: contextMenu.listName })
    setContextMenu(null)
  }, [contextMenu])

  const handleConfirmDelete = useCallback(() => {
    if (confirmDelete) {
      onDeleteWatchlist(confirmDelete.id)
    }
    setConfirmDelete(null)
  }, [confirmDelete, onDeleteWatchlist])

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
      onClick={() => setContextMenu(null)}
    >
      <div style={{
        padding: '12px 16px 8px',
        fontSize: '9px',
        fontWeight: 700,
        letterSpacing: '1.5px',
        color: 'var(--text-muted)',
        textTransform: 'uppercase',
      }}>
        マーケット
      </div>

      {fixedTabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onMarketChange(tab.id)}
          style={{
            ...tabStyle.base,
            ...(activeMarket === tab.id ? tabStyle.active : tabStyle.inactive),
          }}
          onMouseEnter={(e) => {
            if (activeMarket !== tab.id) {
              e.currentTarget.style.background = 'var(--bg-hover)'
              e.currentTarget.style.color = 'var(--text-primary)'
            }
          }}
          onMouseLeave={(e) => {
            if (activeMarket !== tab.id) {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = 'var(--text-secondary)'
            }
          }}
        >
          <div>{tab.label}</div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
            {tab.sub}
          </div>
        </button>
      ))}

      {/* Watchlists section */}
      <div style={{
        padding: '12px 16px 4px',
        fontSize: '9px',
        fontWeight: 700,
        letterSpacing: '1.5px',
        color: 'var(--text-muted)',
        textTransform: 'uppercase',
        marginTop: '4px',
        borderTop: '1px solid var(--border-color)',
      }}>
        リスト
      </div>

      {watchlists.map((list) => {
        const marketId = `watchlist:${list.id}`
        const isActive = activeMarket === marketId
        const isEditing = editingId === list.id

        return (
          <button
            key={list.id}
            onClick={() => onMarketChange(marketId)}
            onContextMenu={(e) => handleContextMenu(e, list)}
            style={{
              ...tabStyle.base,
              padding: '7px 16px',
              ...(isActive ? tabStyle.active : tabStyle.inactive),
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.background = 'var(--bg-hover)'
                e.currentTarget.style.color = 'var(--text-primary)'
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = 'var(--text-secondary)'
              }
            }}
          >
            {isEditing ? (
              <input
                type="text"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                onBlur={handleFinishRename}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleFinishRename()
                  if (e.key === 'Escape') { setEditingId(null); setEditName('') }
                }}
                autoFocus
                onClick={e => e.stopPropagation()}
                style={{
                  width: '100%',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--accent-orange)',
                  borderRadius: '2px',
                  color: 'var(--text-primary)',
                  fontSize: '12px',
                  padding: '2px 4px',
                  fontFamily: 'inherit',
                }}
              />
            ) : (
              <>
                <div>{list.name}</div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '1px' }}>
                  {list.symbols.length} 銘柄
                </div>
              </>
            )}
          </button>
        )
      })}

      <div style={{ padding: '6px 12px' }}>
        {creating ? (
          <input
            ref={createInputRef}
            type="text"
            value={newListName}
            onChange={e => setNewListName(e.target.value)}
            onBlur={handleFinishCreate}
            onKeyDown={e => {
              if (e.key === 'Enter') handleFinishCreate()
              if (e.key === 'Escape') { setCreating(false); setNewListName('') }
            }}
            placeholder="リスト名"
            style={{
              width: '100%',
              padding: '5px 8px',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--accent-orange)',
              borderRadius: '3px',
              color: 'var(--text-primary)',
              fontSize: '11px',
              fontFamily: 'inherit',
              boxSizing: 'border-box',
            }}
          />
        ) : (
          <button
            onClick={handleCreateList}
            style={{
              width: '100%',
              padding: '6px',
              background: 'transparent',
              border: '1px dashed var(--border-light)',
              borderRadius: '3px',
              color: 'var(--text-muted)',
              fontSize: '10px',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--accent-orange)'
              e.currentTarget.style.color = 'var(--accent-orange)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-light)'
              e.currentTarget.style.color = 'var(--text-muted)'
            }}
          >
            + リスト作成
          </button>
        )}
      </div>

      <div style={{ flex: 1 }} />

      <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <button
          onClick={onAddTicker}
          style={{
            width: '100%',
            padding: '8px',
            background: 'var(--bg-tertiary)',
            border: '1px dashed var(--border-light)',
            borderRadius: '4px',
            color: 'var(--text-secondary)',
            fontSize: '11px',
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--accent-orange)'
            e.currentTarget.style.color = 'var(--accent-orange)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-light)'
            e.currentTarget.style.color = 'var(--text-secondary)'
          }}
        >
          + 銘柄を追加
        </button>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            onClick={onExportWatchlists}
            style={{
              flex: 1,
              padding: '6px',
              background: 'transparent',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              color: 'var(--text-muted)',
              fontSize: '10px',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--accent-orange)'
              e.currentTarget.style.color = 'var(--accent-orange)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-color)'
              e.currentTarget.style.color = 'var(--text-muted)'
            }}
          >
            エクスポート
          </button>
          <button
            onClick={onImportWatchlists}
            style={{
              flex: 1,
              padding: '6px',
              background: 'transparent',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              color: 'var(--text-muted)',
              fontSize: '10px',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--accent-orange)'
              e.currentTarget.style.color = 'var(--accent-orange)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-color)'
              e.currentTarget.style.color = 'var(--text-muted)'
            }}
          >
            インポート
          </button>
        </div>
      </div>

      {/* Context menu for watchlist right-click */}
      {contextMenu && (
        <div
          style={{
            position: 'fixed',
            left: contextMenu.x,
            top: contextMenu.y,
            zIndex: 1000,
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-light)',
            borderRadius: '4px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            minWidth: '150px',
            padding: '4px 0',
          }}
          onClick={e => e.stopPropagation()}
        >
          <button
            onClick={handleStartRename}
            style={{
              display: 'block',
              width: '100%',
              padding: '8px 14px',
              textAlign: 'left',
              color: 'var(--text-primary)',
              fontSize: '12px',
              cursor: 'pointer',
              border: 'none',
              background: 'none',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-hover)'
              e.currentTarget.style.color = 'var(--accent-orange)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'none'
              e.currentTarget.style.color = 'var(--text-primary)'
            }}
          >
            名前を変更
          </button>
          <button
            onClick={handleDelete}
            style={{
              display: 'block',
              width: '100%',
              padding: '8px 14px',
              textAlign: 'left',
              color: 'var(--negative)',
              fontSize: '12px',
              cursor: 'pointer',
              border: 'none',
              background: 'none',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-hover)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'none'
            }}
          >
            削除
          </button>
        </div>
      )}

      {/* Delete confirmation overlay */}
      {confirmDelete && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 2000,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={() => setConfirmDelete(null)}
        >
          <div
            style={{
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-light)',
              borderRadius: '6px',
              padding: '20px 24px',
              minWidth: '280px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontSize: '13px', color: 'var(--text-primary)', marginBottom: '16px' }}>
              「{confirmDelete.name}」を削除しますか？
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setConfirmDelete(null)}
                style={{
                  padding: '6px 16px',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-light)',
                  borderRadius: '3px',
                  color: 'var(--text-secondary)',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                キャンセル
              </button>
              <button
                onClick={handleConfirmDelete}
                style={{
                  padding: '6px 16px',
                  background: 'var(--negative)',
                  border: 'none',
                  borderRadius: '3px',
                  color: '#fff',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                削除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
