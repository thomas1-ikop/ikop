'use client'
import { useState } from 'react'
import Link from 'next/link'
import { games } from './data/games'

const categories = ['All', 'Action', 'Puzzle', 'Multiplayer', 'Racing', 'Sports', 'Zombie', 'Shooting', 'Word', 'Adventure']
const catColors = {
  All:         { bg: '#FFFFFF', border: '#0000FF', text: '#5b21b6' },
  Action:      { bg: '#FFFFFF', border: '#0000ff', text: '#991b1b' },
  Puzzle:      { bg: '#FFFFFF', border: '#0000ff', text: '#92400e' },
  Multiplayer: { bg: '#FFFFFF', border: '#0000ff', text: '#065f46' },
  Racing:      { bg: '#FFFFFF', border: '#0000ff', text: '#1e3a8a' },
  Sports:      { bg: '#FFFFFF', border: '#0000ff', text: '#831843' },
  Zombie:      { bg: '#FFFFFF', border: '#0000ff', text: '#166534' },
  Shooting:    { bg: '#FFFFFF', border: '#0000ff', text: '#a8071a' },
  Word:        { bg: '#FFFFFF', border: '#0000ff', text: '#1d39c4' },
  Adventure:   { bg: '#FFFFFF', border: '#0000ff', text: '#ad4e00' },
}

const catBoxes = [
  { slug: 'sports',      label: 'Sports',     icon: '⚽', color: catColors.Sports },
  { slug: 'shooting',    label: 'Shooting',   icon: '🔫', color: catColors.Shooting },
  { slug: 'multiplayer', label: 'Multiplayer',icon: '👥', color: catColors.Multiplayer },
  { slug: 'zombie',      label: 'Zombie',     icon: '🧟', color: catColors.Zombie },
  { slug: 'puzzle',      label: 'Puzzle',     icon: '🧩', color: catColors.Puzzle },
  { slug: 'word',        label: 'Word',       icon: '📝', color: catColors.Word },
  { slug: 'adventure',   label: 'Adventure',  icon: '🗺️', color: catColors.Adventure },
  { slug: 'racing',      label: 'Racing',     icon: '🏎️', color: catColors.Racing },
  { slug: 'action',      label: 'Action',     icon: '⚡', color: catColors.Action },
]

