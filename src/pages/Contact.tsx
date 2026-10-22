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
      // 剪贴板不可用（非 https 环境）时静默降级
    }
  }

  return (
    <PageShell marginText="連絡先" title="联系" subtitle="想聊点什么的话，随时来找我。">
      <Reveal>
        <div className="contact-rows rows">
          {contacts.map((c) => (
            <div key={c.value} className="row">
              <span className="row__icon">
                <Icon name={c.icon} size={16} />
              </span>
              <span className="row__body">
                <span className="row__title">{c.display}</span>
              </span>
              {c.copyable && (
                <button
                  type="button"
                  className="contact-copy"
                  onClick={() => copy(c.value)}
                  aria-label={`复制 ${c.value}`}
                >
                  <Icon name={copied === c.value ? 'check' : 'copy'} size={13} />
                  <span>{copied === c.value ? '已复制' : '复制'}</span>
                </button>
              )}
            </div>
          ))}
        </div>
      </Reveal>
    </PageShell>
  )
}
