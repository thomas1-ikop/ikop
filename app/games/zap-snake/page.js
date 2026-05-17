'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

const GRID = 20
const CELL = 24
const WIDTH = GRID * CELL
const HEIGHT = GRID * CELL

const POWERUPS = {
  SPEED: { color: '#ffd93d', emoji: '⚡', label: 'Speed Boost', duration: 5000 },
  SLOW:  { color: '#6bcb77', emoji: '🐢', label: 'Slow Motion', duration: 5000 },
  BOMB:  { color: '#ff6b6b', emoji: '💣', label: 'Bomb',        duration: 0    },
  GHOST: { color: '#a78bfa', emoji: '👻', label: 'Ghost Mode',  duration: 4000 },
  DOUBLE:{ color: '#f59e0b', emoji: '2x', label: 'Double Score',duration: 6000 },
}

function randomCell(exclude = []) {
  let cell
  do {
    cell = { x: Math.floor(Math.random() * GRID), y: Math.floor(Math.random() * GRID) }
  } while (exclude.some(e => e.x === cell.x && e.y === cell.y))
  return cell
}

export default function ZapSnake() {
  const canvasRef = useRef(null)
  const stateRef = useRef({
    snake: [{ x: 10, y: 10 }],
    dir: { x: 1, y: 0 },
    nextDir: { x: 1, y: 0 },
    food: { x: 15, y: 10 },
    powerup: null,
    powerupType: null,
    score: 0,
    highScore: 0,
    active: { SPEED: false, SLOW: false, GHOST: false, DOUBLE: false },
    baseInterval: 140,
    interval: 140,
    running: false,
    dead: false,
    started: false,
  })
  const [display, setDisplay] = useState({ score: 0, highScore: 0, active: {}, dead: false, started: false })
  const loopRef = useRef(null)

  const getHS = () => {
    try { return parseInt(localStorage.getItem('zap-snake-hs') || '0') } catch { return 0 }
  }
  const setHS = (s) => {
    try { localStorage.setItem('zap-snake-hs', String(s)) } catch {}
  }

  const draw = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const s = stateRef.current

    ctx.fillStyle = '#fafaf7'
    ctx.fillRect(0, 0, WIDTH, HEIGHT)

    for (let x = 0; x < GRID; x++) {
      for (let y = 0; y < GRID; y++) {
        ctx.strokeStyle = '#e8eef7'
        ctx.lineWidth = 0.5
        ctx.strokeRect(x * CELL, y * CELL, CELL, CELL)
      }
    }

    // food
    ctx.fillStyle = '#ff6b6b'
    ctx.beginPath()
    ctx.arc(s.food.x * CELL + CELL / 2, s.food.y * CELL + CELL / 2, CELL / 2 - 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = 'white'
    ctx.font = `${CELL - 6}px serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('🍎', s.food.x * CELL + CELL / 2, s.food.y * CELL + CELL / 2)

    // powerup
    if (s.powerup) {
      const pt = POWERUPS[s.powerupType]
      ctx.fillStyle = pt.color
      ctx.beginPath()
      ctx.roundRect(s.powerup.x * CELL + 1, s.powerup.y * CELL + 1, CELL - 2, CELL - 2, 6)
      ctx.fill()
      ctx.font = `${CELL - 8}px serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(pt.emoji, s.powerup.x * CELL + CELL / 2, s.powerup.y * CELL + CELL / 2)
    }

    // snake
    s.snake.forEach((seg, i) => {
      const isHead = i === 0
      const ghost = s.active.GHOST
      ctx.globalAlpha = ghost ? 0.5 : 1
      if (isHead) {
        ctx.fillStyle = '#7c3aed'
      } else {
        const t = i / s.snake.length
        ctx.fillStyle = `hsl(${270 - t * 60}, 70%, ${55 + t * 15}%)`
      }
      ctx.beginPath()
      ctx.roundRect(seg.x * CELL + 1, seg.y * CELL + 1, CELL - 2, CELL - 2, isHead ? 8 : 5)
      ctx.fill()
      ctx.globalAlpha = 1
    })

    // eyes on head
    const head = s.snake[0]
    ctx.fillStyle = 'white'
    ctx.beginPath()
    ctx.arc(head.x * CELL + 7, head.y * CELL + 8, 3, 0, Math.PI * 2)
    ctx.arc(head.x * CELL + 17, head.y * CELL + 8, 3, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#1f2937'
    ctx.beginPath()
    ctx.arc(head.x * CELL + 8, head.y * CELL + 8, 1.5, 0, Math.PI * 2)
    ctx.arc(head.x * CELL + 18, head.y * CELL + 8, 1.5, 0, Math.PI * 2)
    ctx.fill()
  }

  const tick = () => {
    const s = stateRef.current
    if (!s.running) return

    s.dir = s.nextDir
    const head = { x: s.snake[0].x + s.dir.x, y: s.snake[0].y + s.dir.y }

    const hitWall = head.x < 0 || head.x >= GRID || head.y < 0 || head.y >= GRID
    const hitSelf = !s.active.GHOST && s.snake.some(seg => seg.x === head.x && seg.y === head.y)

    if (hitWall || hitSelf) {
      s.running = false
      s.dead = true
      if (s.score > s.highScore) {
        s.highScore = s.score
        setHS(s.score)
      }
      clearInterval(loopRef.current)
      setDisplay(d => ({ ...d, dead: true, score: s.score, highScore: s.highScore }))
      return
    }

    s.snake.unshift(head)

    let ate = false
    if (head.x === s.food.x && head.y === s.food.y) {
      ate = true
      const points = s.active.DOUBLE ? 2 : 1
      s.score += points
      s.food = randomCell(s.snake)
      if (Math.random() < 0.3 && !s.powerup) {
        const types = Object.keys(POWERUPS)
        s.powerupType = types[Math.floor(Math.random() * types.length)]
        s.powerup = randomCell([...s.snake, s.food])
      }
    }

    if (!ate) s.snake.pop()

    if (s.powerup && head.x === s.powerup.x && head.y === s.powerup.y) {
      const type = s.powerupType
      s.powerup = null
      s.powerupType = null

      if (type === 'BOMB') {
        const keep = Math.max(3, Math.floor(s.snake.length / 2))
        s.snake = s.snake.slice(0, keep)
        s.score = Math.max(0, s.score - 3)
      } else if (type === 'SPEED') {
        s.active.SPEED = true
        s.interval = Math.max(60, s.baseInterval - 60)
        restartLoop()
        setTimeout(() => { s.active.SPEED = false; s.interval = s.baseInterval; restartLoop() }, POWERUPS.SPEED.duration)
      } else if (type === 'SLOW') {
        s.active.SLOW = true
        s.interval = s.baseInterval + 80
        restartLoop()
        setTimeout(() => { s.active.SLOW = false; s.interval = s.baseInterval; restartLoop() }, POWERUPS.SLOW.duration)
      } else if (type === 'GHOST') {
        s.active.GHOST = true
        setTimeout(() => { s.active.GHOST = false }, POWERUPS.GHOST.duration)
      } else if (type === 'DOUBLE') {
        s.active.DOUBLE = true
        setTimeout(() => { s.active.DOUBLE = false }, POWERUPS.DOUBLE.duration)
      }
    }

    setDisplay(d => ({ ...d, score: s.score, active: { ...s.active } }))
    draw()
  }

  const restartLoop = () => {
    clearInterval(loopRef.current)
    loopRef.current = setInterval(tick, stateRef.current.interval)
  }

  const startGame = () => {
    const hs = getHS()
    stateRef.current = {
      snake: [{ x: 10, y: 10 }],
      dir: { x: 1, y: 0 },
      nextDir: { x: 1, y: 0 },
      food: randomCell([{ x: 10, y: 10 }]),
      powerup: null,
      powerupType: null,
      score: 0,
      highScore: hs,
      active: { SPEED: false, SLOW: false, GHOST: false, DOUBLE: false },
      baseInterval: 140,
      interval: 140,
      running: true,
      dead: false,
      started: true,
    }
    setDisplay({ score: 0, highScore: hs, active: {}, dead: false, started: true })
    clearInterval(loopRef.current)
    loopRef.current = setInterval(tick, 140)
    draw()
  }

  useEffect(() => {
    const hs = getHS()
    stateRef.current.highScore = hs
    setDisplay(d => ({ ...d, highScore: hs }))
    draw()

    const handleKey = (e) => {
      const s = stateRef.current
      if (!s.running) return
      const map = {
        ArrowUp:    { x: 0,  y: -1 },
        ArrowDown:  { x: 0,  y: 1  },
        ArrowLeft:  { x: -1, y: 0  },
        ArrowRight: { x: 1,  y: 0  },
        w: { x: 0,  y: -1 },
        s: { x: 0,  y: 1  },
        a: { x: -1, y: 0  },
        d: { x: 1,  y: 0  },
      }
      const newDir = map[e.key]
      if (!newDir) return
      if (newDir.x === -s.dir.x && newDir.y === -s.dir.y) return
      s.nextDir = newDir
      e.preventDefault()
    }
    window.addEventListener('keydown', handleKey)
    return () => {
      window.removeEventListener('keydown', handleKey)
      clearInterval(loopRef.current)
    }
  }, [])

  // mobile swipe
  const touchStart = useRef(null)
  const handleTouchStart = (e) => { touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY } }
  const handleTouchEnd = (e) => {
    if (!touchStart.current) return
    const dx = e.changedTouches[0].clientX - touchStart.current.x
    const dy = e.changedTouches[0].clientY - touchStart.current.y
    const s = stateRef.current
    if (!s.running) return
    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > 20 && s.dir.x !== -1) s.nextDir = { x: 1, y: 0 }
      if (dx < -20 && s.dir.x !== 1) s.nextDir = { x: -1, y: 0 }
    } else {
      if (dy > 20 && s.dir.y !== -1) s.nextDir = { x: 0, y: 1 }
      if (dy < -20 && s.dir.y !== 1) s.nextDir = { x: 0, y: -1 }
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#fafaf7', fontFamily: 'Patrick Hand, sans-serif', position: 'relative' }}>
      <div style={{ position: 'fixed', inset: 0, backgroundImage: 'linear-gradient(#e8eef7 1px, transparent 1px), linear-gradient(90deg, #e8eef7 1px, transparent 1px)', backgroundSize: '28px 28px', opacity: 0.7, pointerEvents: 'none', zIndex: 0 }} />

      <header style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(8px)', borderBottom: '2px solid #e0e8f0', padding: '10px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', border: '2.5px solid #c4b5fd', borderRadius: '14px', padding: '10px 24px 10px 16px', background: 'rgba(255,255,255,0.95)' }}>
          <span style={{ fontSize: '24px' }}>🎮</span>
          <span style={{ fontFamily: 'Caveat, cursive', fontSize: '28px', fontWeight: 700, background: 'linear-gradient(120deg,#7c3aed,#ec4899,#f59e0b)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', paddingRight: '4px' }}>ikop</span>
        </Link>
        <Link href="/" style={{ color: '#7c3aed', fontWeight: 700, textDecoration: 'none', fontSize: '14px' }}>← Back to all games</Link>
      </header>

      <main style={{ position: 'relative', zIndex: 1, maxWidth: '900px', margin: '0 auto', padding: '24px' }}>
        <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ background: '#ede9fe', border: '2px solid #a78bfa', borderRadius: '99px', padding: '4px 14px', fontSize: '12px', fontWeight: 700, color: '#5b21b6' }}>Action</span>
          <span style={{ background: '#fef3c7', border: '2px solid #fbbf24', borderRadius: '99px', padding: '4px 14px', fontSize: '12px', fontWeight: 700, color: '#92400e' }}>⭐ Ikop Original</span>
        </div>

        <h1 style={{ fontFamily: 'Caveat, cursive', fontSize: '36px', fontWeight: 700, color: '#1f2937', marginBottom: '16px' }}>⚡ Zap Snake</h1>

        <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            <canvas
              ref={canvasRef}
              width={WIDTH}
              height={HEIGHT}
              style={{ borderRadius: '16px', border: '3px solid #a78bfa', boxShadow: '0 8px 32px rgba(124,58,237,0.15)', display: 'block', touchAction: 'none' }}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            />

            {!display.started && (
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(250,250,247,0.95)', borderRadius: '14px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
                <p style={{ fontFamily: 'Caveat, cursive', fontSize: '48px', fontWeight: 700, color: '#7c3aed', margin: 0 }}>⚡ Zap Snake</p>
                <p style={{ color: '#555', fontSize: '16px', textAlign: 'center', maxWidth: '260px', margin: 0 }}>Eat apples, collect powerups, don't crash!</p>
                <p style={{ color: '#888', fontSize: '13px', margin: 0 }}>🏆 Best: {display.highScore}</p>
                <button onClick={startGame} style={{ background: 'linear-gradient(135deg, #7c3aed, #ec4899)', color: 'white', border: 'none', borderRadius: '99px', padding: '12px 32px', fontSize: '18px', fontFamily: 'Caveat, cursive', fontWeight: 700, cursor: 'pointer' }}>
                  Play Now!
                </button>
                <p style={{ color: '#aaa', fontSize: '12px', margin: 0 }}>Arrow keys or WASD • Swipe on mobile</p>
              </div>
            )}

            {display.dead && (
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(250,250,247,0.95)', borderRadius: '14px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
                <p style={{ fontFamily: 'Caveat, cursive', fontSize: '48px', margin: 0 }}>💀</p>
                <p style={{ fontFamily: 'Caveat, cursive', fontSize: '32px', fontWeight: 700, color: '#7c3aed', margin: 0 }}>Game Over!</p>
                <p style={{ fontSize: '20px', color: '#333', margin: 0 }}>Score: <strong>{display.score}</strong></p>
                <p style={{ fontSize: '16px', color: '#888', margin: 0 }}>🏆 Best: {display.highScore}</p>
                <button onClick={startGame} style={{ background: 'linear-gradient(135deg, #7c3aed, #ec4899)', color: 'white', border: 'none', borderRadius: '99px', padding: '12px 32px', fontSize: '18px', fontFamily: 'Caveat, cursive', fontWeight: 700, cursor: 'pointer' }}>
                  Play Again!
                </button>
              </div>
            )}
          </div>

          <div style={{ flex: 1, minWidth: '200px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ background: 'white', borderRadius: '14px', border: '2px solid #a78bfa', padding: '16px', textAlign: 'center' }}>
              <p style={{ color: '#888', fontSize: '13px', margin: '0 0 4px' }}>Score</p>
              <p style={{ fontFamily: 'Caveat, cursive', fontSize: '42px', fontWeight: 700, color: '#7c3aed', margin: 0 }}>{display.score}</p>
            </div>
            <div style={{ background: 'white', borderRadius: '14px', border: '2px solid #fbbf24', padding: '16px', textAlign: 'center' }}>
              <p style={{ color: '#888', fontSize: '13px', margin: '0 0 4px' }}>🏆 Best</p>
              <p style={{ fontFamily: 'Caveat, cursive', fontSize: '32px', fontWeight: 700, color: '#f59e0b', margin: 0 }}>{display.highScore}</p>
            </div>

            <div style={{ background: 'white', borderRadius: '14px', border: '2px solid #e0e8f0', padding: '16px' }}>
              <p style={{ fontFamily: 'Caveat, cursive', fontSize: '16px', fontWeight: 700, color: '#5b21b6', margin: '0 0 10px' }}>Powerups</p>
              {Object.entries(POWERUPS).map(([key, val]) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', opacity: display.active?.[key] ? 1 : 0.4 }}>
                  <span style={{ fontSize: '18px' }}>{val.emoji}</span>
                  <div>
                    <p style={{ fontSize: '13px', fontWeight: 700, color: '#333', margin: 0 }}>{val.label}</p>
                    {display.active?.[key] && <p style={{ fontSize: '11px', color: '#7c3aed', margin: 0 }}>ACTIVE!</p>}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ background: 'white', borderRadius: '14px', border: '2px solid #e0e8f0', padding: '16px' }}>
              <p style={{ fontFamily: 'Caveat, cursive', fontSize: '16px', fontWeight: 700, color: '#5b21b6', margin: '0 0 8px' }}>Controls</p>
              <p style={{ fontSize: '13px', color: '#555', margin: '0 0 4px' }}>⬆️⬇️⬅️➡️ Arrow Keys</p>
              <p style={{ fontSize: '13px', color: '#555', margin: '0 0 4px' }}>WASD Keys</p>
              <p style={{ fontSize: '13px', color: '#555', margin: 0 }}>📱 Swipe on mobile</p>
            </div>
          </div>
        </div>
      </main>

      <footer style={{ position: 'relative', zIndex: 1, background: 'rgba(255,255,255,0.8)', borderTop: '2px solid #e0e8f0', padding: '20px 24px', textAlign: 'center', marginTop: '40px' }}>
        <p style={{ fontFamily: 'Caveat, cursive', fontSize: '24px', fontWeight: 700, background: 'linear-gradient(120deg,#7c3aed,#ec4899,#f59e0b)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: '0 0 4px' }}>ikop</p>
        <p style={{ color: '#999', fontSize: '13px' }}>© 2026 Ikop — Free Online Games. No download. No login. Just play.</p>
      </footer>
    </div>
  )
}