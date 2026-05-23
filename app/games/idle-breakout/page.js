'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { games } from '../../data/games'
import AdSlot from '../../components/AdSlot'

const COLS = 10
const ROWS = 10
const BRICK_W = 72
const BRICK_H = 36
const CANVAS_W = 800
const CANVAS_H = 520
const MARGIN_TOP = 60

const BALL_TYPES = [
  { id: 'basic',    name: 'Basic Ball',   color: '#f59e0b', cost: 25,    baseDmg: 1,    baseSpd: 150, desc: 'Simple ball. Deals 1 damage per hit.' },
  { id: 'plasma',   name: 'Plasma Ball',  color: '#ec4899', cost: 500,   baseDmg: 5,    baseSpd: 180, desc: 'Energized plasma. Deals 5 damage per hit.' },
  { id: 'sniper',   name: 'Sniper Ball',  color: '#3b82f6', cost: 2000,  baseDmg: 20,   baseSpd: 280, desc: 'Fast and precise. Deals 20 damage per hit.' },
  { id: 'scatter',  name: 'Scatter Ball', color: '#10b981', cost: 8000,  baseDmg: 8,    baseSpd: 160, desc: 'Splits into 3 on bounce. Deals 8 damage each.' },
  { id: 'cannon',   name: 'Cannon Ball',  color: '#6b7280', cost: 30000, baseDmg: 100,  baseSpd: 120, desc: 'Massive damage. Deals 100 per hit.' },
  { id: 'poison',   name: 'Poison Ball',  color: '#ef4444', cost: 100000,baseDmg: 50,   baseSpd: 170, desc: 'Poisons bricks. Deals 50 + 10/sec poison.' },
]

function formatNum(n) {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B'
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K'
  return Math.floor(n).toString()
}

function makeBricks(level) {
  const bricks = []
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const baseHp = Math.floor(10 * Math.pow(1.15, level + r))
      bricks.push({
        row: r, col: c,
        x: c * BRICK_W + (CANVAS_W - COLS * BRICK_W) / 2,
        y: MARGIN_TOP + r * BRICK_H,
        hp: baseHp, maxHp: baseHp,
        poisonTimer: 0, poisoned: false,
        color: `hsl(${(r * 36 + c * 12) % 360}, 70%, 55%)`,
        alive: true,
      })
    }
  }
  return bricks
}

function makeBall(type, index) {
  const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.8
  return {
    id: Math.random(),
    type: type.id,
    color: type.color,
    x: CANVAS_W / 2 + (Math.random() - 0.5) * 200,
    y: CANVAS_H - 30,
    vx: Math.cos(angle) * type.baseSpd,
    vy: Math.sin(angle) * type.baseSpd,
    r: type.id === 'cannon' ? 12 : type.id === 'sniper' ? 6 : 9,
    dmg: type.baseDmg,
    spd: type.baseSpd,
    typeRef: type,
    upgrade: 1,
  }
}