export default function Home() {
  const [search, setSearch] = useState(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get('search') || ''
    }
    return ''
  })
  const [searchOpen, setSearchOpen] = useState(false)
  const [activeCategory, setActiveCategory] = useState('All')
  const [favorites, setFavorites] = useState(() => {
    if (typeof window !== 'undefined') {
      return JSON.parse(localStorage.getItem('ikop-favs') || '[]')
    }
    return []
  })

  const filtered = games.filter(g => {
    const matchCat = activeCategory === 'All' || g.category === activeCategory
    const matchSearch = g.title.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  const featured = games.filter(g => g.featured)
  const regular = filtered.filter(g => !g.featured)

  const toggleFav = (slug) => {
    const newFavs = favorites.includes(slug)
      ? favorites.filter(f => f !== slug)
      : [...favorites, slug]
    setFavorites(newFavs)
    localStorage.setItem('ikop-favs', JSON.stringify(newFavs))
  }

  return (
    <div style={{ minHeight: '100vh', background: '#fafaf7', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'fixed', inset: 0, backgroundImage: 'linear-gradient(#e8eef7 1px, transparent 1px), linear-gradient(90deg, #e8eef7 1px, transparent 1px)', backgroundSize: '28px 28px', opacity: 0.7, pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'fixed', left: '52px', top: 0, bottom: 0, width: '2px', background: 'rgba(255,100,100,0.18)', pointerEvents: 'none', zIndex: 0 }} />

      {/* HEADER */}
      <header style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(8px)', borderBottom: '2px solid #e0e8f0', padding: '10px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', border: '2.5px solid #c4b5fd', borderRadius: '14px', padding: '10px 24px', background: 'rgba(255,255,255,0.95)', overflow: 'visible' }}>
  <span style={{ fontSize: '24px', lineHeight: 1 }}>🎮</span>
  <span style={{ fontFamily: 'Caveat, cursive', fontSize: '28px', fontWeight: 700, background: 'linear-gradient(120deg,#7c3aed,#ec4899,#f59e0b)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', paddingRight: '4px' }}>ikop</span>
</div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f0f4ff', borderRadius: '99px', padding: '8px 18px', border: '1.5px solid #c4b5fd', transition: 'width 0.3s', width: searchOpen ? '320px' : '180px' }}>
          <span style={{ fontSize: '16px', cursor: 'pointer' }} onClick={() => setSearchOpen(!searchOpen)}>🔍</span>
          <input
            type="text"
            placeholder="Search games..."
            value={search}
            onChange={e => { setSearch(e.target.value); setSearchOpen(true) }}
            style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '14px', color: '#444', width: '100%', fontFamily: 'Patrick Hand, sans-serif' }}
          />
        </div>

        <button
          onClick={() => setActiveCategory('All')}
          style={{ background: '#fef3c7', border: '2px solid #f59e0b', borderRadius: '99px', padding: '7px 18px', fontSize: '14px', fontFamily: 'Patrick Hand, sans-serif', color: '#92400e', fontWeight: 700, cursor: 'pointer' }}>
          ⭐ Favorites ({favorites.length})
        </button>
        <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6738714121307819"
     crossorigin="anonymous"></script>
      </header>

      {/* CATEGORY BAR */}
      <div style={{ position: 'sticky', top: '65px', zIndex: 40, background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(6px)', borderBottom: '1.5px solid #e0e8f0', padding: '8px 24px', display: 'flex', gap: '8px', overflowX: 'auto' }}>
        {categories.map(cat => {
          const c = catColors[cat]
          const active = activeCategory === cat
          return (
            <button key={cat} onClick={() => setActiveCategory(cat)}
              style={{ background: active ? c.border : c.bg, border: `2px solid ${c.border}`, borderRadius: '99px', padding: '5px 16px', fontSize: '13px', fontWeight: 700, fontFamily: 'Patrick Hand, sans-serif', color: active ? 'white' : c.text, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s' }}>
              {cat}
            </button>
          )
        })}
      </div>

      {/* MAIN CONTENT */}
      <main style={{ position: 'relative', zIndex: 1, maxWidth: '1300px', margin: '0 auto', padding: '24px 24px 40px' }}>

        {/* FEATURED */}
        {activeCategory === 'All' && search === '' && (
          <>
            <h2 style={{ fontFamily: 'Caveat, cursive', fontSize: '22px', fontWeight: 700, color: '#5b21b6', marginBottom: '14px' }}>🔥 Featured Games</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '28px' }}>
              {featured.map((game, i) => {
                const c = catColors[game.category] || catColors.Action
                return (
                  <Link key={game.slug} href={`/games/${game.slug}`} style={{ textDecoration: 'none' }}>
                    <div style={{ borderRadius: '18px', overflow: 'hidden', border: `2.5px solid ${c.border}`, background: 'white', cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s', boxShadow: '0 4px 12px rgba(0,0,0,0.07)' }}
                      onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.04)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.13)' }}
                      onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.07)' }}>
                      <div style={{ width: '100%', aspectRatio: '16/9', background: c.bg, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <img src={game.thumbnail} alt={game.title} style={{ width: '100%', height: '100%', objectFit: 'contain' }} onError={e => { e.target.style.display = 'none' }} />
                      </div>
                      <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                          <p style={{ fontWeight: 700, fontSize: '15px', color: '#222', margin: 0 }}>{game.title} {game.hot && <span style={{ fontSize: '11px', background: '#fef3c7', color: '#92400e', borderRadius: '4px', padding: '1px 6px', marginLeft: '4px' }}>🔥 Hot</span>}</p>
                          <p style={{ fontSize: '12px', color: c.text, margin: '3px 0 0', fontWeight: 700 }}>{game.category}</p>
                        </div>
                        <button onClick={e => { e.preventDefault(); toggleFav(game.slug) }}
                          style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>
                          {favorites.includes(game.slug) ? '⭐' : '☆'}
                        </button>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </>
        )}

        {/* ALL GAMES GRID */}
        <h2 style={{ fontFamily: 'Caveat, cursive', fontSize: '20px', fontWeight: 700, color: '#374151', marginBottom: '14px' }}>
          {activeCategory === 'All' && search === '' ? '🕹️ More Games' : `🕹️ ${activeCategory === 'All' ? 'Search Results' : activeCategory + ' Games'}`}
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '14px', marginBottom: '36px' }}>
          {(search !== '' || activeCategory !== 'All' ? filtered : regular).map((game, i) => {
            const c = catColors[game.category] || catColors.Action
            return (
              <Link key={game.slug} href={`/games/${game.slug}`} style={{ textDecoration: 'none' }}>
                <div style={{ borderRadius: '14px', overflow: 'hidden', border: `2px solid ${c.border}`, background: 'white', cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.05)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.12)' }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)' }}>
                  <div style={{ width: '100%', aspectRatio: '1', background: c.bg, overflow: 'hidden' }}>
                    <img src={game.thumbnail} alt={game.title} style={{ width: '100%', height: '100%', objectFit: 'contain' }} onError={e => { e.target.style.display = 'none' }} />
                  </div>
                  <div style={{ padding: '8px 10px', borderTop: `3px solid ${c.border}` }}>
                    <p style={{ fontWeight: 700, fontSize: '13px', color: '#222', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{game.title}</p>
                    <p style={{ fontSize: '11px', color: c.text, margin: '2px 0 0', fontWeight: 700 }}>{game.category}</p>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>

        {/* CATEGORY BOXES */}
        {activeCategory === 'All' && search === '' && (
          <>
            <h2 style={{ fontFamily: 'Caveat, cursive', fontSize: '22px', fontWeight: 700, color: '#5b21b6', marginBottom: '14px' }}>🎮 Browse by Category</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '12px' }}>
              {catBoxes.map(box => (
                <button key={box.slug} onClick={() => setActiveCategory(box.label)}
                  style={{ borderRadius: '14px', border: `2.5px solid ${box.color.border}`, background: box.color.bg, padding: '18px 8px', textAlign: 'center', cursor: 'pointer', transition: 'transform 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
                  <span style={{ fontSize: '32px', display: 'block', marginBottom: '6px' }}>{box.icon}</span>
                  <span style={{ fontFamily: 'Caveat, cursive', fontSize: '16px', fontWeight: 700, color: box.color.text }}>{box.label}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </main>

      <footer style={{ position: 'relative', zIndex: 1, background: 'rgba(255,255,255,0.8)', borderTop: '2px solid #e0e8f0', padding: '20px 24px', textAlign: 'center' }}>
        <p style={{ fontFamily: 'Caveat, cursive', fontSize: '24px', fontWeight: 700, background: 'linear-gradient(120deg,#7c3aed,#ec4899,#f59e0b)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: '0 0 4px' }}>ikop</p>
        <p style={{ color: '#999', fontSize: '13px' }}>© 2026 Ikop — Free Online Games. No download. No login. Just play.</p>
      </footer>
    </div>
  )
}