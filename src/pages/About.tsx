/* ============================================================================
 *  Shizuku · 关于
 * ========================================================================== */

import { Icon } from '@/components/Icon'
import { Reveal } from '@/components/Reveal'
import { PageShell } from '@/components/PageShell'
import { profile } from '@/content/site'
import {
  animeGenres,
  gameAccounts,
  genshinChars,
  games,
  minecraft,
  oshi,
  subPush,
  vtubers,
} from '@/content/interests'
import './About.css'

export function About() {
  return (
    <PageShell marginText="について" title="关于" subtitle={profile.description}>
      {/* ---------- 自我介绍 ---------- */}
      <Reveal className="glass about-card">
        <div className="about-card__text">
          {profile.about.map((line) => (
            <p key={line} className="about-card__line">
              {line}
            </p>
          ))}
        </div>
        <blockquote className="about-card__quote">「{profile.quote}」</blockquote>
      </Reveal>

      {/* ---------- 基本信息 ---------- */}
      <Reveal className="about-grid" delay={60}>
        <div className="glass about-grid__item">
          <span className="about-grid__label">所在地</span>
          <span className="about-grid__value">{profile.location}</span>
        </div>
        <div className="glass about-grid__item">
          <span className="about-grid__label">MBTI</span>
          <span className="about-grid__value">{profile.mbti}</span>
        </div>
        <div className="glass about-grid__item">
          <span className="about-grid__label">推し</span>
          <span className="about-grid__value">{oshi}</span>
        </div>
      </Reveal>

      {/* ---------- 成分 ---------- */}
      <Reveal className="about-section" delay={100}>
        <div className="section-head">
          <h2 className="section-head__title">成分表</h2>
          <span className="section-head__kana" lang="ja">
            成分
          </span>
        </div>
        <div className="about-composition">
          <div className="glass about-composition__col">
            <h3 className="about-composition__title">游戏</h3>
            <ul className="about-list">
              {games.map((g) => (
                <li key={g} className="about-list__item">
                  {g}
                </li>
              ))}
            </ul>
          </div>
          <div className="glass about-composition__col">
            <h3 className="about-composition__title">二次元</h3>
            <ul className="about-list">
              {animeGenres.map((g) => (
                <li key={g} className="about-list__item">
                  {g}
                </li>
              ))}
            </ul>
          </div>
          <div className="glass about-composition__col">
            <h3 className="about-composition__title">Minecraft</h3>
            <p className="about-list__item">{minecraft}</p>
          </div>
        </div>
      </Reveal>

      {/* ---------- 游戏账号 ---------- */}
      <Reveal className="about-section" delay={140}>
        <div className="section-head">
          <h2 className="section-head__title">游戏账号</h2>
          <span className="section-head__kana" lang="ja">
            アカウント
          </span>
        </div>
        <div className="glass about-table">
          {gameAccounts.map((acc) => (
            <div key={acc.game + acc.uid} className="about-table__row">
              <span className="about-table__game">
                <Icon name={acc.icon} size={15} />
                {acc.game}
              </span>
              <span className="about-table__uid">{acc.uid}</span>
              {acc.level && <span className="chip chip--accent">{acc.level}</span>}
            </div>
          ))}
        </div>
      </Reveal>

      {/* ---------- 推し ---------- */}
      <Reveal className="about-section" delay={180}>
        <div className="section-head">
          <h2 className="section-head__title">推し</h2>
          <span className="section-head__kana" lang="ja">
            推し
          </span>
        </div>
        <div className="about-oshi">
          <div className="glass about-oshi__group">
            <h3 className="about-composition__title">虚拟主播</h3>
            <div className="chip-row">
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
          <div className="glass about-oshi__group">
            <h3 className="about-composition__title">主推</h3>
            <div className="chip-row">
              {genshinChars.map((c) => (
                <span key={c.name} className="chip">
                  <Icon name={c.icon} size={12} />
                  {c.name}
                </span>
              ))}
            </div>
          </div>
          <div className="glass about-oshi__group">
            <h3 className="about-composition__title">副推</h3>
            <div className="chip-row">
              {subPush.map((c) => (
                <span key={c.name} className="chip">
                  <Icon name={c.icon} size={12} />
                  {c.name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </Reveal>
    </PageShell>
  )
}
