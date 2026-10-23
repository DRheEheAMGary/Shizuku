/* ============================================================================
 *  Shizuku · 顶栏右侧的搜索按钮
 * ----------------------------------------------------------------------------
 *  一枚圆形磨砂玻璃钮。点开之后：
 *    · 按钮的玻璃溶进顶栏的玻璃（圆形淡出）
 *    · 放大镜图标一路向左飞进顶栏的胶囊里，落成输入框左侧的图标
 *    · 左侧的头像也溶进顶栏
 *  所以视觉上是「整个顶栏变成了搜索框」。
 * ========================================================================== */

import { forwardRef } from 'react'

interface SearchButtonProps {
  searching: boolean
  onOpen: () => void
}

export const SearchButton = forwardRef<SVGSVGElement, SearchButtonProps>(
  function SearchButton({ searching, onOpen }, iconRef) {
    return (
      <button
        type="button"
        className="search-btn"
        data-flying={searching}
        onClick={onOpen}
        aria-label="全域搜索"
        title="搜索（⌘K）"
        aria-hidden={searching}
      >
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
