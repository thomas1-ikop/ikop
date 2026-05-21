'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { games } from './data/games'

const categories = ['All', 'Action', 'Puzzle', 'Multiplayer', 'Racing', 'Sports', 'Zombie', 'Shooting', 'Word', 'Adventure']

const catColors = {
  All:         { bg: '#f3f4f6', border: '#d1d5db', text: '#374151' },
  Action:      { bg: '#fee2e2', border: '#fca5a5', text: '#991b1b' },
  Puzzle:      { bg: '#fef9c3', border: '#fde047', text: '#854d0e' },
  Multiplayer: { bg: '#dcfce7', border: '#86efac', text: '#166534' },
  Racing:      { bg: '#dbeafe', border: '#93c5fd', text: '#1e40af' },
  Sports:      { bg: '#fce7f3', border: '#f9a8d4', text: '#9d174d' },
  Zombie:      { bg: '#f0fdf4', border: '#86efac', text: '#166534' },
  Shooting:    { bg: '#fff1f2', border: '#fda4af', text: '#9f1239' },
  Word:        { bg: '#eff6ff', border: '#93c5fd', text: '#1e40af' },
  Adventure:   { bg: '#fff7ed', border: '#fdba74', text: '#9a3412' },
}

const cardBorderColors = [
  '#f87171', '#fb923c', '#fbbf24', '#34d399', '#60a5fa',
  '#a78bfa', '#f472b6', '#38bdf8', '#4ade80', '#facc15',
]

const sections = [
  { id: 'featured',    label: '🔥 Featured',         filter: g => g.featured },
  { id: 'hot',         label: '⚡ Trending Now',      filter: g => g.hot },
  { id: 'action',      label: '💥 Action Games',      filter: g => g.category === 'Action' },
  { id: 'sports',      label: '⚽ Sports Games',      filter: g => g.category === 'Sports' },
  { id: 'puzzle',      label: '🧩 Puzzle & Brain',    filter: g => g.category === 'Puzzle' },
  { id: 'multiplayer', label: '👥 Multiplayer',        filter: g => g.category === 'Multiplayer' },
  { id: 'racing',      label: '🏎️ Racing Games',      filter: g => g.category === 'Racing' },
  { id: 'shooting',    label: '🔫 Shooting Games',    filter: g => g.category === 'Shooting' },
  { id: 'word',        label: '📝 Word Games',        filter: g => g.category === 'Word' },
  { id: 'adventure',   label: '🗺️ Adventure',         filter: g => g.category === 'Adventure' },
  { id: 'zombie',      label: '🧟 Zombie Games',      filter: g => g.category === 'Zombie' },
  { id: 'originals',   label: '⭐ Ikop Originals',    filter: g => g.slug === 'ikop-survival' },
]

function GameCard({ game, index, favorites, toggleFav, big = false }) {
  const borderColor = cardBorderColors[index % cardBorderColors.length]
  const [hovered, setHovered] = useState(false)

  return (
    <div style={{ position: 'relative' }}>
      <Link href={`/games/${game.slug}`} style={{ textDecoration: 'none', display: 'block' }}>
        <div
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{
            borderRadius: '16px',
            overflow: 'hidden',
            background: 'white',
            boxShadow: hovered
              ? `0 8px 30px rgba(0,0,0,0.18), 0 0 0 3px ${borderColor}`
              : `0 2px 8px rgba(0,0,0,0.08), 0 0 0 2px ${borderColor}`,
            transform: hovered ? 'translateY(-4px) scale(1.02)' : 'translateY(0) scale(1)',
            transition: 'all 0.2s ease',
            cursor: 'pointer',
          }}>
          <div style={{
            width: '100%',
            aspectRatio: big ? '16/9' : '1',
            background: `linear-gradient(135deg, ${borderColor}22, ${borderColor}11)`,
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}>
            <img
              src={game.thumbnail}
              alt={game.title}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              onError={e => {
                e.target.style.display = 'none'
                e.target.nextSibling.style.display = 'flex'
              }}
            />
            <div style={{
              display: 'none',
              position: 'absolute', inset: 0,
              alignItems: 'center', justifyContent: 'center',
              flexDirection: 'column', gap: '8px',
              background: `linear-gradient(135deg, ${borderColor}33, ${borderColor}11)`,
            }}>
              <span style={{ fontSize: big ? '48px' : '32px' }}>🎮</span>
              <span style={{ fontSize: '11px', color: '#666', fontWeight: 600 }}>{game.title}</span>
            </div>
            {game.hot && (
              <div style={{
                position: 'absolute', top: '8px', left: '8px',
                background: 'linear-gradient(135deg,#ff6b6b,#ffd93d)',
                borderRadius: '99px', padding: '3px 10px',
                fontSize: '10px', fontWeight: 700, color: 'white',
                boxShadow: '0 2px 8px rgba(255,107,107,0.4)',
              }}>🔥 HOT</div>
            )}
          </div>
          <div style={{
            padding: big ? '12px 14px' : '8px 10px',
            borderTop: `3px solid ${borderColor}`,
            background: 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                fontWeight: 700,
                fontSize: big ? '15px' : '12px',
                color: '#111',
                margin: 0,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                fontFamily: 'Patrick Hand, sans-serif',
              }}>{game.title}</p>
              <p style={{
                fontSize: big ? '12px' : '10px',
                color: borderColor,
                margin: '2px 0 0',
                fontWeight: 700,
                fontFamily: 'Patrick Hand, sans-serif',
              }}>{game.category}</p>
            </div>
            <button
              onClick={e => { e.preventDefault(); toggleFav(game.slug) }}
              style={{
                background: 'none', border: 'none',
                fontSize: big ? '20px' : '16px',
                cursor: 'pointer', padding: '2px 4px',
                flexShrink: 0,
              }}>
              {favorites.includes(game.slug) ? '⭐' : '☆'}
            </button>
          </div>
        </div>
      </Link>
    </div>
  )
}

