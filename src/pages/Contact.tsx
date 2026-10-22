/* ============================================================================
 *  Shizuku · 联系
 * ========================================================================== */

import { useState } from 'react'
import { Icon } from '@/components/Icon'
import { Reveal } from '@/components/Reveal'
import { PageShell } from '@/components/PageShell'
import { contacts } from '@/content/links'
import './Contact.css'

export function Contact() {
  const [copied, setCopied] = useState<string | null>(null)

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(value)
      setTimeout(() => setCopied(null), 1600)
    } catch {
      // 剪贴板不可用（如非 https 环境）时静默降级
    }
  }

  return (
    <PageShell marginText="連絡先" title="联系" subtitle="想聊点什么的话，随时来找我。">
      <div className="contact-list">
        {contacts.map((c, i) => (
          <Reveal key={c.value + c.type} delay={i * 45}>
            <div className="glass contact-item">
              <span className="contact-item__icon">
                <Icon name={c.icon} size={16} />
              </span>
              <span className="contact-item__display">{c.display}</span>
              {c.copyable && (
                <button
                  type="button"
                  className="contact-item__copy"
                  onClick={() => copy(c.value)}
                  aria-label={`复制 ${c.value}`}
                >
                  <Icon name={copied === c.value ? 'check' : 'copy'} size={14} />
                  <span>{copied === c.value ? '已复制' : '复制'}</span>
                </button>
              )}
            </div>
          </Reveal>
        ))}
      </div>
    </PageShell>
  )
}
