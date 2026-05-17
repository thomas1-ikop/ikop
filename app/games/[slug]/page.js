'use client'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { games } from '../../data/games'

const catColors = {
  Action:      { bg: '#fee2e2', border: '#f87171', text: '#991b1b' },
  Puzzle:      { bg: '#fef3c7', border: '#fbbf24', text: '#92400e' },
  Multiplayer: { bg: '#d1fae5', border: '#34d399', text: '#065f46' },
  Racing:      { bg: '#dbeafe', border: '#60a5fa', text: '#1e3a8a' },
  Sports:      { bg: '#fce7f3', border: '#f472b6', text: '#831843' },
  Zombie:      { bg: '#f0fdf4', border: '#86efac', text: '#166534' },
}

export default function GamePage() {
  const { slug } = useParams()
  const game = games.find(g => g.slug === slug)
  const related = games.filter(g => g.slug !== slug && g.category === game?.category).slice(0, 4)

  if (!game) {
    return (
      <div style={{ minHeight: '100vh', background: '#fafaf7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Patrick Hand, sans-serif' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '48px' }}>😅</p>
          <h1 style={{ fontFamily: 'Caveat, cursive', fontSize: '32px', color: '#5b21b6' }}>Game not found!</h1>
          <Link href="/" style={{ color: '#7c3aed', fontWeight: 700 }}>← Back to Ikop</Link>
        </div>
      </div>
    )
  }

  const c = catColors[game.category] || catColors.Action

  return (
    <div style={{ minHeight: '100vh', background: '#fafaf7', fontFamily: 'Patrick Hand, sans-serif', position: 'relative' }}>
      <div style={{ position: 'fixed', inset: 0, backgroundImage: 'linear-gradient(#e8eef7 1px, transparent 1px), linear-gradient(90deg, #e8eef7 1px, transparent 1px)', backgroundSize: '28px 28px', opacity: 0.7, pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'fixed', left: '52px', top: 0, bottom: 0, width: '2px', background: 'rgba(255,100,100,0.18)', pointerEvents: 'none', zIndex: 0 }} />

      <header style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(8px)', borderBottom: '2px solid #e0e8f0', padding: '10px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', border: '2.5px solid #c4b5fd', borderRadius: '14px', padding: '6px 16px 6px 12px', background: 'rgba(255,255,255,0.95)' }}>
          <span style={{ fontSize: '24px' }}>🎮</span>
          <span style={{ fontFamily: 'Caveat, cursive', fontSize: '30px', fontWeight: 700, background: 'linear-gradient(120deg,#7c3aed,#ec4899,#f59e0b)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>ikop</span>
        </Link>
        <Link href="/" style={{ color: '#7c3aed', fontWeight: 700, textDecoration: 'none', fontSize: '14px' }}>← Back to all games</Link>
      </header>

      <main style={{ position: 'relative', zIndex: 1, maxWidth: '1100px', margin: '0 auto', padding: '24px' }}>
        <div style={{ marginBottom: '12px' }}>
          <span style={{ background: c.bg, border: `2px solid ${c.border}`, borderRadius: '99px', padding: '4px 14px', fontSize: '12px', fontWeight: 700, color: c.text }}>{game.category}</span>
          {game.hot && <span style={{ marginLeft: '8px', background: '#fef3c7', border: '2px solid #fbbf24', borderRadius: '99px', padding: '4px 14px', fontSize: '12px', fontWeight: 700, color: '#92400e' }}>🔥 Hot</span>}
        </div>

        <h1 style={{ fontFamily: 'Caveat, cursive', fontSize: '36px', fontWeight: 700, color: '#1f2937', marginBottom: '16px' }}>{game.title}</h1>

        <div style={{ width: '100%', borderRadius: '20px', overflow: 'hidden', border: `3px solid ${c.border}`, boxShadow: '0 8px 32px rgba(0,0,0,0.1)', marginBottom: '20px', background: '#000' }}>
          <iframe
            src={game.url}
            title={game.title}
            width="100%"
            height="580"
            frameBorder="0"
            allowFullScreen
            scrolling="no"
            style={{ display: 'block' }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '32px' }}>
          <div style={{ background: 'white', borderRadius: '14px', border: `2px solid ${c.border}`, padding: '16px' }}>
            <h2 style={{ fontFamily: 'Caveat, cursive', fontSize: '20px', color: '#5b21b6', marginBottom: '8px' }}>About this game</h2>
            <p style={{ color: '#555', fontSize: '15px', lineHeight: 1.6 }}>{game.description}</p>
          </div>
          <div style={{ background: 'white', borderRadius: '14px', border: '2px solid #c4b5fd', padding: '16px' }}>
            <h2 style={{ fontFamily: 'Caveat, cursive', fontSize: '20px', color: '#5b21b6', marginBottom: '8px' }}>How to play</h2>
            <p style={{ color: '#555', fontSize: '15px', lineHeight: 1.6 }}>Use arrow keys or WASD to move. On mobile, use the on-screen touch controls. Have fun! 🎮</p>
          </div>
        </div>

        {related.length > 0 && (
          <>
            <h2 style={{ fontFamily: 'Caveat, cursive', fontSize: '22px', fontWeight: 700, color: '#5b21b6', marginBottom: '14px' }}>More {game.category} Games</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
              {related.map(g => {
                const rc = catColors[g.category] || catColors.Action
                return (
                  <Link key={g.slug} href={`/games/${g.slug}`} style={{ textDecoration: 'none' }}>
                    <div style={{ borderRadius: '12px', overflow: 'hidden', border: `2px solid ${rc.border}`, background: 'white', transition: 'transform 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                      onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
                      <div style={{ aspectRatio: '1', background: rc.bg, overflow: 'hidden' }}>
                        <img src={g.thumbnail} alt={g.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.target.style.display = 'none' }} />
                      </div>
                      <div style={{ padding: '8px 10px', borderTop: `3px solid ${rc.border}` }}>
                        <p style={{ fontWeight: 700, fontSize: '12px', color: '#222', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.title}</p>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </>
        )}
      </main>

      <footer style={{ position: 'relative', zIndex: 1, background: 'rgba(255,255,255,0.8)', borderTop: '2px solid #e0e8f0', padding: '20px 24px', textAlign: 'center', marginTop: '40px' }}>
        <p style={{ fontFamily: 'Caveat, cursive', fontSize: '24px', fontWeight: 700, background: 'linear-gradient(120deg,#7c3aed,#ec4899,#f59e0b)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: '0 0 4px' }}>ikop</p>
        <p style={{ color: '#999', fontSize: '13px' }}>© 2026 Ikop — Free Online Games. No download. No login. Just play.</p>
      </footer>
    </div>
  )
}