/* ============================================================================
 *  Shizuku · 平台判断
 * ----------------------------------------------------------------------------
 *  只用来决定快捷键提示怎么写：macOS 上写 ⌘，Windows / Linux 上写 Ctrl。
 *  键盘监听本身两边都收（metaKey || ctrlKey），这里纯粹是文案。
 * ========================================================================== */

/** 是不是 Apple 平台（macOS / iOS / iPadOS） */
export function isApplePlatform(): boolean {
  if (typeof navigator === 'undefined') return false

  // 优先用 UA-CH 的 platform，其次退回 navigator.platform
  const uaData = (navigator as Navigator & { userAgentData?: { platform?: string } })
    .userAgentData
  const platform = uaData?.platform || navigator.platform
  if (platform) return /mac|iphone|ipad|ipod/i.test(platform)

  // 两者都拿不到时再看 UA 字符串
  return /macintosh|mac os x|iphone|ipad|ipod/i.test(navigator.userAgent)
}

/** 快捷键提示里那个修饰键：⌘ 或 Ctrl+ */
export function modKeyLabel(): string {
  return isApplePlatform() ? '⌘' : 'Ctrl+'
}