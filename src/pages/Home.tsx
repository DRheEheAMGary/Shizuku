/* ============================================================================
 *  Shizuku · 单页主页
 * ----------------------------------------------------------------------------
 *  全站一个长页面：Hero → 关于 → 成分 → 游戏账号 → 推し → 链接 → 项目 → 联系
 * ========================================================================== */

import { useState } from 'react'
import { Icon } from '@/components/Icon'
import { GithubHeatmap } from '@/components/GithubHeatmap'
import { Reveal } from '@/components/Reveal'
import { PageShell } from '@/components/PageShell'
import { profile, site } from '@/content/site'
import { contacts, links } from '@/content/links'
import {
  animeGenres,
  gameAccounts,
  genshinChars,
  games,
  minecraft,
  oshi,
  projects,
  subPush,
  vtubers,
} from '@/content/interests'
import './Home.css'

export function Home() {
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
    <PageShell marginText="しずく">
      {/* ---------- Hero ---------- */}
      <section id="top" className="hero">
        <div className="hero__avatar-wrap intro" style={{ '--i': 0 } as never}>
          <img
            className="hero__avatar"
            src={site.avatar}
            alt={`${site.author} 的头像`}
            width={76}
            height={76}
            fetchPriority="high"
          />
        </div>

        <h1 className="hero__name intro" style={{ '--i': 1 } as never}>
          {profile.name}
        </h1>

        <p className="hero__desc intro" style={{ '--i': 2 } as never}>
          {profile.description}
        </p>

        <div className="chips intro" style={{ '--i': 3 } as never}>
          {profile.tags.map((tag) => (
            <span key={tag.text} className="chip">
              <Icon name={tag.icon as never} size={12} />
              {tag.text}
            </span>
          ))}
        </div>

        <div className="hero__actions intro" style={{ '--i': 4 } as never}>
          <a href="#about" className="btn btn--primary">
            了解更多
            <Icon name="arrow-up-right" size={15} />
          </a>
          <a href="#links" className="btn">
            我的链接
          </a>
        </div>

        <p className="hero__lyric intro" lang="ja" style={{ '--i': 5 } as never}>
          {profile.lyric}
        </p>
      </section>

      {/* ---------- 关于 ---------- */}
      <Reveal>
        <section id="about" className="section">
          <div className="section-head">
            <h2 className="section-head__title">关于</h2>
            <span className="section-head__kana" lang="ja">
              について
            </span>
          </div>

          <div className="prose">
            {profile.about.map((line) => (
              <p key={line}>{line}</p>
            ))}
            <p className="quote">{profile.quote}</p>
          </div>

          <div className="facts">
            <div>
              <div className="fact__label">所在地</div>
              <div className="fact__value">{profile.location}</div>
            </div>
            <div>
              <div className="fact__label">MBTI</div>
              <div className="fact__value">{profile.mbti}</div>
            </div>
            <div>
              <div className="fact__label">推し</div>
              <div className="fact__value">{oshi}</div>
            </div>
          </div>
        </section>
      </Reveal>

      {/* ---------- 成分 ---------- */}
      <Reveal>
        <section className="section">
          <div className="section-head">
            <h2 className="section-head__title">成分</h2>
            <span className="section-head__kana" lang="ja">
              成分
            </span>
          </div>
          <div className="cols">
            <div>
              <h3 className="cols__title">游戏</h3>
              <ul className="plain-list">
                {games.map((g) => (
                  <li key={g}>{g}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="cols__title">二次元</h3>
              <ul className="plain-list">
                {animeGenres.map((g) => (
                  <li key={g}>{g}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="cols__title">Minecraft</h3>
              <p className="plain-list">{minecraft}</p>
            </div>
          </div>
        </section>
      </Reveal>

      {/* ---------- 游戏账号 ---------- */}
      <Reveal>
        <section className="section">
          <div className="section-head">
            <h2 className="section-head__title">游戏账号</h2>
            <span className="section-head__kana" lang="ja">
              アカウント
            </span>
          </div>
          <div className="rows">
            {gameAccounts.map((acc) => (
              <div key={acc.game + acc.uid} className="row">
                <span className="row__icon">
                  <Icon name={acc.icon} size={16} />
                </span>
                <span className="row__body">
                  <span className="row__title">
                    {acc.game}
                    {acc.level && (
                      <span className="chip chip--accent row__level">{acc.level}</span>
                    )}
                  </span>
                </span>
                <span className="row__meta">{acc.uid}</span>
              </div>
            ))}
          </div>
        </section>
      </Reveal>

      {/* ---------- 推し ---------- */}
      <Reveal>
        <section className="section">
          <div className="section-head">
            <h2 className="section-head__title">推し</h2>
            <span className="section-head__kana" lang="ja">
              推し
            </span>
          </div>
          <div className="cols">
            <div>
              <h3 className="cols__title">虚拟主播</h3>
              <div className="chips">
                {vtubers.map((c) => (
                  <a
                    key={c.name}
                    className="chip"
                    href={c.url}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    <Icon name={c.icon} size={12} />
                    {c.name}
                  </a>
                ))}
              </div>
            </div>
            <div>
              <h3 className="cols__title">主推</h3>
              <div className="chips">
                {genshinChars.map((c) => (
                  <span key={c.name} className="chip">
                    <Icon name={c.icon} size={12} />
                    {c.name}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <h3 className="cols__title">副推</h3>
              <div className="chips">
                {subPush.map((c) => (
                  <span key={c.name} className="chip">
                    <Icon name={c.icon} size={12} />
                    {c.name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>
      </Reveal>

      {/* ---------- 链接 ---------- */}
      <Reveal>
        <section id="links" className="section">
          <div className="section-head">
            <h2 className="section-head__title">链接</h2>
            <span className="section-head__kana" lang="ja">
              リンク
            </span>
          </div>
          <div className="rows">
            {links.map((item) => (
              <a
                key={item.name}
                className="row"
                href={item.url}
                target="_blank"
                rel="noreferrer noopener"
              >
                <span className="row__icon">
                  <Icon name={item.icon} size={16} />
                </span>
                <span className="row__body">
                  <span className="row__title">{item.name}</span>
                  <span className="row__sub">{item.desc}</span>
                </span>
                <span className="row__arrow">
                  <Icon name="arrow-up-right" size={15} />
                </span>
              </a>
            ))}
          </div>
        </section>
      </Reveal>

      {/* ---------- 项目 ---------- */}
      <Reveal>
        <section id="works" className="section">
          <div className="section-head">
            <h2 className="section-head__title">项目</h2>
            <span className="section-head__kana" lang="ja">
              作品
            </span>
          </div>
          <div className="rows">
            {projects.map((p) => (
              <a
                key={p.name}
                className="row"
                href={p.url}
                target="_blank"
                rel="noreferrer noopener"
              >
                <span className="row__icon">
                  <Icon name={p.icon} size={18} />
                </span>
                <span className="row__body">
                  <span className="row__title">{p.name}</span>
                  <span className="row__sub">{p.desc}</span>
                </span>
                <span className="row__arrow">
                  <Icon name="arrow-up-right" size={15} />
                </span>
              </a>
            ))}
          </div>

          {/* 贡献热力图：默认折叠，避免信息密度压垮页面 */}
          <details className="works-heat">
            <summary className="works-heat__summary">
              <span>GitHub 贡献热力图</span>
              <span className="works-heat__hint">展开</span>
            </summary>
            <div className="works-heat__body">
              <GithubHeatmap />
            </div>
          </details>
        </section>
      </Reveal>

      {/* ---------- 联系 ---------- */}
      <Reveal>
        <section id="contact" className="section">
          <div className="section-head">
            <h2 className="section-head__title">联系</h2>
            <span className="section-head__kana" lang="ja">
              連絡先
            </span>
          </div>
          <div className="rows">
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
        </section>
      </Reveal>
    </PageShell>
  )
}
