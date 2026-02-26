import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import type { WatchlistInfo, SearchResult } from '../types/stock'

interface AddTickerModalProps {
  isOpen: boolean
  onClose: () => void
  onAdd: (tickers: string[], listId: string) => void
  watchlists: WatchlistInfo[]
  activeListId: string | null
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: 'rgba(0,0,0,0.7)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
}

const modalStyle: React.CSSProperties = {
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border-light)',
  borderRadius: '8px',
  padding: '24px',
  width: '440px',
  boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
}

const titleStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontWeight: 700,
  fontSize: '14px',
  color: 'var(--accent-orange)',
  marginBottom: '16px',
}

const searchContainerStyle: React.CSSProperties = {
  position: 'relative',
  marginBottom: '10px',
}

const searchInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px 8px 28px',
  background: 'var(--bg-tertiary)',
  border: '1px solid var(--border-light)',
  borderRadius: '4px',
  color: 'var(--text-primary)',
  fontSize: '13px',
  boxSizing: 'border-box',
}

const searchIconStyle: React.CSSProperties = {
  position: 'absolute',
  left: '9px',
  top: '50%',
  transform: 'translateY(-50%)',
  color: 'var(--text-muted)',
  fontSize: '12px',
  pointerEvents: 'none',
}

const dropdownStyle: React.CSSProperties = {
  position: 'absolute',
  top: '100%',
  left: 0,
  right: 0,
  background: 'var(--bg-tertiary)',
  border: '1px solid var(--border-light)',
  borderRadius: '0 0 4px 4px',
  maxHeight: '200px',
  overflowY: 'auto',
  zIndex: 10,
}

const dropdownItemStyle: React.CSSProperties = {
  padding: '6px 12px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  fontSize: '12px',
  transition: 'background 0.1s',
}

const textareaStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  background: 'var(--bg-tertiary)',
  border: '1px solid var(--border-light)',
  borderRadius: '4px',
  color: 'var(--text-primary)',
  fontFamily: 'var(--font-mono)',
  fontSize: '14px',
  textTransform: 'uppercase',
  boxSizing: 'border-box',
  resize: 'vertical',
  minHeight: '60px',
  lineHeight: '1.5',
}

const selectStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  background: 'var(--bg-tertiary)',
  border: '1px solid var(--border-light)',
  borderRadius: '4px',
  color: 'var(--text-primary)',
  fontSize: '12px',
  fontFamily: 'inherit',
  marginTop: '10px',
  boxSizing: 'border-box',
}

const buttonRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '8px',
  marginTop: '16px',
  justifyContent: 'flex-end',
}

const btnBase: React.CSSProperties = {
  padding: '8px 20px',
  borderRadius: '4px',
  fontSize: '12px',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'all 0.15s',
}

function parseTickers(input: string): string[] {
  return [...new Set(
    input
      .split(/[,\s\n]+/)
      .map(t => t.trim().toUpperCase())
      .filter(t => t.length > 0)
  )]
}

