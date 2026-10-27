import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * 纯静态站点的 Vite 配置：产物是一组静态文件，直接放到站点根目录。
 * 不设 base，保持默认 '/'：index.html 里的 /fonts/*、/bg*.webp 以及
 * 运行时请求的 /search-index.json 都是站点根绝对路径。
 */
export default defineConfig({
  // React 支持：JSX 转换与开发期 Fast Refresh
  plugins: [react()],
  resolve: {
    alias: {
      // '@' -> ./src，与 tsconfig.json 的 paths（"@/*": ["./src/*"]）一一对应；
      // 源码统一用 @/... 引用，避免层层 ../../ 的相对路径
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    // 开发服务器只监听本机回环、固定端口，本地地址稳定为 http://127.0.0.1:5180
    host: '127.0.0.1',
    port: 5180,
  },
  build: {
    // 构建目标 ES2022：产物保留现代语法（类字段、顶层 await 等），不为旧浏览器降级
    target: 'es2022',
    // CSS 目标 Chrome 111：按这个基线决定是否降级新语法，不再照顾更老的浏览器
    cssTarget: 'chrome111',
  },
})
