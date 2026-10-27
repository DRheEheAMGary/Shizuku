/* ============================================================================
 *  Shizuku · Contact
 * ----------------------------------------------------------------------------
 *  两张卡片：社交（QQ + 哔哩哔哩）与邮箱。
 *  QQ 号与每个邮箱都带复制按钮，邮箱本身还能直接 mailto 点开写信。
 * ========================================================================== */

import { useEffect, useRef, useState } from 'react'
import { GlassCard } from '@/components/GlassCard'
import { Icon } from '@/components/Icon'
import { PageShell } from '@/components/PageShell'
import { profile } from '@/content/site'
import './Subpage.css'

/**
 * 剪贴板 API 不可用（非安全上下文、老浏览器、权限被拒）时的兜底：
 * 造一个不可见的 textarea，选中后走已废弃但仍广泛支持的 execCommand。
 */
function fallbackCopy(value: string) {
  const area = document.createElement('textarea')
  area.value = value
  area.style.position = 'fixed'
  area.style.opacity = '0'
  document.body.appendChild(area)
  area.select()
  try {
    document.execCommand('copy')
  } catch {
    /* 复制失败也不弹窗，保持安静 */
  }
  document.body.removeChild(area)
}

/**
 * 复制按钮：点击后图标切成对勾，1.4s 后自动复原。
 * 卸载时清掉计时器，避免在已卸载组件上 setState。
 */
function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current)
    },
    [],
  )

  const copy = async () => {
    try {
      // 优先用异步剪贴板 API；写失败（权限/焦点问题）再退回 execCommand
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(value)
      else fallbackCopy(value)
    } catch {
      fallbackCopy(value)
    }

    // 不论成功与否都给一次视觉反馈：按钮状态只做提示，不承诺结果
    setCopied(true)
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setCopied(false), 1400)
  }

  return (
    <button
      type="button"
      className={`icon-btn${copied ? ' is-copied' : ''}`}
      onClick={copy}
      aria-label={copied ? '已复制' : `复制${label}`}
      title={copied ? '已复制' : `复制${label}`}
    >
      <Icon name={copied ? 'check' : 'copy'} size={14} />
    </button>
  )
}

export function Contact() {
  const { contacts } = profile

  return (
    <PageShell marginText="れんらく" wide>
      <div className="subpage subpage--contact">
        <div className="page-grid">
          <GlassCard span={4} title="社交" icon="qq" className="span-4">
            <div className="contact-list">
              <div className="contact-row">
                <span className="row-icon" aria-hidden="true">
                  <Icon name="qq" size={16} />
                </span>
                <div className="contact-main">
                  <span className="contact-label">QQ</span>
                  <strong className="contact-value">{contacts.qq}</strong>
                </div>
                <CopyButton value={contacts.qq} label="QQ 号" />
              </div>

              <a
                className="contact-row is-link"
                href={contacts.bilibili.url}
                target="_blank"
                rel="noreferrer noopener"
              >
                <span className="row-icon" aria-hidden="true">
                  <Icon name="bilibili" size={16} />
                </span>
                <span className="contact-main">
                  <span className="contact-label">哔哩哔哩</span>
                  <strong className="contact-value">{contacts.bilibili.handle}</strong>
                </span>
                <Icon name="arrow-up-right" size={15} className="row-arrow" />
              </a>
            </div>
            <p className="contact-note">B 站私信或 QQ 都能找到我。</p>
          </GlassCard>

          <GlassCard span={8} title="邮箱" icon="mail" className="span-8">
            <div className="contact-list">
              {contacts.emails.map((email) => (
                <div className="contact-row" key={email}>
                  <span className="row-icon" aria-hidden="true">
                    <Icon name="mail" size={16} />
                  </span>
                  <a className="contact-main" href={`mailto:${email}`}>
                    <span className="contact-label">Email</span>
                    <strong className="contact-value">{email}</strong>
                  </a>
                  <CopyButton value={email} label="邮箱" />
                </div>
              ))}
            </div>
            <p className="contact-note">点击地址直接写邮件，也可以复制。</p>
          </GlassCard>
        </div>
      </div>
    </PageShell>
  )
}
