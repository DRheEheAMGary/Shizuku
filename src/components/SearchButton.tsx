/* ============================================================================
 *  Shizuku · 顶栏右侧的搜索按钮
 * ----------------------------------------------------------------------------
 *  圆形磨砂玻璃钮。点开之后：
 *    · 钮的玻璃溶进顶栏的玻璃
 *    · 放大镜图标一路向左飞进顶栏的胶囊，落成输入框左侧的图标
 *  图标自己待在按钮里：按钮的位置是稳的，飞回去也就是回到原处。
 * ========================================================================== */

import { forwardRef } from 'react'

interface SearchButtonProps {
  searching: boolean
  onToggle: () => void
}

export const SearchButton = forwardRef<SVGSVGElement, SearchButtonProps>(
  function SearchButton({ searching, onToggle }, iconRef) {
    return (
      <button
        type="button"
        className="search-btn"
        data-flying={searching}
        onClick={onToggle}
        aria-label={searching ? '收起搜索' : '全域搜索'}
        title="搜索（⌘K）"
      >
        <span className="search-btn__glass" aria-hidden="true" />
        <svg
          ref={iconRef}
          className="search-btn__icon"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            d="M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13M15.4 15.4 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
      </button>
    )
  },
)
