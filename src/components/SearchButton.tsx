/* ============================================================================
 *  Shizuku · 顶栏搜索按钮
 * ----------------------------------------------------------------------------
 *  圆形磨砂玻璃钮。打开搜索后：
 *    · 钮的玻璃层淡出，溶进顶栏
 *    · 放大镜图标由 SiteHeader 算出位移，飞到胶囊左端的落点槽位
 *  图标始终留在按钮内部，按钮位置固定，所以收起时回到原位即可。
 * ========================================================================== */

import { forwardRef } from 'react'
import { modKeyLabel } from '@/lib/platform'

interface SearchButtonProps {
  searching: boolean
  onToggle: () => void
}

/**
 * 顶栏搜索钮，通过 forwardRef 把内部 <svg> 交给 SiteHeader 做飞行动画。
 * @param searching 搜索是否展开：true 时玻璃层淡出、图标进入飞行态
 * @param onToggle 点击回调，由 SiteHeader 决定开还是关
 */
export const SearchButton = forwardRef<SVGSVGElement, SearchButtonProps>(
  function SearchButton({ searching, onToggle }, iconRef) {
    return (
      <button
        type="button"
        className="search-btn"
        data-flying={searching}
        onClick={onToggle}
        aria-label={searching ? '收起搜索' : `全域搜索（${modKeyLabel()}K）`}
        title={`搜索（${modKeyLabel()}K）`}
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