export default function IdleBreakout() {
  const canvasRef = useRef(null)
  const rafRef = useRef(null)
  const stateRef = useRef(null)
  const lastTimeRef = useRef(performance.now())
  const [money, setMoney] = useState(0)
  const [level, setLevel] = useState(1)
  const [balls, setBalls] = useState([])
  const [tab, setTab] = useState('buy')
  const [tick, setTick] = useState(0)
  const [clickPower, setClickPower] = useState(1)
  const [totalEarned, setTotalEarned] = useState(0)

  const getHS = () => { try { return parseFloat(localStorage.getItem('ib-money') || '0') } catch { return 0 } }
  const save = (m, b, l, cp) => {
    try {
      localStorage.setItem('ib-money', String(m))
      localStorage.setItem('ib-balls', JSON.stringify(b))
      localStorage.setItem('ib-level', String(l))
      localStorage.setItem('ib-cp', String(cp))
    } catch {}
  }
  const load = () => {
    try {
      return {
        money: parseFloat(localStorage.getItem('ib-money') || '0'),
        ballDefs: JSON.parse(localStorage.getItem('ib-balls') || '[]'),
        level: parseInt(localStorage.getItem('ib-level') || '1'),
        clickPower: parseFloat(localStorage.getItem('ib-cp') || '1'),
      }
    } catch { return { money: 0, ballDefs: [], level: 1, clickPower: 1 } }
  }

  useEffect(() => {
    const saved = load()
    const initialBalls = saved.ballDefs.map(bd => {
      const type = BALL_TYPES.find(t => t.id === bd.typeId) || BALL_TYPES[0]
      const b = makeBall(type, 0)
      b.dmg = bd.dmg
      b.spd = bd.spd
      b.upgrade = bd.upgrade
      b.vx *= (b.spd / type.baseSpd)
      b.vy *= (b.spd / type.baseSpd)
      return b
    })
    stateRef.current = {
      money: saved.money,
      level: saved.level,
      bricks: makeBricks(saved.level),
      balls: initialBalls,
      particles: [],
      floatingTexts: [],
      clickPower: saved.clickPower,
      totalEarned: saved.money,
    }
    setMoney(saved.money)
    setLevel(saved.level)
    setBalls(initialBalls)
    setClickPower(saved.clickPower)
    rafRef.current = requestAnimationFrame(gameLoop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  const gameLoop = useCallback(timestamp => {
    const s = stateRef.current
    const canvas = canvasRef.current
    if (!s || !canvas) { rafRef.current = requestAnimationFrame(gameLoop); return }
    const ctx = canvas.getContext('2d')
    const dt = Math.min((timestamp - lastTimeRef.current) / 1000, 0.05)
    lastTimeRef.current = timestamp

    // poison bricks
    s.bricks.forEach(b => {
      if (b.poisoned && b.alive) {
        b.poisonTimer -= dt
        b.hp -= 10 * dt
        if (b.hp <= 0) killBrick(s, b, ctx)
      }
    })

    // move balls
    s.balls.forEach(ball => {
      ball.x += ball.vx * dt
      ball.y += ball.vy * dt

      // wall bounces
      if (ball.x - ball.r < 0) { ball.x = ball.r; ball.vx = Math.abs(ball.vx) }
      if (ball.x + ball.r > CANVAS_W) { ball.x = CANVAS_W - ball.r; ball.vx = -Math.abs(ball.vx) }
      if (ball.y - ball.r < 0) { ball.y = ball.r; ball.vy = Math.abs(ball.vy) }
      if (ball.y + ball.r > CANVAS_H) { ball.y = CANVAS_H - ball.r; ball.vy = -Math.abs(ball.vy) }

      // brick collision
      s.bricks.forEach(brick => {
        if (!brick.alive) return
        const bx = brick.x + BRICK_W / 2
        const by = brick.y + BRICK_H / 2
        const dx = ball.x - bx, dy = ball.y - by
        if (Math.abs(dx) < BRICK_W / 2 + ball.r && Math.abs(dy) < BRICK_H / 2 + ball.r) {
          brick.hp -= ball.dmg
          if (ball.type === 'poison') brick.poisoned = true
          // bounce
          if (Math.abs(dx) / (BRICK_W / 2) > Math.abs(dy) / (BRICK_H / 2)) {
            ball.vx = dx > 0 ? Math.abs(ball.vx) : -Math.abs(ball.vx)
          } else {
            ball.vy = dy > 0 ? Math.abs(ball.vy) : -Math.abs(ball.vy)
          }
          // scatter splits
          if (ball.type === 'scatter' && Math.random() < 0.15) {
            for (let i = 0; i < 2; i++) {
              const angle = Math.atan2(ball.vy, ball.vx) + (Math.random() - 0.5) * 1.2
              const spd = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy)
              s.balls.push({
                ...ball, id: Math.random(),
                vx: Math.cos(angle) * spd * 0.7,
                vy: Math.sin(angle) * spd * 0.7,
                r: 5, dmg: ball.dmg * 0.5,
                _temp: true, _life: 2,
              })
            }
          }
          if (brick.hp <= 0) killBrick(s, brick, ctx)
          s.particles.push(...makeHitParticles(ball.x, ball.y, ball.color))
        }
      })
    })

    // temp scatter balls
    s.balls = s.balls.filter(b => {
      if (b._temp) { b._life -= dt; return b._life > 0 }
      return true
    })

    // check level complete
    if (s.bricks.every(b => !b.alive)) {
      s.level++
      s.bricks = makeBricks(s.level)
      const bonus = s.level * 200
      s.money += bonus
      s.totalEarned += bonus
      s.floatingTexts.push({ x: CANVAS_W / 2, y: CANVAS_H / 2, text: `LEVEL ${s.level}! +${formatNum(bonus)}`, color: '#ffd93d', life: 2, maxLife: 2, size: 24 })
      setLevel(s.level)
    }

    // particles + floatingTexts
    s.particles = s.particles.filter(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; return p.life > 0 })
    s.floatingTexts = s.floatingTexts.filter(t => { t.y -= 40 * dt; t.life -= dt; return t.life > 0 })

    setMoney(Math.floor(s.money))
    setTotalEarned(Math.floor(s.totalEarned))
    setTick(t => t + 1)

    // ===== DRAW =====
    ctx.fillStyle = '#1a1a2e'; ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

    // grid bg
    ctx.strokeStyle = 'rgba(255,255,255,0.03)'; ctx.lineWidth = 1
    for (let x = 0; x < CANVAS_W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CANVAS_H); ctx.stroke() }
    for (let y = 0; y < CANVAS_H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CANVAS_W, y); ctx.stroke() }

    // bricks
    s.bricks.forEach(brick => {
      if (!brick.alive) return
      const pct = brick.hp / brick.maxHp
      const alpha = 0.3 + pct * 0.7

      ctx.globalAlpha = alpha
      const bGrad = ctx.createLinearGradient(brick.x, brick.y, brick.x, brick.y + BRICK_H)
      bGrad.addColorStop(0, brick.color)
      bGrad.addColorStop(1, brick.color + '88')
      ctx.fillStyle = bGrad
      ctx.beginPath()
      ctx.roundRect(brick.x + 1, brick.y + 1, BRICK_W - 2, BRICK_H - 2, 4)
      ctx.fill()

      if (brick.poisoned) {
        ctx.fillStyle = 'rgba(239,68,68,0.2)'
        ctx.beginPath(); ctx.roundRect(brick.x + 1, brick.y + 1, BRICK_W - 2, BRICK_H - 2, 4); ctx.fill()
      }

      ctx.globalAlpha = 1
      ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1
      ctx.beginPath(); ctx.roundRect(brick.x + 1, brick.y + 1, BRICK_W - 2, BRICK_H - 2, 4); ctx.stroke()

      // hp bar
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(brick.x + 2, brick.y + BRICK_H - 6, BRICK_W - 4, 4)
      ctx.fillStyle = pct > 0.6 ? '#4ade80' : pct > 0.3 ? '#fbbf24' : '#f87171'
      ctx.fillRect(brick.x + 2, brick.y + BRICK_H - 6, (BRICK_W - 4) * pct, 4)

      // hp text
      ctx.fillStyle = 'white'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText(formatNum(Math.max(0, brick.hp)), brick.x + BRICK_W / 2, brick.y + BRICK_H / 2 - 2)
    })

    // particles
    s.particles.forEach(p => {
      ctx.globalAlpha = p.life / p.maxLife
      ctx.fillStyle = p.color
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (p.life / p.maxLife), 0, Math.PI * 2); ctx.fill()
    })
    ctx.globalAlpha = 1

    // balls
    s.balls.forEach(ball => {
      ctx.shadowColor = ball.color; ctx.shadowBlur = 12
      const bGrad = ctx.createRadialGradient(ball.x - ball.r * 0.3, ball.y - ball.r * 0.3, 0, ball.x, ball.y, ball.r)
      bGrad.addColorStop(0, 'white')
      bGrad.addColorStop(0.3, ball.color)
      bGrad.addColorStop(1, ball.color + '88')
      ctx.fillStyle = bGrad
      ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2); ctx.fill()
      ctx.shadowBlur = 0
    })

    // floating texts
    s.floatingTexts.forEach(t => {
      ctx.globalAlpha = t.life / t.maxLife
      ctx.fillStyle = t.color
      ctx.font = `bold ${t.size}px Caveat, cursive`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText(t.text, t.x, t.y)
    })
    ctx.globalAlpha = 1

    // HUD bar
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0, 0, CANVAS_W, MARGIN_TOP - 2)
    ctx.fillStyle = '#ffd93d'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
    ctx.fillText(`💰 ${formatNum(s.money)}`, 14, 22)
    ctx.fillStyle = '#a78bfa'; ctx.fillText(`🎯 Level ${s.level}`, 14, 42)
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '11px sans-serif'; ctx.textAlign = 'right'
    ctx.fillText(`${s.balls.filter(b => !b._temp).length} balls | Click bricks!`, CANVAS_W - 10, 22)
    ctx.fillText(`🖱️ Click power: ${formatNum(s.clickPower)}/hit`, CANVAS_W - 10, 40)

    rafRef.current = requestAnimationFrame(gameLoop)
  }, [])

  function killBrick(s, brick, ctx) {
    brick.alive = false
    const reward = brick.maxHp * 0.1 + s.level * 2
    s.money += reward
    s.totalEarned += reward
    s.floatingTexts.push({
      x: brick.x + BRICK_W / 2,
      y: brick.y + BRICK_H / 2,
      text: `+${formatNum(reward)}`,
      color: '#ffd93d', life: 1, maxLife: 1, size: 14,
    })
  }

  function makeHitParticles(x, y, color) {
    return Array.from({ length: 4 }, () => ({
      x, y, color,
      vx: (Math.random() - 0.5) * 150,
      vy: (Math.random() - 0.5) * 150,
      life: 0.3, maxLife: 0.3,
      r: 2 + Math.random() * 3,
    }))
  }

  const handleCanvasClick = useCallback(e => {
    const s = stateRef.current
    if (!s) return
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const scaleX = CANVAS_W / rect.width
    const scaleY = CANVAS_H / rect.height
    const mx = (e.clientX - rect.left) * scaleX
    const my = (e.clientY - rect.top) * scaleY

    s.bricks.forEach(brick => {
      if (!brick.alive) return
      if (mx > brick.x && mx < brick.x + BRICK_W && my > brick.y && my < brick.y + BRICK_H) {
        brick.hp -= s.clickPower
        s.floatingTexts.push({
          x: mx, y: my,
          text: `-${formatNum(s.clickPower)}`,
          color: '#ff6b6b', life: 0.7, maxLife: 0.7, size: 12,
        })
        s.particles.push(...makeHitParticles(mx, my, '#ff6b6b'))
        if (brick.hp <= 0) killBrick(s, brick, null)
      }
    })
  }, [])

  const buyBall = useCallback(type => {
    const s = stateRef.current
    if (!s || s.money < type.cost) return
    s.money -= type.cost
    const ball = makeBall(type, s.balls.length)
    s.balls.push(ball)
    setBalls([...s.balls])
    setMoney(Math.floor(s.money))
    save(s.money, s.balls.filter(b => !b._temp).map(b => ({ typeId: b.type, dmg: b.dmg, spd: b.spd, upgrade: b.upgrade })), s.level, s.clickPower)
  }, [])

  const upgradeBall = useCallback((ballId, upgradeType) => {
    const s = stateRef.current
    if (!s) return
    const ball = s.balls.find(b => b.id === ballId)
    if (!ball) return
    const cost = Math.floor(ball.typeRef.cost * 0.5 * ball.upgrade)
    if (s.money < cost) return
    s.money -= cost
    ball.upgrade++
    if (upgradeType === 'dmg') ball.dmg *= 1.5
    if (upgradeType === 'spd') {
      ball.spd *= 1.2
      const angle = Math.atan2(ball.vy, ball.vx)
      ball.vx = Math.cos(angle) * ball.spd
      ball.vy = Math.sin(angle) * ball.spd
    }
    setBalls([...s.balls])
    setMoney(Math.floor(s.money))
    save(s.money, s.balls.filter(b => !b._temp).map(b => ({ typeId: b.type, dmg: b.dmg, spd: b.spd, upgrade: b.upgrade })), s.level, s.clickPower)
  }, [])

  const upgradeClick = useCallback(() => {
    const s = stateRef.current
    if (!s) return
    const cost = Math.floor(s.clickPower * 50)
    if (s.money < cost) return
    s.money -= cost
    s.clickPower = Math.floor(s.clickPower * 2)
    setClickPower(s.clickPower)
    setMoney(Math.floor(s.money))
    save(s.money, s.balls.filter(b => !b._temp).map(b => ({ typeId: b.type, dmg: b.dmg, spd: b.spd, upgrade: b.upgrade })), s.level, s.clickPower)
  }, [])

  const realBalls = balls.filter(b => !b._temp)

  const related = games.filter(g => g.slug !== 'idle-breakout').slice(0, 4)
  const catColors = {
    Action: { bg: '#fee2e2', border: '#f87171', text: '#991b1b' },
    Puzzle: { bg: '#fef3c7', border: '#fbbf24', text: '#92400e' },
    Multiplayer: { bg: '#d1fae5', border: '#34d399', text: '#065f46' },
    Racing: { bg: '#dbeafe', border: '#60a5fa', text: '#1e3a8a' },
    Sports: { bg: '#fce7f3', border: '#f472b6', text: '#831843' },
    Zombie: { bg: '#f0fdf4', border: '#86efac', text: '#166534' },
    Shooting: { bg: '#fff1f2', border: '#fda4af', text: '#9f1239' },
    Word: { bg: '#eff6ff', border: '#93c5fd', text: '#1e40af' },
    Adventure: { bg: '#fff7ed', border: '#fdba74', text: '#9a3412' },
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8f9ff', fontFamily: 'Patrick Hand, sans-serif' }}>
      <div style={{ position: 'fixed', inset: 0, backgroundImage: 'linear-gradient(#e8eef7 1px, transparent 1px), linear-gradient(90deg, #e8eef7 1px, transparent 1px)', backgroundSize: '28px 28px', opacity: 0.5, pointerEvents: 'none', zIndex: 0 }} />

      <header style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #e5e7eb', padding: '10px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
        <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', border: '2px solid #e0d7ff', borderRadius: '14px', padding: '6px 32px 6px 14px', background: 'white', flexShrink: 0 }}>
          <span style={{ fontSize: '20px' }}>🎮</span>
          <span style={{ fontFamily: 'Caveat, cursive', fontSize: '26px', fontWeight: 700, background: 'linear-gradient(120deg,#7c3aed,#ec4899,#f59e0b)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>ikop</span>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f3f4f6', borderRadius: '99px', padding: '8px 18px', border: '2px solid #e5e7eb', flex: 1, maxWidth: '400px' }}>
          <span style={{ color: '#9ca3af' }}>🔍</span>
          <input type="text" placeholder="Search games..." onChange={e => { if (e.target.value) window.location.href = `/?search=${e.target.value}` }} style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '14px', color: '#374151', width: '100%', fontFamily: 'Patrick Hand, sans-serif' }} />
        </div>
        <Link href="/" style={{ color: '#7c3aed', fontWeight: 700, textDecoration: 'none', fontSize: '13px', flexShrink: 0 }}>← Back</Link>
      </header>

      <main style={{ position: 'relative', zIndex: 1, maxWidth: '1300px', margin: '0 auto', padding: '16px 24px 40px' }}>
        <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ background: '#fef3c7', border: '2px solid #fbbf24', borderRadius: '99px', padding: '4px 14px', fontSize: '12px', fontWeight: 700, color: '#92400e' }}>Puzzle</span>
          <span style={{ background: '#fef3c7', border: '2px solid #fbbf24', borderRadius: '99px', padding: '4px 14px', fontSize: '12px', fontWeight: 700, color: '#92400e' }}>⭐ Ikop Original</span>
        </div>
        <h1 style={{ fontFamily: 'Caveat, cursive', fontSize: '28px', fontWeight: 700, color: '#1f2937', marginBottom: '14px' }}>🧱 Idle Breakout</h1>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '16px', alignItems: 'start', marginBottom: '16px' }}>

          {/* GAME */}
          <div>
            <div style={{ borderRadius: '16px', overflow: 'hidden', border: '3px solid #7c3aed', boxShadow: '0 8px 32px rgba(124,58,237,0.2)', background: '#1a1a2e', cursor: 'crosshair' }}>
              <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H}
                style={{ display: 'block', width: '100%' }}
                onClick={handleCanvasClick}
              />
            </div>
            <div style={{ background: 'white', borderRadius: '12px', border: '2px solid #e0d7ff', padding: '10px 14px', marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '14px', color: '#555' }}>🖱️ Click bricks to deal damage • Balls bounce automatically</span>
              <button onClick={upgradeClick}
                style={{ background: 'linear-gradient(135deg,#7c3aed,#ec4899)', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', cursor: 'pointer', fontFamily: 'Patrick Hand, sans-serif', fontWeight: 700 }}>
                ⬆️ Click Power (Cost: {formatNum(clickPower * 50)})
              </button>
            </div>
          </div>

          {/* SIDEBAR */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Stats */}
            <div style={{ background: 'white', borderRadius: '14px', border: '2px solid #a78bfa', padding: '12px' }}>
              <p style={{ fontFamily: 'Caveat, cursive', fontSize: '18px', color: '#5b21b6', margin: '0 0 8px' }}>📊 Stats</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                {[['💰 Money', formatNum(money)], ['🎯 Level', level], ['🎱 Balls', realBalls.length], ['🖱️ Click Pwr', formatNum(clickPower)]].map(([l, v]) => (
                  <div key={l} style={{ background: '#f8f9ff', borderRadius: '8px', padding: '6px 8px' }}>
                    <p style={{ fontSize: '10px', color: '#9ca3af', margin: 0 }}>{l}</p>
                    <p style={{ fontSize: '15px', fontWeight: 700, color: '#1f2937', margin: 0 }}>{v}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Tabs */}
            <div style={{ background: 'white', borderRadius: '14px', border: '2px solid #e0d7ff', overflow: 'hidden' }}>
              <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb' }}>
                {[['buy', '🛒 Buy'], ['upgrade', '⬆️ Upgrade']].map(([id, label]) => (
                  <button key={id} onClick={() => setTab(id)}
                    style={{ flex: 1, padding: '10px', border: 'none', background: tab === id ? '#7c3aed' : 'white', color: tab === id ? 'white' : '#6b7280', fontWeight: 700, fontSize: '13px', cursor: 'pointer', fontFamily: 'Patrick Hand, sans-serif' }}>
                    {label}
                  </button>
                ))}
              </div>

              <div style={{ padding: '10px', maxHeight: '340px', overflowY: 'auto' }}>
                {tab === 'buy' && BALL_TYPES.map(type => {
                  const canAfford = money >= type.cost
                  return (
                    <div key={type.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', borderRadius: '10px', background: canAfford ? '#f8f9ff' : '#fafafa', border: `2px solid ${canAfford ? type.color : '#e5e7eb'}`, marginBottom: '6px', opacity: canAfford ? 1 : 0.6 }}>
                      <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: type.color, boxShadow: `0 0 8px ${type.color}66`, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontWeight: 700, fontSize: '13px', color: '#1f2937', margin: 0 }}>{type.name}</p>
                        <p style={{ fontSize: '10px', color: '#9ca3af', margin: 0 }}>{type.desc}</p>
                      </div>
                      <button onClick={() => buyBall(type)} disabled={!canAfford}
                        style={{ background: canAfford ? type.color : '#e5e7eb', color: canAfford ? 'white' : '#9ca3af', border: 'none', borderRadius: '8px', padding: '6px 10px', fontSize: '11px', cursor: canAfford ? 'pointer' : 'not-allowed', fontWeight: 700, whiteSpace: 'nowrap', fontFamily: 'Patrick Hand, sans-serif' }}>
                        💰 {formatNum(type.cost)}
                      </button>
                    </div>
                  )
                })}

                {tab === 'upgrade' && realBalls.length === 0 && (
                  <p style={{ color: '#9ca3af', textAlign: 'center', padding: '20px 0', fontSize: '13px' }}>Buy some balls first!</p>
                )}

                {tab === 'upgrade' && realBalls.map((ball, i) => {
                  const type = BALL_TYPES.find(t => t.id === ball.type) || BALL_TYPES[0]
                  const cost = Math.floor(type.cost * 0.5 * ball.upgrade)
                  const canAfford = money >= cost
                  return (
                    <div key={ball.id} style={{ padding: '8px', borderRadius: '10px', background: '#f8f9ff', border: `2px solid ${ball.color}`, marginBottom: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                        <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: ball.color }} />
                        <span style={{ fontWeight: 700, fontSize: '12px', color: '#1f2937' }}>{type.name} #{i + 1}</span>
                        <span style={{ fontSize: '10px', color: '#9ca3af' }}>Lv.{ball.upgrade}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button onClick={() => upgradeBall(ball.id, 'dmg')} disabled={!canAfford}
                          style={{ flex: 1, background: canAfford ? '#7c3aed' : '#e5e7eb', color: canAfford ? 'white' : '#9ca3af', border: 'none', borderRadius: '6px', padding: '5px 4px', fontSize: '10px', cursor: canAfford ? 'pointer' : 'not-allowed', fontFamily: 'Patrick Hand, sans-serif' }}>
                          💥 DMG ({formatNum(cost)})
                        </button>
                        <button onClick={() => upgradeBall(ball.id, 'spd')} disabled={!canAfford}
                          style={{ flex: 1, background: canAfford ? '#ec4899' : '#e5e7eb', color: canAfford ? 'white' : '#9ca3af', border: 'none', borderRadius: '6px', padding: '5px 4px', fontSize: '10px', cursor: canAfford ? 'pointer' : 'not-allowed', fontFamily: 'Patrick Hand, sans-serif' }}>
                          ⚡ SPD ({formatNum(cost)})
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Ad slot */}
            <AdSlot style={{ minHeight: '160px' }} />
          </div>
        </div>

        {/* about */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '20px' }}>
          <div style={{ background: 'white', borderRadius: '14px', border: '2px solid #a78bfa', padding: '14px' }}>
            <h2 style={{ fontFamily: 'Caveat, cursive', fontSize: '18px', color: '#5b21b6', marginBottom: '6px' }}>About Idle Breakout</h2>
            <p style={{ color: '#555', fontSize: '14px', lineHeight: 1.6, margin: 0 }}>Break bricks to earn money, buy balls that bounce automatically, and upgrade them to deal more damage. The deeper you go the harder the bricks get — plan your upgrades wisely!</p>
          </div>
          <div style={{ background: 'white', borderRadius: '14px', border: '2px solid #c4b5fd', padding: '14px' }}>
            <h2 style={{ fontFamily: 'Caveat, cursive', fontSize: '18px', color: '#5b21b6', marginBottom: '6px' }}>How to Play</h2>
            <p style={{ color: '#555', fontSize: '14px', lineHeight: 1.8, margin: 0 }}>
              🖱️ Click bricks to deal damage<br/>
              💰 Earn money when bricks break<br/>
              🎱 Buy balls — they bounce on their own<br/>
              ⬆️ Upgrade damage or speed<br/>
              🎯 Clear all bricks to advance levels!
            </p>
          </div>
        </div>

        <h2 style={{ fontFamily: 'Caveat, cursive', fontSize: '20px', fontWeight: 700, color: '#5b21b6', marginBottom: '10px' }}>🕹️ More Games</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: '8px' }}>
          {related.map((g, i) => {
            const c = catColors[g.category] || catColors.Action
            const borderColor = ['#f87171','#fb923c','#fbbf24','#34d399'][i % 4]
            return (
              <Link key={g.slug} href={`/games/${g.slug}`} style={{ textDecoration: 'none' }}>
                <div style={{ borderRadius: '10px', overflow: 'hidden', border: `2px solid ${borderColor}`, background: 'white', transition: 'transform 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
                  <div style={{ aspectRatio: '1', background: c.bg }}>
                    <img src={g.thumbnail} alt={g.title} style={{ width: '100%', height: '100%', objectFit: 'contain' }} onError={e => { e.target.style.display = 'none' }} />
                  </div>
                  <div style={{ padding: '4px 6px', borderTop: `2px solid ${borderColor}` }}>
                    <p style={{ fontWeight: 700, fontSize: '10px', color: '#222', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.title}</p>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </main>

      <footer style={{ position: 'relative', zIndex: 1, background: 'white', borderTop: '1px solid #e5e7eb', padding: '24px', textAlign: 'center', marginTop: '20px' }}>
        <p style={{ fontFamily: 'Caveat, cursive', fontSize: '26px', fontWeight: 700, background: 'linear-gradient(120deg,#7c3aed,#ec4899,#f59e0b)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: '0 0 6px' }}>ikop</p>
        <p style={{ color: '#9ca3af', fontSize: '13px', margin: 0 }}>© 2026 Ikop — Free Online Games. No download. No login. Just play.</p>
      </footer>
    </div>
  )
}