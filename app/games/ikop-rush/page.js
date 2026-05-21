'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import { games } from '../../data/games'
import AdSlot from '../../components/AdSlot'

const LANES = 3
const LANE_X = [200, 400, 600]
const PLAYER_Y = 480
const GAME_W = 800
const GAME_H = 600

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

const COLORS = {
  lane1: '#6c63ff',
  lane2: '#ff6584',
  lane3: '#43e97b',
  obstacle: '#ff6b6b',
  coin: '#ffd93d',
  shield: '#4d96ff',
  boost: '#ff9f43',
  player: '#a78bfa',
}

function makeParticle(x, y, color) {
  return {
    x, y, color,
    vx: (Math.random() - 0.5) * 300,
    vy: (Math.random() - 0.5) * 300 - 100,
    life: 0.5 + Math.random() * 0.3,
    maxLife: 0.6,
    r: 3 + Math.random() * 4,
  }
}

export default function IkopRush() {
  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  const gameRef = useRef(null)
  const rafRef = useRef(null)
  const [phase, setPhase] = useState('start')
  const [stats, setStats] = useState({ score: 0, highScore: 0, coins: 0, distance: 0 })
  const [watchingAd, setWatchingAd] = useState(false)
  const [adTimer, setAdTimer] = useState(5)
  const [shield, setShield] = useState(false)
  const [boost, setBoost] = useState(false)
  const adRef = useRef(null)

  const getHS = () => { try { return parseInt(localStorage.getItem('ikop-rush-hs') || '0') } catch { return 0 } }
  const saveHS = s => { try { localStorage.setItem('ikop-rush-hs', String(s)) } catch {} }
  const getTotalCoins = () => { try { return parseInt(localStorage.getItem('ikop-rush-coins') || '0') } catch { return 0 } }
  const saveTotalCoins = c => { try { localStorage.setItem('ikop-rush-coins', String(c)) } catch {} }

  const initGame = useCallback(() => {
    const hs = getHS()
    gameRef.current = {
      lane: 1,
      targetLane: 1,
      laneX: LANE_X[1],
      playerX: LANE_X[1],
      playerY: PLAYER_Y,
      playerR: 22,
      speed: 280,
      maxSpeed: 700,
      score: 0,
      coins: 0,
      distance: 0,
      hs,
      obstacles: [],
      coinItems: [],
      powerups: [],
      particles: [],
      trailParticles: [],
      bgLines: Array.from({ length: 12 }, (_, i) => ({
        x: (i / 12) * GAME_W,
        y: Math.random() * GAME_H,
        speed: 200 + Math.random() * 100,
      })),
      obstacleTimer: 0,
      obstacleInterval: 1.4,
      coinTimer: 0,
      coinInterval: 0.8,
      powerupTimer: 0,
      powerupInterval: 8,
      shieldActive: false,
      shieldTimer: 0,
      boostActive: false,
      boostTimer: 0,
      laneTransition: 0,
      transitioning: false,
      startX: LANE_X[1],
      endX: LANE_X[1],
      running: true,
      dead: false,
      lastTime: performance.now(),
      invincible: 0,
      comboTimer: 0,
      combo: 0,
      totalCoins: getTotalCoins(),
    }
    setStats({ score: 0, highScore: hs, coins: 0, distance: 0 })
    setShield(false)
    setBoost(false)
  }, [])

  function spawnObstacle(g) {
    const lane = Math.floor(Math.random() * LANES)
    const shapes = ['box', 'spike', 'wall']
    const shape = shapes[Math.floor(Math.random() * (g.speed > 450 ? 3 : 2))]
    g.obstacles.push({
      lane, x: LANE_X[lane], y: -40,
      w: shape === 'wall' ? 80 : 50,
      h: shape === 'box' ? 50 : shape === 'spike' ? 60 : 120,
      shape, color: COLORS.obstacle,
      speed: g.speed,
    })
  }

  function spawnCoin(g) {
    const lane = Math.floor(Math.random() * LANES)
    const count = Math.floor(Math.random() * 3) + 1
    for (let i = 0; i < count; i++) {
      g.coinItems.push({
        lane, x: LANE_X[lane], y: -40 - i * 50,
        r: 12, collected: false, bobOffset: Math.random() * Math.PI * 2,
      })
    }
  }

  function spawnPowerup(g) {
    const lane = Math.floor(Math.random() * LANES)
    const types = ['shield', 'boost', 'coin_magnet']
    const type = types[Math.floor(Math.random() * types.length)]
    g.powerups.push({
      lane, x: LANE_X[lane], y: -40,
      type, r: 18, color: type === 'shield' ? COLORS.shield : type === 'boost' ? COLORS.boost : COLORS.coin,
      emoji: type === 'shield' ? '🛡️' : type === 'boost' ? '⚡' : '🧲',
    })
  }

  const endGame = useCallback(g => {
    g.running = false
    cancelAnimationFrame(rafRef.current)
    const finalScore = g.score
    if (finalScore > g.hs) { saveHS(finalScore); g.hs = finalScore }
    const newTotal = g.totalCoins + g.coins
    saveTotalCoins(newTotal)
    setStats({ score: finalScore, highScore: g.hs, coins: g.coins, distance: Math.floor(g.distance) })
    setPhase('dead')
  }, [])

  const loop = useCallback(timestamp => {
    const g = gameRef.current
    const canvas = canvasRef.current
    if (!g || !canvas || !g.running) return
    const ctx = canvas.getContext('2d')
    const dt = Math.min((timestamp - g.lastTime) / 1000, 0.05)
    g.lastTime = timestamp

    // speed up over time
    g.speed = Math.min(g.maxSpeed, g.speed + 12 * dt)
    g.distance += g.speed * dt / 100
    g.score = Math.floor(g.distance * 10 + g.coins * 5)
    if (g.score > g.hs) { g.hs = g.score; saveHS(g.score) }

    // lane transition (smooth)
    if (g.transitioning) {
      g.laneTransition += dt * 8
      if (g.laneTransition >= 1) {
        g.laneTransition = 1
        g.transitioning = false
        g.playerX = LANE_X[g.lane]
      } else {
        g.playerX = g.startX + (g.endX - g.startX) * easeOut(g.laneTransition)
      }
    }

    // timers
    if (g.invincible > 0) g.invincible -= dt
    if (g.shieldActive) { g.shieldTimer -= dt; if (g.shieldTimer <= 0) { g.shieldActive = false; setShield(false) } }
    if (g.boostActive) { g.boostTimer -= dt; if (g.boostTimer <= 0) { g.boostActive = false; g.speed = Math.max(280, g.speed - 150); setBoost(false) } }

    // spawn
    g.obstacleTimer += dt
    if (g.obstacleTimer >= g.obstacleInterval) {
      g.obstacleTimer = 0
      g.obstacleInterval = Math.max(0.5, g.obstacleInterval - 0.01)
      spawnObstacle(g)
    }
    g.coinTimer += dt
    if (g.coinTimer >= g.coinInterval) { g.coinTimer = 0; spawnCoin(g) }
    g.powerupTimer += dt
    if (g.powerupTimer >= g.powerupInterval) { g.powerupTimer = 0; spawnPowerup(g) }

    // trail
    g.trailParticles.push({ x: g.playerX, y: g.playerY, r: 8, life: 0.3, maxLife: 0.3, color: COLORS.player })

    // move obstacles
    g.obstacles = g.obstacles.filter(o => {
      o.y += o.speed * dt
      if (o.y > GAME_H + 100) return false
      // collision
      if (g.invincible <= 0) {
        const px = g.playerX, py = g.playerY, pr = g.playerR
        const ox = o.x, oy = o.y + o.h / 2
        const dx = Math.abs(px - ox), dy = Math.abs(py - oy)
        if (dx < pr + o.w / 2 - 8 && dy < pr + o.h / 2 - 8) {
          if (g.shieldActive) {
            g.shieldActive = false
            g.invincible = 1
            setShield(false)
            for (let i = 0; i < 12; i++) g.particles.push(makeParticle(g.playerX, g.playerY, COLORS.shield))
            return false
          }
          for (let i = 0; i < 20; i++) g.particles.push(makeParticle(g.playerX, g.playerY, COLORS.player))
          endGame(g)
          return false
        }
      }
      return true
    })

    // move coins
    const magnetRange = g.coinMagnet ? 200 : 40
    g.coinItems = g.coinItems.filter(c => {
      c.y += g.speed * dt
      if (g.coinMagnet) {
        const dx = g.playerX - c.x, dy = g.playerY - c.y
        const d = Math.sqrt(dx * dx + dy * dy)
        if (d < magnetRange) { c.x += (dx / d) * 300 * dt; c.y += (dy / d) * 300 * dt }
      }
      if (c.y > GAME_H + 50) return false
      const dx = Math.abs(g.playerX - c.x), dy = Math.abs(g.playerY - c.y)
      if (dx < g.playerR + c.r && dy < g.playerR + c.r) {
        g.coins++
        for (let i = 0; i < 5; i++) g.particles.push(makeParticle(c.x, c.y, COLORS.coin))
        return false
      }
      return true
    })

    // move powerups
    g.powerups = g.powerups.filter(p => {
      p.y += g.speed * dt
      if (p.y > GAME_H + 50) return false
      const dx = Math.abs(g.playerX - p.x), dy = Math.abs(g.playerY - p.y)
      if (dx < g.playerR + p.r && dy < g.playerR + p.r) {
        if (p.type === 'shield') { g.shieldActive = true; g.shieldTimer = 6; setShield(true) }
        if (p.type === 'boost') { g.boostActive = true; g.boostTimer = 4; g.speed = Math.min(g.maxSpeed, g.speed + 150); setBoost(true) }
        if (p.type === 'coin_magnet') { g.coinMagnet = true; setTimeout(() => { if (gameRef.current) gameRef.current.coinMagnet = false }, 5000) }
        for (let i = 0; i < 10; i++) g.particles.push(makeParticle(p.x, p.y, p.color))
        return false
      }
      return true
    })

    // bg lines
    g.bgLines.forEach(l => {
      l.y += l.speed * dt
      if (l.y > GAME_H) l.y = -20
    })

    // particles
    g.particles = g.particles.filter(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; return p.life > 0 })
    g.trailParticles = g.trailParticles.filter(p => { p.life -= dt; return p.life > 0 })

    setStats({ score: g.score, highScore: g.hs, coins: g.coins, distance: Math.floor(g.distance) })

    // ===== DRAW =====
    // background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, GAME_H)
    bgGrad.addColorStop(0, '#0f0c29')
    bgGrad.addColorStop(1, '#302b63')
    ctx.fillStyle = bgGrad
    ctx.fillRect(0, 0, GAME_W, GAME_H)

    // bg lines (speed lines)
    g.bgLines.forEach(l => {
      ctx.strokeStyle = 'rgba(255,255,255,0.04)'
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(l.x, l.y); ctx.lineTo(l.x, l.y + 60); ctx.stroke()
    })

    // lane guides
    LANE_X.forEach((lx, i) => {
      const laneGrad = ctx.createLinearGradient(0, 0, 0, GAME_H)
      laneGrad.addColorStop(0, 'transparent')
      laneGrad.addColorStop(0.5, `rgba(${i === 0 ? '108,99,255' : i === 1 ? '255,101,132' : '67,233,123'},0.05)`)
      laneGrad.addColorStop(1, 'transparent')
      ctx.fillStyle = laneGrad
      ctx.fillRect(lx - 70, 0, 140, GAME_H)

      ctx.strokeStyle = `rgba(255,255,255,0.06)`
      ctx.lineWidth = 1
      ctx.setLineDash([20, 15])
      ctx.beginPath(); ctx.moveTo(lx - 70, 0); ctx.lineTo(lx - 70, GAME_H); ctx.stroke()
      ctx.setLineDash([])
    })

    // perspective lines from bottom center
    for (let i = 0; i < 5; i++) {
      const progress = (Date.now() / 2000 + i / 5) % 1
      const y = GAME_H * (1 - progress)
      ctx.strokeStyle = `rgba(167,139,250,${0.08 * progress})`
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(GAME_W / 2, GAME_H); ctx.lineTo(0, y); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(GAME_W / 2, GAME_H); ctx.lineTo(GAME_W, y); ctx.stroke()
    }

    // trail
    g.trailParticles.forEach(p => {
      ctx.globalAlpha = (p.life / p.maxLife) * 0.4
      ctx.fillStyle = p.color
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (p.life / p.maxLife), 0, Math.PI * 2); ctx.fill()
    })
    ctx.globalAlpha = 1

    // coins
    g.coinItems.forEach((c, idx) => {
      const bob = Math.sin(Date.now() / 300 + c.bobOffset) * 4
      ctx.shadowColor = COLORS.coin; ctx.shadowBlur = 15
      const cGrad = ctx.createRadialGradient(c.x, c.y + bob, 0, c.x, c.y + bob, c.r)
      cGrad.addColorStop(0, '#fff9c4')
      cGrad.addColorStop(1, COLORS.coin)
      ctx.fillStyle = cGrad
      ctx.beginPath(); ctx.arc(c.x, c.y + bob, c.r, 0, Math.PI * 2); ctx.fill()
      ctx.shadowBlur = 0
      ctx.fillStyle = '#92400e'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText('$', c.x, c.y + bob)
    })

    // powerups
    g.powerups.forEach(p => {
      const pulse = 0.9 + 0.1 * Math.sin(Date.now() / 200)
      ctx.save(); ctx.translate(p.x, p.y); ctx.scale(pulse, pulse)
      ctx.shadowColor = p.color; ctx.shadowBlur = 20
      ctx.fillStyle = p.color + '44'
      ctx.beginPath(); ctx.arc(0, 0, p.r, 0, Math.PI * 2); ctx.fill()
      ctx.strokeStyle = p.color; ctx.lineWidth = 2
      ctx.beginPath(); ctx.arc(0, 0, p.r, 0, Math.PI * 2); ctx.stroke()
      ctx.shadowBlur = 0
      ctx.font = `${p.r}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText(p.emoji, 0, 0)
      ctx.restore()
    })

    // obstacles
    g.obstacles.forEach(o => {
      ctx.shadowColor = COLORS.obstacle; ctx.shadowBlur = 10
      if (o.shape === 'box') {
        const oGrad = ctx.createLinearGradient(o.x - o.w/2, o.y, o.x + o.w/2, o.y + o.h)
        oGrad.addColorStop(0, '#ff6b6b')
        oGrad.addColorStop(1, '#ee0979')
        ctx.fillStyle = oGrad
        ctx.beginPath()
        ctx.roundRect(o.x - o.w/2, o.y, o.w, o.h, 8)
        ctx.fill()
        ctx.strokeStyle = '#ff9a9e'; ctx.lineWidth = 2
        ctx.beginPath(); ctx.roundRect(o.x - o.w/2, o.y, o.w, o.h, 8); ctx.stroke()
      } else if (o.shape === 'spike') {
        ctx.fillStyle = '#ff4757'
        ctx.beginPath()
        ctx.moveTo(o.x, o.y)
        ctx.lineTo(o.x - o.w/2, o.y + o.h)
        ctx.lineTo(o.x + o.w/2, o.y + o.h)
        ctx.closePath(); ctx.fill()
        ctx.fillStyle = '#ff6b81'
        ctx.beginPath()
        ctx.moveTo(o.x - 10, o.y + 20)
        ctx.lineTo(o.x - o.w/2 + 10, o.y + o.h)
        ctx.lineTo(o.x, o.y + o.h - 10)
        ctx.closePath(); ctx.fill()
      } else {
        const wGrad = ctx.createLinearGradient(o.x - o.w/2, 0, o.x + o.w/2, 0)
        wGrad.addColorStop(0, '#d63031')
        wGrad.addColorStop(1, '#ff7675')
        ctx.fillStyle = wGrad
        ctx.fillRect(o.x - o.w/2, o.y, o.w, o.h)
        for (let i = 0; i < 3; i++) {
          ctx.fillStyle = 'rgba(255,255,255,0.1)'
          ctx.fillRect(o.x - o.w/2 + 5, o.y + 10 + i * 35, o.w - 10, 4)
        }
      }
      ctx.shadowBlur = 0
    })

    // particles
    g.particles.forEach(p => {
      ctx.globalAlpha = p.life / p.maxLife
      ctx.fillStyle = p.color
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (p.life / p.maxLife), 0, Math.PI * 2); ctx.fill()
    })
    ctx.globalAlpha = 1

    // player
    if (g.invincible > 0 && Math.floor(g.invincible * 10) % 2 === 0) {
      // flash when invincible
    } else {
      // shield ring
      if (g.shieldActive) {
        const shieldPulse = 0.8 + 0.2 * Math.sin(Date.now() / 150)
        ctx.strokeStyle = COLORS.shield; ctx.lineWidth = 3
        ctx.shadowColor = COLORS.shield; ctx.shadowBlur = 20
        ctx.beginPath(); ctx.arc(g.playerX, g.playerY, g.playerR + 12 * shieldPulse, 0, Math.PI * 2); ctx.stroke()
        ctx.shadowBlur = 0
      }

      // boost trail
      if (g.boostActive) {
        ctx.fillStyle = COLORS.boost + '44'
        ctx.beginPath(); ctx.ellipse(g.playerX, g.playerY + 10, g.playerR + 8, g.playerR * 2, 0, 0, Math.PI * 2); ctx.fill()
      }

      // player body
      const pGrad = ctx.createRadialGradient(g.playerX - 6, g.playerY - 6, 0, g.playerX, g.playerY, g.playerR)
      pGrad.addColorStop(0, '#ddd6fe')
      pGrad.addColorStop(1, g.boostActive ? '#f59e0b' : '#7c3aed')
      ctx.shadowColor = g.boostActive ? COLORS.boost : COLORS.player
      ctx.shadowBlur = 25
      ctx.fillStyle = pGrad
      ctx.beginPath(); ctx.arc(g.playerX, g.playerY, g.playerR, 0, Math.PI * 2); ctx.fill()
      ctx.shadowBlur = 0

      // player face
      ctx.fillStyle = 'white'; ctx.beginPath(); ctx.arc(g.playerX - 7, g.playerY - 6, 5, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = 'white'; ctx.beginPath(); ctx.arc(g.playerX + 7, g.playerY - 6, 5, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#1f2937'; ctx.beginPath(); ctx.arc(g.playerX - 6, g.playerY - 6, 2.5, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#1f2937'; ctx.beginPath(); ctx.arc(g.playerX + 8, g.playerY - 6, 2.5, 0, Math.PI * 2); ctx.fill()
      ctx.strokeStyle = '#1f2937'; ctx.lineWidth = 2
      ctx.beginPath(); ctx.arc(g.playerX, g.playerY + 4, 8, 0, Math.PI); ctx.stroke()
    }

    // HUD
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 0, GAME_W, 52)

    ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = '11px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'top'
    ctx.fillText('SCORE', 16, 8)
    ctx.fillStyle = 'white'; ctx.font = 'bold 22px sans-serif'; ctx.textBaseline = 'middle'
    ctx.fillText(g.score, 16, 36)

    ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = '11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top'
    ctx.fillText('DISTANCE', GAME_W/2, 8)
    ctx.fillStyle = 'white'; ctx.font = 'bold 20px sans-serif'; ctx.textBaseline = 'middle'
    ctx.fillText(`${Math.floor(g.distance)}m`, GAME_W/2, 36)

    ctx.fillStyle = '#ffd93d'; ctx.font = '11px sans-serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'top'
    ctx.fillText(`🪙 ${g.coins}`, GAME_W - 16, 8)
    ctx.fillStyle = 'white'; ctx.font = 'bold 18px sans-serif'; ctx.textBaseline = 'middle'
    ctx.fillText(`🏆 ${g.hs}`, GAME_W - 16, 36)

    // speed bar
    const speedPct = (g.speed - 280) / (g.maxSpeed - 280)
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(10, GAME_H - 14, 120, 6)
    const sGrad = ctx.createLinearGradient(10, 0, 130, 0)
    sGrad.addColorStop(0, '#43e97b'); sGrad.addColorStop(0.6, '#f9ca24'); sGrad.addColorStop(1, '#ff6b6b')
    ctx.fillStyle = sGrad; ctx.fillRect(10, GAME_H - 14, 120 * speedPct, 6)
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '9px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'
    ctx.fillText(`SPEED`, 10, GAME_H - 16)

    // active powerup indicators
    let px = GAME_W / 2 - 40
    if (g.shieldActive) {
      ctx.fillStyle = COLORS.shield + 'cc'; ctx.beginPath(); ctx.roundRect(px, GAME_H - 36, 80, 26, 8); ctx.fill()
      ctx.fillStyle = 'white'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText(`🛡️ ${g.shieldTimer.toFixed(1)}s`, px + 40, GAME_H - 23); px += 88
    }
    if (g.boostActive) {
      ctx.fillStyle = COLORS.boost + 'cc'; ctx.beginPath(); ctx.roundRect(px, GAME_H - 36, 80, 26, 8); ctx.fill()
      ctx.fillStyle = 'white'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText(`⚡ ${g.boostTimer.toFixed(1)}s`, px + 40, GAME_H - 23)
    }

    rafRef.current = requestAnimationFrame(loop)
  }, [endGame])

  function easeOut(t) { return 1 - (1 - t) * (1 - t) }

  const moveLeft = useCallback(() => {
    const g = gameRef.current
    if (!g || !g.running || g.transitioning) return
    if (g.lane > 0) {
      g.startX = g.playerX; g.lane--; g.endX = LANE_X[g.lane]
      g.laneTransition = 0; g.transitioning = true
    }
  }, [])

  const moveRight = useCallback(() => {
    const g = gameRef.current
    if (!g || !g.running || g.transitioning) return
    if (g.lane < LANES - 1) {
      g.startX = g.playerX; g.lane++; g.endX = LANE_X[g.lane]
      g.laneTransition = 0; g.transitioning = true
    }
  }, [])

  const startGame = useCallback(() => {
    initGame()
    setPhase('playing')
    setTimeout(() => { rafRef.current = requestAnimationFrame(loop) }, 50)
  }, [initGame, loop])

  const watchAdRevive = useCallback(() => {
    setWatchingAd(true)
    setAdTimer(5)
    let t = 5
    adRef.current = setInterval(() => {
      t--; setAdTimer(t)
      if (t <= 0) {
        clearInterval(adRef.current)
        setWatchingAd(false)
        const g = gameRef.current
        if (!g) return
        g.running = true
        g.dead = false
        g.invincible = 3
        g.obstacles = []
        setPhase('playing')
        rafRef.current = requestAnimationFrame(loop)
      }
    }, 1000)
  }, [loop])

  useEffect(() => {
    const down = e => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') moveLeft()
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') moveRight()
      if (['ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault()
    }
    window.addEventListener('keydown', down)
    return () => {
      window.removeEventListener('keydown', down)
      cancelAnimationFrame(rafRef.current)
      if (adRef.current) clearInterval(adRef.current)
    }
  }, [moveLeft, moveRight])

  // swipe
  const touchRef = useRef(null)
  const handleTouchStart = e => { touchRef.current = { x: e.touches[0].clientX } }
  const handleTouchEnd = e => {
    if (!touchRef.current) return
    const dx = e.changedTouches[0].clientX - touchRef.current.x
    if (dx > 30) moveRight()
    if (dx < -30) moveLeft()
    touchRef.current = null
  }

  const goFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen()
    else containerRef.current?.requestFullscreen()
  }

  const related = games.filter(g => g.slug !== 'ikop-rush' && g.slug !== 'ikop-survival').slice(0, 4)

  return (
    <div style={{ minHeight: '100vh', background: '#f8f9ff', fontFamily: 'Patrick Hand, sans-serif' }}>
      <div style={{ position: 'fixed', inset: 0, backgroundImage: 'linear-gradient(#e8eef7 1px, transparent 1px), linear-gradient(90deg, #e8eef7 1px, transparent 1px)', backgroundSize: '28px 28px', opacity: 0.5, pointerEvents: 'none', zIndex: 0 }} />

      <header style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #e5e7eb', padding: '10px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
        <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', border: '2px solid #e0d7ff', borderRadius: '14px', padding: '6px 28px 6px 14px', background: 'white', flexShrink: 0 }}>
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
          <span style={{ background: '#fee2e2', border: '2px solid #f87171', borderRadius: '99px', padding: '4px 14px', fontSize: '12px', fontWeight: 700, color: '#991b1b' }}>Action</span>
          <span style={{ background: '#fef3c7', border: '2px solid #fbbf24', borderRadius: '99px', padding: '4px 14px', fontSize: '12px', fontWeight: 700, color: '#92400e' }}>⭐ Ikop Original</span>
        </div>
        <h1 style={{ fontFamily: 'Caveat, cursive', fontSize: '28px', fontWeight: 700, color: '#1f2937', marginBottom: '14px' }}>🏃 Ikop Rush</h1>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px', gap: '14px', alignItems: 'start', marginBottom: '16px' }}>
          <div>
            <div ref={containerRef} style={{ position: 'relative', borderRadius: '16px', overflow: 'hidden', border: '3px solid #7c3aed', boxShadow: '0 8px 32px rgba(124,58,237,0.25)', background: '#0f0c29' }}>
              <canvas ref={canvasRef} width={GAME_W} height={GAME_H}
                style={{ display: 'block', width: '100%', touchAction: 'none' }}
                onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}
              />

              <button onClick={goFullscreen} style={{ position: 'absolute', bottom: '12px', right: '12px', background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', color: 'white', fontSize: '16px', cursor: 'pointer', padding: '5px 9px', zIndex: 10 }}>⛶</button>

              {/* START */}
              {phase === 'start' && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,12,41,0.96)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
                  <div style={{ fontSize: '70px', margin: 0, animation: 'none' }}>🏃</div>
                  <p style={{ fontFamily: 'Caveat, cursive', fontSize: '54px', fontWeight: 700, background: 'linear-gradient(120deg,#a78bfa,#ec4899,#f59e0b)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0 }}>Ikop Rush</p>
                  <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '15px', textAlign: 'center', maxWidth: '360px', margin: 0, lineHeight: 1.7 }}>
                    Switch lanes to dodge obstacles and survive!<br/>
                    <strong style={{ color: '#a78bfa' }}>← → Arrow Keys</strong> or <strong style={{ color: '#a78bfa' }}>A / D</strong> to move<br/>
                    Collect 🪙 coins • Grab powerups • Go as far as you can!
                  </p>
                  <p style={{ color: '#ffd93d', fontSize: '14px', margin: 0 }}>🏆 Best: {getHS()} &nbsp;|&nbsp; 🪙 Total Coins: {getTotalCoins()}</p>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center', fontSize: '13px', color: 'rgba(255,255,255,0.4)', margin: '0' }}>
                    <span>🛡️ Shield — blocks one hit</span>
                    <span>⚡ Boost — speed rush</span>
                    <span>🧲 Magnet — attract coins</span>
                  </div>
                  <button onClick={startGame} style={{ background: 'linear-gradient(135deg,#7c3aed,#ec4899)', color: 'white', border: 'none', borderRadius: '99px', padding: '16px 52px', fontSize: '22px', fontFamily: 'Caveat, cursive', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 20px rgba(124,58,237,0.5)' }}>
                    Start Running! 🏃
                  </button>
                </div>
              )}

              {/* DEAD */}
              {phase === 'dead' && !watchingAd && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,12,41,0.96)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                  <p style={{ fontSize: '54px', margin: 0 }}>💥</p>
                  <p style={{ fontFamily: 'Caveat, cursive', fontSize: '46px', fontWeight: 700, color: '#ff6b6b', margin: 0 }}>Crashed!</p>
                  <div style={{ display: 'flex', gap: '28px', margin: '6px 0' }}>
                    {[['SCORE', stats.score, '#ffd93d'], ['DISTANCE', `${stats.distance}m`, 'white'], ['COINS', `🪙${stats.coins}`, '#ffd93d']].map(([l, v, c]) => (
                      <div key={l} style={{ textAlign: 'center' }}>
                        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', margin: '0 0 3px' }}>{l}</p>
                        <p style={{ color: c, fontSize: '24px', fontWeight: 700, margin: 0 }}>{v}</p>
                      </div>
                    ))}
                  </div>
                  {stats.score >= stats.highScore && stats.score > 0 && (
                    <p style={{ color: '#6bcb77', fontSize: '16px', fontWeight: 700, margin: 0 }}>🎉 New High Score!</p>
                  )}
                  <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', margin: 0 }}>🏆 Best: {stats.highScore}</p>

                  <div style={{ background: 'rgba(255,215,0,0.1)', border: '2px solid #ffd93d', borderRadius: '14px', padding: '14px 24px', textAlign: 'center' }}>
                    <p style={{ color: '#ffd93d', fontSize: '14px', fontWeight: 700, margin: '0 0 6px' }}>💊 Continue Running?</p>
                    <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', margin: '0 0 10px' }}>Watch a short ad to revive and keep going!</p>
                    <button onClick={watchAdRevive} style={{ background: 'linear-gradient(135deg,#ffd93d,#f59e0b)', color: '#92400e', border: 'none', borderRadius: '99px', padding: '10px 28px', fontSize: '15px', fontFamily: 'Caveat, cursive', fontWeight: 700, cursor: 'pointer' }}>
                      ▶ Watch Ad & Continue!
                    </button>
                  </div>

                  <button onClick={startGame} style={{ background: 'linear-gradient(135deg,#7c3aed,#ec4899)', color: 'white', border: 'none', borderRadius: '99px', padding: '12px 36px', fontSize: '18px', fontFamily: 'Caveat, cursive', fontWeight: 700, cursor: 'pointer' }}>
                    Try Again! 🏃
                  </button>
                </div>
              )}

              {/* WATCHING AD */}
              {watchingAd && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.97)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
                  <p style={{ fontFamily: 'Caveat, cursive', fontSize: '32px', color: '#ffd93d', margin: 0 }}>📺 Ad Playing...</p>
                  <div style={{ width: '320px', height: '180px', background: 'rgba(255,255,255,0.05)', border: '2px solid rgba(255,255,255,0.1)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '14px', textAlign: 'center' }}>[ Ad Space ]<br/>Place AdSense code here</p>
                  </div>
                  <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', margin: 0 }}>Continuing in <strong style={{ color: '#ffd93d' }}>{adTimer}</strong>s...</p>
                  <div style={{ width: '200px', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '99px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: '#ffd93d', borderRadius: '99px', width: `${((5 - adTimer) / 5) * 100}%`, transition: 'width 0.9s' }} />
                  </div>
                </div>
              )}
            </div>

            {/* MOBILE CONTROLS */}
            <div style={{ display: 'flex', gap: '12px', marginTop: '10px', justifyContent: 'center' }}>
              <button onClick={moveLeft}
                style={{ background: 'white', border: '2px solid #a78bfa', borderRadius: '12px', padding: '12px 32px', fontSize: '20px', cursor: 'pointer', fontWeight: 700, color: '#7c3aed', boxShadow: '0 2px 8px rgba(124,58,237,0.15)' }}>
                ← Left
              </button>
              <button onClick={moveRight}
                style={{ background: 'white', border: '2px solid #a78bfa', borderRadius: '12px', padding: '12px 32px', fontSize: '20px', cursor: 'pointer', fontWeight: 700, color: '#7c3aed', boxShadow: '0 2px 8px rgba(124,58,237,0.15)' }}>
                Right →
              </button>
            </div>
          </div>

          {/* ADS */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <AdSlot />
            <AdSlot style={{ minHeight: '200px' }} />
          </div>
        </div>

        {/* ABOUT + HOW TO PLAY */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '20px' }}>
          <div style={{ background: 'white', borderRadius: '14px', border: '2px solid #a78bfa', padding: '14px' }}>
            <h2 style={{ fontFamily: 'Caveat, cursive', fontSize: '18px', color: '#5b21b6', marginBottom: '6px' }}>About Ikop Rush</h2>
            <p style={{ color: '#555', fontSize: '14px', lineHeight: 1.6, margin: 0 }}>An endless runner made right here at Ikop! Switch between 3 lanes to dodge obstacles, collect coins and grab powerups. The longer you survive the faster it gets. An Ikop original!</p>
          </div>
          <div style={{ background: 'white', borderRadius: '14px', border: '2px solid #c4b5fd', padding: '14px' }}>
            <h2 style={{ fontFamily: 'Caveat, cursive', fontSize: '18px', color: '#5b21b6', marginBottom: '6px' }}>How to Play</h2>
            <p style={{ color: '#555', fontSize: '14px', lineHeight: 1.8, margin: 0 }}>
              ⬅️➡️ Arrow Keys or A/D to switch lanes<br/>
              📱 Swipe left/right on mobile<br/>
              🪙 Collect coins for your total bank<br/>
              🛡️ Shield blocks one hit<br/>
              ⚡ Boost gives a speed rush<br/>
              🧲 Magnet attracts nearby coins
            </p>
          </div>
        </div>

        {/* MORE GAMES */}
        <h2 style={{ fontFamily: 'Caveat, cursive', fontSize: '20px', fontWeight: 700, color: '#5b21b6', marginBottom: '10px' }}>🕹️ More Games</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: '8px' }}>
          {games.filter(g => g.slug !== 'ikop-rush').slice(0, 16).map((g, i) => {
            const c = catColors[g.category] || catColors.Action
            const borderColor = ['#f87171','#fb923c','#fbbf24','#34d399','#60a5fa','#a78bfa','#f472b6','#38bdf8'][i % 8]
            return (
              <Link key={g.slug} href={`/games/${g.slug}`} style={{ textDecoration: 'none' }}>
                <div style={{ borderRadius: '10px', overflow: 'hidden', border: `2px solid ${borderColor}`, background: 'white', transition: 'transform 0.15s', boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
                  <div style={{ aspectRatio: '1', background: c.bg, overflow: 'hidden' }}>
                    <img src={g.thumbnail} alt={g.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.target.style.display = 'none' }} />
                  </div>
                  <div style={{ padding: '4px 6px', borderTop: `2px solid ${borderColor}` }}>
                    <p style={{ fontWeight: 700, fontSize: '10px', color: '#222', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.title}</p>
                    <p style={{ fontSize: '9px', color: c.text, margin: '1px 0 0', fontWeight: 700 }}>{g.category}</p>
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