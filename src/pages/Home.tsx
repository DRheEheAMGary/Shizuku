/* ============================================================================
 *  Shizuku · 首页
 * ========================================================================== */

import { Link } from 'react-router'
import { Icon } from '@/components/Icon'
import { Reveal } from '@/components/Reveal'
import { PageShell } from '@/components/PageShell'
import { profile, site } from '@/content/site'
import { games } from '@/content/interests'
import './Home.css'

export function Home() {
  return (
    <PageShell marginText="ホーム">
      {/* ---------- Hero ---------- */}
      <section className="hero">
        <div className="hero__avatar-wrap intro" style={{ '--i': 0 } as never}>
          <img
            className="hero__avatar"
            src={site.avatar}
            alt={`${site.author} 的头像`}
            width={88}
            height={88}
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
          <Link to="/about" className="btn btn--primary">
            了解更多
            <Icon name="arrow-up-right" size={15} />
          </Link>
          <Link to="/links" className="btn">
            我的链接
          </Link>
        </div>

        <p className="hero__lyric intro" lang="ja" style={{ '--i': 5 } as never}>
          {profile.lyric}
        </p>
      </section>

      {/* ---------- 最近在玩 ---------- */}
      <Reveal>
        <div className="section-head">
          <h2 className="section-head__title">最近在玩</h2>
          <span className="section-head__kana" lang="ja">
            ゲーム
          </span>
        </div>
        <div className="chips">
          {games.map((g) => (
            <span key={g} className="chip">
              {g}
            </span>
          ))}
        </div>
      </Reveal>
    </PageShell>
  )
}
