/* ============================================================================
 *  Shizuku · 顶栏左侧的搜索按钮
 * ----------------------------------------------------------------------------
 *  一枚独立的圆形磨砂玻璃按钮，点了浮出搜索面板。
 *  快捷键 ⌘K / Ctrl+K 也能直接开。
 * ========================================================================== */

import { useEffect, useState } from 'react'
import { SearchOverlay } from './SearchOverlay'
import './SearchOverlay.css'

export function SearchButton() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // ⌘K / Ctrl+K：直接开搜索
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(true)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  return (
    <>
      <button
        type="button"
        className="search-btn"
        onClick={() => setOpen(true)}
        aria-label="全域搜索"
        title="搜索（⌘K）"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13M15.4 15.4 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
      </button>

      <SearchOverlay open={open} onClose={() => setOpen(false)} />
    </>
  )
}