export function AddTickerModal({ isOpen, onClose, onAdd, watchlists, activeListId }: AddTickerModalProps) {
  const [input, setInput] = useState('')
  const [selectedListId, setSelectedListId] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [validating, setValidating] = useState(false)
  const [invalidTickers, setInvalidTickers] = useState<string[]>([])
  const [highlightIndex, setHighlightIndex] = useState(-1)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  const parsed = useMemo(() => parseTickers(input), [input])

  const existingSymbols = useMemo(() => {
    const list = watchlists.find(wl => wl.id === selectedListId)
    return new Set(list?.symbols ?? [])
  }, [watchlists, selectedListId])

  const newTickers = useMemo(() => parsed.filter(t => !existingSymbols.has(t)), [parsed, existingSymbols])
  const duplicateCount = parsed.length - newTickers.length

  // Debounced search
  const doSearch = useCallback((query: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim()) {
      setSearchResults([])
      setSearching(false)
      return
    }
    setSearching(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await window.electronAPI.searchTickers(query.trim())
        setSearchResults(results)
      } catch {
        setSearchResults([])
      }
      setSearching(false)
    }, 300)
  }, [])

  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
    setHighlightIndex(-1)
    doSearch(value)
  }

  const addTickerFromSearch = (symbol: string) => {
    const upper = symbol.toUpperCase()
    setInput(prev => {
      const existing = parseTickers(prev)
      if (existing.includes(upper)) return prev
      return prev ? prev.trimEnd() + ', ' + upper : upper
    })
    setSearchQuery('')
    setSearchResults([])
    setInvalidTickers([])
    searchInputRef.current?.focus()
  }

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (searchResults.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightIndex(prev => Math.min(prev + 1, searchResults.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightIndex(prev => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (highlightIndex >= 0 && highlightIndex < searchResults.length) {
        addTickerFromSearch(searchResults[highlightIndex].symbol)
      }
    }
  }

  useEffect(() => {
    if (isOpen) {
      setInput('')
      setSearchQuery('')
      setSearchResults([])
      setInvalidTickers([])
      setValidating(false)
      if (activeListId) {
        setSelectedListId(activeListId)
      } else if (watchlists.length > 0) {
        setSelectedListId(watchlists[0].id)
      } else {
        setSelectedListId('')
      }
      setTimeout(() => searchInputRef.current?.focus(), 100)
    }
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [isOpen, activeListId, watchlists])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newTickers.length === 0 || !selectedListId) return

    // Validate tickers exist
    setValidating(true)
    setInvalidTickers([])
    try {
      const quotes = await window.electronAPI.getStockQuotes(newTickers)
      const validSymbols = new Set(quotes.map(q => q.symbol.toUpperCase()))
      const invalid = newTickers.filter(t => !validSymbols.has(t))
      const valid = newTickers.filter(t => validSymbols.has(t))

      if (invalid.length > 0) {
        setInvalidTickers(invalid)
        if (valid.length > 0) {
          // Add valid ones, keep invalid in textarea
          onAdd(valid, selectedListId)
          setInput(invalid.join(', '))
        }
      } else {
        onAdd(valid, selectedListId)
        onClose()
      }
    } catch {
      // On error, add all (best effort)
      onAdd(newTickers, selectedListId)
      onClose()
    }
    setValidating(false)
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={e => e.stopPropagation()}>
        <div style={titleStyle}>銘柄を追加</div>
        <form onSubmit={handleSubmit}>
          {/* Search input */}
          <div style={searchContainerStyle}>
            <span style={searchIconStyle}>&#x1F50D;</span>
            <input
              ref={searchInputRef}
              type="text"
              style={searchInputStyle}
              placeholder="銘柄名・ティッカーで検索..."
              value={searchQuery}
              onChange={e => handleSearchChange(e.target.value)}
              onKeyDown={handleSearchKeyDown}
            />
            {/* Dropdown */}
            {(searchResults.length > 0 || searching) && searchQuery && (
              <div style={dropdownStyle}>
                {searching && searchResults.length === 0 ? (
                  <div style={{ padding: '8px 12px', fontSize: '11px', color: 'var(--text-muted)' }}>
                    検索中...
                  </div>
                ) : (
                  searchResults.map((r, i) => {
                    const alreadyAdded = parseTickers(input).includes(r.symbol.toUpperCase()) || existingSymbols.has(r.symbol.toUpperCase())
                    return (
                      <div
                        key={r.symbol}
                        style={{
                          ...dropdownItemStyle,
                          background: i === highlightIndex ? 'var(--border-light)' : 'transparent',
                          opacity: alreadyAdded ? 0.4 : 1,
                        }}
                        onMouseEnter={() => setHighlightIndex(i)}
                        onClick={() => !alreadyAdded && addTickerFromSearch(r.symbol)}
                      >
                        <span style={{
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 700,
                          color: 'var(--accent-orange)',
                          minWidth: '70px',
                        }}>
                          {r.symbol}
                        </span>
                        <span style={{
                          flex: 1,
                          color: 'var(--text-secondary)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {r.shortName}
                        </span>
                        <span style={{
                          fontSize: '10px',
                          color: 'var(--text-muted)',
                          whiteSpace: 'nowrap',
                        }}>
                          {r.exchange}
                        </span>
                        {alreadyAdded && (
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>追加済</span>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            )}
          </div>

          {/* Ticker textarea */}
          <textarea
            style={textareaStyle}
            placeholder={"直接入力も可（カンマ・スペース・改行区切り）\n例: AAPL, MSFT, NVDA"}
            value={input}
            onChange={e => { setInput(e.target.value); setInvalidTickers([]) }}
            rows={2}
          />

          {/* Validation error */}
          {invalidTickers.length > 0 && (
            <div style={{
              fontSize: '11px',
              color: 'var(--negative)',
              marginTop: '6px',
              padding: '6px 8px',
              background: 'rgba(239,83,80,0.1)',
              borderRadius: '3px',
            }}>
              存在しないティッカー: {invalidTickers.join(', ')}
            </div>
          )}

          {watchlists.length > 0 ? (
            <select
              style={selectStyle}
              value={selectedListId}
              onChange={e => setSelectedListId(e.target.value)}
            >
              {watchlists.map(wl => (
                <option key={wl.id} value={wl.id}>
                  {wl.name} ({wl.symbols.length} 銘柄)
                </option>
              ))}
            </select>
          ) : (
            <div style={{
              fontSize: '11px',
              color: 'var(--text-muted)',
              marginTop: '10px',
            }}>
              ウォッチリストがありません。先にリストを作成してください。
            </div>
          )}

          <div style={{
            fontSize: '11px',
            color: 'var(--text-muted)',
            marginTop: '8px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <span>検索から選択、または直接入力</span>
            {parsed.length > 0 && (
              <span style={{
                color: newTickers.length > 0 ? 'var(--accent-orange)' : 'var(--text-muted)',
                fontFamily: 'var(--font-mono)',
                fontWeight: 600,
              }}>
                {newTickers.length} 銘柄追加
                {duplicateCount > 0 && (
                  <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>
                    {' '}({duplicateCount} 件重複)
                  </span>
                )}
              </span>
            )}
          </div>

          <div style={buttonRowStyle}>
            <button
              type="button"
              onClick={onClose}
              style={{
                ...btnBase,
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-light)',
                color: 'var(--text-secondary)',
              }}
            >
              キャンセル
            </button>
            <button
              type="submit"
              style={{
                ...btnBase,
                background: 'var(--accent-orange)',
                border: '1px solid var(--accent-orange)',
                color: '#000',
                opacity: (newTickers.length === 0 || !selectedListId || validating) ? 0.5 : 1,
              }}
              disabled={newTickers.length === 0 || !selectedListId || validating}
            >
              {validating ? '確認中...' : newTickers.length > 1 ? `${newTickers.length} 件追加` : '追加'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