function GameSection({ section, favorites, toggleFav, search, activeCategory }) {
  const sectionGames = section.filter(games).filter(g => {
    const matchSearch = g.title.toLowerCase().includes(search.toLowerCase())
    const matchCat = activeCategory === 'All' || g.category === activeCategory
    return matchSearch && matchCat
  })
  if (sectionGames.length === 0) return null
  const isFeatured = section.id === 'featured'

  return (
    <div style={{ marginBottom: '32px' }}>
      <h2 style={{
        fontFamily: 'Caveat, cursive',
        fontSize: '22px', fontWeight: 700,
        color: '#1f2937', marginBottom: '14px',
        display: 'flex', alignItems: 'center', gap: '8px',
      }}>{section.label}</h2>
      {isFeatured ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
          {sectionGames.slice(0, 3).map((game, i) => (
            <GameCard key={game.slug} game={game} index={i} favorites={favorites} toggleFav={toggleFav} big />
          ))}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px' }}>
          {sectionGames.slice(0, 10).map((game, i) => (
            <GameCard key={game.slug} game={game} index={i} favorites={favorites} toggleFav={toggleFav} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function Home() {
  const [search, setSearch] = useState(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get('search') || ''
    }
    return ''
  })
  const [searchOpen, setSearchOpen] = useState(false)
  const [activeCategory, setActiveCategory] = useState('All')
  const [favorites, setFavorites] = useState([])
  const [showFavorites, setShowFavorites] = useState(false)

  useEffect(() => {
    try {
      setFavorites(JSON.parse(localStorage.getItem('ikop-favs') || '[]'))
    } catch {}
  }, [])

  const toggleFav = (slug) => {
    const newFavs = favorites.includes(slug)
      ? favorites.filter(f => f !== slug)
      : [...favorites, slug]
    setFavorites(newFavs)
    try { localStorage.setItem('ikop-favs', JSON.stringify(newFavs)) } catch {}
  }

  const favGames = games.filter(g => favorites.includes(g.slug))

  const visibleSections = search !== '' || activeCategory !== 'All'
    ? [{ id: 'search', label: `🔍 Results`, filter: g => {
        const matchSearch = g.title.toLowerCase().includes(search.toLowerCase())
        const matchCat = activeCategory === 'All' || g.category === activeCategory
        return matchSearch && matchCat
      }}]
    : sections.filter(s => {
        const filtered = s.filter(games)
        return filtered.length > 0
      })

  return (
    <div style={{ minHeight: '100vh', background: '#f8f9ff', position: 'relative' }}>
      <div style={{ position: 'fixed', inset: 0, backgroundImage: 'linear-gradient(#e8eef7 1px, transparent 1px), linear-gradient(90deg, #e8eef7 1px, transparent 1px)', backgroundSize: '28px 28px', opacity: 0.5, pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'fixed', left: '52px', top: 0, bottom: 0, width: '2px', background: 'rgba(255,100,100,0.15)', pointerEvents: 'none', zIndex: 0 }} />

      {/* HEADER */}
      <header style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #e5e7eb', padding: '10px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', border: '2px solid #e0d7ff', borderRadius: '14px', padding: '6px 16px 6px 12px', background: 'white', flexShrink: 0 }}>
          <span style={{ fontSize: '20px' }}>🎮</span>
          <span style={{ fontFamily: 'Caveat, cursive', fontSize: '26px', fontWeight: 700, background: 'linear-gradient(120deg,#7c3aed,#ec4899,#f59e0b)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>ikop</span>
        </div>

        <div style={{ flex: 1, maxWidth: '500px', display: 'flex', alignItems: 'center', gap: '8px', background: '#f3f4f6', borderRadius: '99px', padding: '8px 18px', border: '2px solid #e5e7eb', transition: 'border-color 0.2s' }}
          onFocus={() => setSearchOpen(true)} onBlur={() => setSearchOpen(false)}>
          <span style={{ fontSize: '16px', color: '#9ca3af' }}>🔍</span>
          <input
            type="text"
            placeholder="Search games..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '14px', color: '#374151', width: '100%', fontFamily: 'Patrick Hand, sans-serif' }}
          />
          {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '16px', padding: 0 }}>✕</button>}
        </div>

        <button
          onClick={() => setShowFavorites(!showFavorites)}
          style={{ background: favorites.length > 0 ? '#fef3c7' : '#f3f4f6', border: `2px solid ${favorites.length > 0 ? '#fbbf24' : '#e5e7eb'}`, borderRadius: '99px', padding: '8px 18px', fontSize: '14px', fontFamily: 'Patrick Hand, sans-serif', color: favorites.length > 0 ? '#92400e' : '#6b7280', fontWeight: 700, cursor: 'pointer', flexShrink: 0, transition: 'all 0.2s' }}>
          ⭐ Favorites {favorites.length > 0 && `(${favorites.length})`}
        </button>
      </header>

      {/* CATEGORY BAR */}
      <div style={{ position: 'sticky', top: '61px', zIndex: 40, background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(8px)', borderBottom: '1px solid #e5e7eb', padding: '8px 24px', display: 'flex', gap: '6px', overflowX: 'auto', scrollbarWidth: 'none' }}>
        {categories.map(cat => {
          const active = activeCategory === cat
          return (
            <button key={cat} onClick={() => setActiveCategory(cat)}
              style={{
                background: active ? '#7c3aed' : '#f3f4f6',
                border: `1.5px solid ${active ? '#7c3aed' : '#e5e7eb'}`,
                borderRadius: '99px',
                padding: '5px 16px',
                fontSize: '13px',
                fontWeight: 600,
                fontFamily: 'Patrick Hand, sans-serif',
                color: active ? 'white' : '#4b5563',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s',
                flexShrink: 0,
              }}>
              {cat}
            </button>
          )
        })}
      </div>

      {/* FAVORITES PANEL */}
      {showFavorites && (
        <div style={{ position: 'relative', zIndex: 1, maxWidth: '1300px', margin: '0 auto', padding: '24px 24px 0' }}>
          <div style={{ background: 'white', borderRadius: '20px', border: '2px solid #fbbf24', padding: '20px', marginBottom: '24px', boxShadow: '0 4px 20px rgba(251,191,36,0.15)' }}>
            <h2 style={{ fontFamily: 'Caveat, cursive', fontSize: '24px', fontWeight: 700, color: '#92400e', marginBottom: '16px' }}>⭐ Your Favorites</h2>
            {favGames.length === 0 ? (
              <p style={{ color: '#9ca3af', fontSize: '15px', textAlign: 'center', padding: '20px 0' }}>No favorites yet! Click the ☆ on any game to save it here.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '10px' }}>
                {favGames.map((game, i) => (
                  <GameCard key={game.slug} game={game} index={i} favorites={favorites} toggleFav={toggleFav} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MAIN */}
      <main style={{ position: 'relative', zIndex: 1, maxWidth: '1300px', margin: '0 auto', padding: '24px' }}>
        {visibleSections.map(section => (
          <GameSection
            key={section.id}
            section={section}
            favorites={favorites}
            toggleFav={toggleFav}
            search={search}
            activeCategory={activeCategory}
          />
        ))}
      </main>

      <footer style={{ position: 'relative', zIndex: 1, background: 'white', borderTop: '1px solid #e5e7eb', padding: '24px', textAlign: 'center', marginTop: '20px' }}>
        <p style={{ fontFamily: 'Caveat, cursive', fontSize: '26px', fontWeight: 700, background: 'linear-gradient(120deg,#7c3aed,#ec4899,#f59e0b)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: '0 0 6px' }}>ikop</p>
        <p style={{ color: '#9ca3af', fontSize: '13px', margin: 0 }}>© 2026 Ikop — Free Online Games. No download. No login. Just play.</p>
      </footer>
    </div>
  )
}