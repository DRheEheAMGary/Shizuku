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
      <Reveal className="prose about-intro">
        {profile.about.map((line) => (
          <p key={line}>{line}</p>
        ))}
        <p className="quote about-intro__quote">{profile.quote}</p>
      </Reveal>

      {/* ---------- 基本信息 ---------- */}
      <Reveal className="facts about-facts" delay={60}>
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
      </Reveal>

      {/* ---------- 成分 ---------- */}
      <Reveal className="section" delay={90}>
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
      </Reveal>

      {/* ---------- 游戏账号 ---------- */}
      <Reveal className="section" delay={120}>
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
                <span className="row__title">{acc.game}</span>
              </span>
              <span className="row__meta">{acc.uid}</span>
              {acc.level && <span className="chip chip--accent">{acc.level}</span>}
            </div>
          ))}
        </div>
      </Reveal>

      {/* ---------- 推し ---------- */}
      <Reveal className="section" delay={150}>
        <div className="section-head">
          <h2 className="section-head__title">推し</h2>
          <span className="section-head__kana" lang="ja">
            推し
          </span>
        </div>
        <div className="cols about-oshi">
          <div>
            <h3 className="cols__title">虚拟主播</h3>
            <div className="chips">
              {vtubers.map((c) => (
                <a key={c.name} className="chip" href={c.url} target="_blank" rel="noreferrer noopener">
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
      </Reveal>
    </PageShell>
  )
}
