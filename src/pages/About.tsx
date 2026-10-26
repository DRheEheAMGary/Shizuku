/* ============================================================================
 *  Shizuku · About
 * ----------------------------------------------------------------------------
 *  游戏 / 游戏账号 / 站外链接，不放页面大标题。
 * ========================================================================== */

import { GlassCard } from '@/components/GlassCard'
import { Icon } from '@/components/Icon'
import { PageShell } from '@/components/PageShell'
import { profile } from '@/content/site'
import './Subpage.css'

export function About() {
  return (
    <PageShell marginText="について" wide>
      <div className="subpage subpage--paired">
        <div className="page-grid">
          <GlassCard span={4} title="游戏" icon="gamepad" className="span-4">
            <div className="tag-row">
              {profile.games.map((game) => (
                <span className="tag" key={game}>
                  {game}
                </span>
              ))}
            </div>
            <p className="sub-note">
              <Icon name="cube" size={14} />
              Minecraft · {profile.minecraft}
            </p>
          </GlassCard>

          <GlassCard span={8} title="游戏账号" icon="cube" className="span-8">
            <div className="account-list">
              {profile.gameAccounts.map((account) => (
                <div className="account-row" key={account.game}>
                  <span className="row-icon" aria-hidden="true">
                    <Icon name={account.icon} size={16} />
                  </span>
                  <div className="account-main">
                    <strong>{account.game}</strong>
                    <span>UID {account.uid}</span>
                  </div>
                  {account.level && <span className="level">{account.level}</span>}
                </div>
              ))}
            </div>
          </GlassCard>

          <GlassCard span={12} title="链接" icon="folder" className="span-12">
            <div className="link-grid">
              {profile.links.map((link) => (
                <a
                  className="link-card"
                  key={link.url}
                  href={link.url}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  <span className="link-icon" aria-hidden="true">
                    <Icon name={link.icon} size={16} />
                  </span>
                  <span className="link-main">
                    <strong>{link.name}</strong>
                    <span>{link.desc}</span>
                  </span>
                  <Icon name="arrow-up-right" size={14} className="link-arrow" />
                </a>
              ))}
            </div>
          </GlassCard>
        </div>
      </div>
    </PageShell>
  )
}
