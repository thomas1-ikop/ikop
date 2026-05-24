'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import { games } from '../../data/games'
import AdSlot from '../../components/AdSlot'

export default function IkopSurvival() {
  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  const gameRef = useRef(null)
  const rafRef = useRef(null)
  const keysRef = useRef({})
  const [phase, setPhase] = useState('start')
  const [levelUpChoices, setLevelUpChoices] = useState(null)
  const [stats, setStats] = useState({ score: 0, highScore: 0, time: 0, kills: 0, coins: 0 })
  const [coins, setCoins] = useState(0)
  const [showShop, setShowShop] = useState(false)
  const [watchingAd, setWatchingAd] = useState(false)
  const [adTimer, setAdTimer] = useState(5)
  const adIntervalRef = useRef(null)

  const W = 800, H = 450

  const getHS = () => { try { return parseInt(localStorage.getItem('ikop-surv-hs') || '0') } catch { return 0 } }
  const saveHS = (s) => { try { localStorage.setItem('ikop-surv-hs', String(s)) } catch {} }
  const getCoins = () => { try { return parseInt(localStorage.getItem('ikop-surv-coins') || '0') } catch { return 0 } }
  const saveCoins = (c) => { try { localStorage.setItem('ikop-surv-coins', String(c)) } catch {} }

  const COMMON_POWERUPS = [
    { id: 'speed',     emoji: '👟', name: 'Speed Boost',   desc: '+25% movement speed',  rarity: 'common'  },
    { id: 'shield',    emoji: '🛡️', name: 'Shield',        desc: '-20% damage taken',     rarity: 'common'  },
    { id: 'magnet',    emoji: '🧲', name: 'Gem Magnet',    desc: 'Gems attract to you',   rarity: 'common'  },
    { id: 'regen',     emoji: '💚', name: 'Regeneration',  desc: '+3 HP per second',      rarity: 'common'  },
    { id: 'multishot', emoji: '🎯', name: 'Multi Shot',    desc: 'Fire 3 bullets at once',rarity: 'common'  },
    { id: 'vampire',   emoji: '🩸', name: 'Vampire',       desc: '+4 HP on every kill',   rarity: 'common'  },
  ]

  const RARE_POWERUPS = [
    { id: 'blast',     emoji: '💥', name: 'Shockwave',     desc: 'Blast all nearby enemies every 4s', rarity: 'rare'    },
    { id: 'clone',     emoji: '👥', name: 'Shadow Clone',  desc: 'A clone fights beside you',         rarity: 'rare'    },
    { id: 'freeze',    emoji: '❄️', name: 'Blizzard',      desc: 'Slow all enemies by 40%',           rarity: 'rare'    },
    { id: 'rage',      emoji: '😡', name: 'Rage Mode',     desc: '3x damage when HP below 30%',       rarity: 'rare'    },
  ]

  const LEGENDARY_POWERUPS = [
    { id: 'nuke',      emoji: '☢️', name: 'Nuke',          desc: 'Instant kill all enemies on screen', rarity: 'legendary' },
    { id: 'immortal',  emoji: '⚡', name: 'Thunder God',   desc: 'Invincible for 8 seconds',           rarity: 'legendary' },
    { id: 'blackhole', emoji: '🌀', name: 'Black Hole',    desc: 'Pull all enemies to center',         rarity: 'legendary' },
  ]

  const SHOP_ITEMS = [
    { id: 'buy_speed',    emoji: '👟', name: 'Speed Up',      desc: '+30% speed permanently', cost: 15, powerup: 'speed'     },
    { id: 'buy_shield',   emoji: '🛡️', name: 'Iron Shield',   desc: '-25% damage taken',      cost: 20, powerup: 'shield'    },
    { id: 'buy_heal',     emoji: '❤️', name: 'Full Heal',     desc: 'Restore all HP',         cost: 10, powerup: 'fullheal'  },
    { id: 'buy_blast',    emoji: '💥', name: 'Shockwave',     desc: 'Periodic area blast',    cost: 30, powerup: 'blast'     },
    { id: 'buy_multishot',emoji: '🎯', name: 'Multi Shot',    desc: 'Fire 3 bullets at once', cost: 25, powerup: 'multishot' },
    { id: 'buy_freeze',   emoji: '❄️', name: 'Blizzard',      desc: 'Slow all enemies',       cost: 35, powerup: 'freeze'    },
  ]

  const rarityColors = { common: '#9ca3af', rare: '#4d96ff', legendary: '#ffd93d' }
  const rarityBg = { common: 'rgba(156,163,175,0.15)', rare: 'rgba(77,150,255,0.15)', legendary: 'rgba(255,217,61,0.15)' }

  const initGame = useCallback(() => {
    const hs = getHS()
    const savedCoins = getCoins()
    setCoins(savedCoins)
    gameRef.current = {
      player: { x: W/2, y: H/2, r: 14, hp: 100, maxHp: 100, speed: 220, xp: 0, level: 1, xpNext: 10, kills: 0, coins: savedCoins },
      clone: null,
      enemies: [],
      gems: [],
      bullets: [],
      blasts: [],
      particles: [],
      powerups: {},
      spawnTimer: 0,
      spawnInterval: 1.6,
      blastTimer: 0,
      regenTimer: 0,
      shotTimer: 0,
      cloneShotTimer: 0,
      shotInterval: 0.35,
      immortalTimer: 0,
      blackholeTimer: 0,
      time: 0,
      score: 0,
      hs,
      running: true,
      lastTime: performance.now(),
      wave: 1,
      waveTimer: 0,
      coinDropChance: 0.3,
    }
    setStats({ score: 0, highScore: hs, time: 0, kills: 0, coins: savedCoins })
  }, [])

  const getChoices = useCallback(() => {
    const g = gameRef.current
    const wave = g.wave
    let pool = []
    if (wave >= 10 && Math.random() < 0.15) {
      pool = LEGENDARY_POWERUPS
    } else if (wave >= 5 && Math.random() < 0.35) {
      pool = RARE_POWERUPS
    } else {
      pool = COMMON_POWERUPS
    }
    return pool.sort(() => Math.random() - 0.5).slice(0, 3)
  }, [])

  const applyPowerupById = useCallback((id, g) => {
    const p = g.player
    g.powerups[id] = (g.powerups[id] || 0) + 1
    if (id === 'speed') p.speed += 35
    if (id === 'shield') {}
    if (id === 'freeze') {}
    if (id === 'vampire') {}
    if (id === 'multishot') {}
    if (id === 'regen') {}
    if (id === 'blast') {}
    if (id === 'magnet') {}
    if (id === 'fullheal') { p.hp = p.maxHp }
    if (id === 'rage') {}
    if (id === 'clone') {
      g.clone = { x: p.x + 40, y: p.y + 40, r: 10 }
    }
    if (id === 'nuke') {
      g.enemies.forEach(e => {
        g.particles.push(...makeParticles(e.x, e.y, e.color, 10))
        g.gems.push({ x: e.x, y: e.y, r: 7, life: 12 })
        g.score += e.score
        p.kills++
      })
      g.enemies = []
    }
    if (id === 'immortal') { g.immortalTimer = 8 }
    if (id === 'blackhole') { g.blackholeTimer = 4 }
  }, [])

  const applyPowerup = useCallback((id) => {
    const g = gameRef.current
    if (!g) return
    applyPowerupById(id, g)
    g.player.xp = 0
    g.player.xpNext = Math.floor(g.player.xpNext * 1.3)
    g.player.level++
    g.running = true
    setLevelUpChoices(null)
    setPhase('playing')
    rafRef.current = requestAnimationFrame(loop)
  }, [applyPowerupById])

  const buyShopItem = useCallback((item) => {
    const g = gameRef.current
    if (!g) return
    const p = g.player
    if (p.coins < item.cost) return
    p.coins -= item.cost
    saveCoins(p.coins)
    setCoins(p.coins)
    applyPowerupById(item.powerup, g)
    setStats(s => ({ ...s, coins: p.coins }))
  }, [applyPowerupById])

  function makeParticles(x, y, color, n = 8) {
    return Array.from({ length: n }, () => ({
      x, y, color,
      vx: (Math.random() - 0.5) * 240,
      vy: (Math.random() - 0.5) * 240,
      life: 0.4 + Math.random() * 0.3,
      maxLife: 0.6,
      r: 2 + Math.random() * 3
    }))
  }

  const spawnEnemy = useCallback(() => {
    const g = gameRef.current
    const side = Math.floor(Math.random() * 4)
    let x, y
    if (side === 0) { x = Math.random() * W; y = -20 }
    else if (side === 1) { x = W + 20; y = Math.random() * H }
    else if (side === 2) { x = Math.random() * W; y = H + 20 }
    else { x = -20; y = Math.random() * H }
    const wave = g.wave
    const types = ['basic', 'fast', 'tank', 'shooter']
    const weights = wave < 3 ? [1,0,0,0] : wave < 5 ? [3,2,1,0] : wave < 8 ? [2,2,2,1] : [1,2,2,2]
    const total = weights.reduce((a, b) => a + b, 0)
    let rand = Math.random() * total, typeIdx = 0
    for (let i = 0; i < weights.length; i++) { rand -= weights[i]; if (rand <= 0) { typeIdx = i; break } }
    const type = types[typeIdx]
    const configs = {
      basic:   { r: 10, hp: 20+wave*3,  speed: 60+wave*5,  color: '#ff6b6b', score: 1, damage: 8,  coinDrop: 1 },
      fast:    { r: 7,  hp: 10+wave*2,  speed: 110+wave*8, color: '#ffd93d', score: 2, damage: 5,  coinDrop: 1 },
      tank:    { r: 18, hp: 80+wave*10, speed: 35+wave*3,  color: '#a78bfa', score: 3, damage: 15, coinDrop: 3 },
      shooter: { r: 12, hp: 30+wave*4,  speed: 45+wave*3,  color: '#f472b6', score: 4, damage: 6,  coinDrop: 2 },
    }
    const cfg = configs[type]
    g.enemies.push({ x, y, type, shootTimer: Math.random() * 3, ...cfg, maxHp: cfg.hp })
  }, [])

  const fireBullet = useCallback((fromX, fromY, toX, toY, owner = 'player', dmgMult = 1) => {
    const g = gameRef.current
    if (!g) return
    const dx = toX - fromX, dy = toY - fromY
    const dist = Math.sqrt(dx*dx + dy*dy) || 1
    const speed = owner === 'player' || owner === 'clone' ? 420 : 160
    const baseDmg = owner === 'player' || owner === 'clone' ? 10 : 8
    g.bullets.push({
      x: fromX, y: fromY,
      vx: (dx/dist) * speed, vy: (dy/dist) * speed,
      r: owner === 'player' || owner === 'clone' ? 5 : 4,
      color: owner === 'player' ? '#4d96ff' : owner === 'clone' ? '#f472b6' : '#ff6b6b',
      owner, dmg: baseDmg * dmgMult, life: 1.8
    })
  }, [])

  const doBlast = useCallback(() => {
    const g = gameRef.current
    if (!g) return
    const p = g.player
    const blastR = 130
    g.blasts.push({ x: p.x, y: p.y, r: 0, maxR: blastR, life: 0.4 })
    g.enemies = g.enemies.filter(e => {
      const d = Math.sqrt((e.x-p.x)**2 + (e.y-p.y)**2)
      if (d < blastR) { e.hp -= 50; g.particles.push(...makeParticles(e.x, e.y, e.color, 6)); return e.hp > 0 }
      return true
    })
  }, [])

  const endGame = useCallback((g) => {
    g.running = false
    cancelAnimationFrame(rafRef.current)
    const finalScore = g.score
    if (finalScore > g.hs) { saveHS(finalScore); g.hs = finalScore }
    setStats({ score: finalScore, highScore: g.hs, time: Math.floor(g.time), kills: g.player.kills, coins: g.player.coins })
    setPhase('dead')
  }, [])

  const watchAdRespawn = useCallback(() => {
    setWatchingAd(true)
    setAdTimer(5)
    let t = 5
    adIntervalRef.current = setInterval(() => {
      t--
      setAdTimer(t)
      if (t <= 0) {
        clearInterval(adIntervalRef.current)
        setWatchingAd(false)
        const g = gameRef.current
        if (!g) return
        g.player.hp = g.player.maxHp * 0.5
        g.running = true
        setPhase('playing')
        rafRef.current = requestAnimationFrame(loop)
      }
    }, 1000)
  }, [])

  const loop = useCallback((timestamp) => {
    const g = gameRef.current
    const canvas = canvasRef.current
    if (!g || !canvas || !g.running) return
    const ctx = canvas.getContext('2d')
    const dt = Math.min((timestamp - g.lastTime) / 1000, 0.05)
    g.lastTime = timestamp
    g.time += dt

    const p = g.player
    const keys = keysRef.current

    // movement
    let vx = 0, vy = 0
    if (keys['ArrowUp']    || keys['w'] || keys['W']) vy -= 1
    if (keys['ArrowDown']  || keys['s'] || keys['S']) vy += 1
    if (keys['ArrowLeft']  || keys['a'] || keys['A']) vx -= 1
    if (keys['ArrowRight'] || keys['d'] || keys['D']) vx += 1
    if (vx !== 0 && vy !== 0) { vx *= 0.707; vy *= 0.707 }
    p.x = Math.max(p.r, Math.min(W-p.r, p.x + vx * p.speed * dt))
    p.y = Math.max(p.r, Math.min(H-p.r, p.y + vy * p.speed * dt))

    // clone follows player
    if (g.clone) {
      const cl = g.clone
      const cdx = p.x - cl.x, cdy = p.y - cl.y
      const cd = Math.sqrt(cdx*cdx + cdy*cdy) || 1
      if (cd > 50) { cl.x += (cdx/cd) * 180 * dt; cl.y += (cdy/cd) * 180 * dt }
    }

    // immortal
    if (g.immortalTimer > 0) g.immortalTimer -= dt

    // blackhole
    if (g.blackholeTimer > 0) {
      g.blackholeTimer -= dt
      g.enemies.forEach(e => {
        const dx = W/2 - e.x, dy = H/2 - e.y
        const d = Math.sqrt(dx*dx+dy*dy) || 1
        e.x += (dx/d) * 300 * dt; e.y += (dy/d) * 300 * dt
      })
    }

    // freeze
    const freezeMult = g.powerups.freeze ? 0.55 : 1

    // auto shoot
    g.shotTimer += dt
    const si = g.powerups.multishot ? g.shotInterval * 0.65 : g.shotInterval
    if (g.shotTimer >= si && g.enemies.length > 0) {
      g.shotTimer = 0
      let closest = null, closestDist = Infinity
      g.enemies.forEach(e => {
        const d = Math.sqrt((e.x-p.x)**2 + (e.y-p.y)**2)
        if (d < closestDist) { closestDist = d; closest = e }
      })
      if (closest) {
        const rageMult = (g.powerups.rage && p.hp < p.maxHp * 0.3) ? 3 : 1
        fireBullet(p.x, p.y, closest.x, closest.y, 'player', rageMult)
        if (g.powerups.multishot) {
          const angle = Math.atan2(closest.y-p.y, closest.x-p.x)
          fireBullet(p.x, p.y, p.x+Math.cos(angle+0.5)*100, p.y+Math.sin(angle+0.5)*100, 'player', rageMult)
          fireBullet(p.x, p.y, p.x+Math.cos(angle-0.5)*100, p.y+Math.sin(angle-0.5)*100, 'player', rageMult)
        }
      }
    }

    // clone shoots
    if (g.clone && g.enemies.length > 0) {
      g.cloneShotTimer = (g.cloneShotTimer || 0) + dt
      if (g.cloneShotTimer >= 0.6) {
        g.cloneShotTimer = 0
        let closest = null, closestDist = Infinity
        g.enemies.forEach(e => {
          const d = Math.sqrt((e.x-g.clone.x)**2 + (e.y-g.clone.y)**2)
          if (d < closestDist) { closestDist = d; closest = e }
        })
        if (closest) fireBullet(g.clone.x, g.clone.y, closest.x, closest.y, 'clone')
      }
    }

    // blast
    if (g.powerups.blast) { g.blastTimer += dt; if (g.blastTimer >= 4) { g.blastTimer = 0; doBlast() } }
    // regen
    if (g.powerups.regen) { g.regenTimer += dt; if (g.regenTimer >= 1) { g.regenTimer = 0; p.hp = Math.min(p.maxHp, p.hp+3) } }

    // wave
    g.waveTimer += dt
    if (g.waveTimer >= 20) { g.waveTimer = 0; g.wave++; g.spawnInterval = Math.max(0.4, g.spawnInterval-0.12) }

    // spawn
    g.spawnTimer += dt
    if (g.spawnTimer >= g.spawnInterval) {
      g.spawnTimer = 0
      const count = Math.floor(g.wave/3)+1
      for (let i = 0; i < count; i++) spawnEnemy()
    }

    // enemies
    g.enemies.forEach(e => {
      const dx = p.x-e.x, dy = p.y-e.y, dist = Math.sqrt(dx*dx+dy*dy)||1
      e.x += (dx/dist)*e.speed*freezeMult*dt
      e.y += (dy/dist)*e.speed*freezeMult*dt
      if (e.type === 'shooter') { e.shootTimer -= dt; if (e.shootTimer <= 0) { e.shootTimer = 2.5; fireBullet(e.x, e.y, p.x, p.y, 'enemy') } }
      const d = Math.sqrt((e.x-p.x)**2+(e.y-p.y)**2)
      if (d < p.r+e.r && g.immortalTimer <= 0) {
        const reduction = (g.powerups.shield||0)*0.2
        p.hp -= e.damage*(1-reduction)*dt*3
        if (p.hp <= 0) { endGame(g); return }
      }
    })

    // bullets
    g.bullets = g.bullets.filter(b => {
      b.x += b.vx*dt; b.y += b.vy*dt; b.life -= dt
      if (b.life<=0||b.x<-20||b.x>W+20||b.y<-20||b.y>H+20) return false
      if (b.owner === 'player' || b.owner === 'clone') {
        let hit = false
        g.enemies = g.enemies.filter(e => {
          const d = Math.sqrt((b.x-e.x)**2+(b.y-e.y)**2)
          if (d < b.r+e.r) {
            e.hp -= b.dmg; g.particles.push(...makeParticles(e.x, e.y, e.color, 4))
            if (e.hp <= 0) {
              g.gems.push({ x: e.x, y: e.y, r: 7, life: 12 })
              if (Math.random() < g.coinDropChance) {
                g.gems.push({ x: e.x+10, y: e.y, r: 6, life: 12, isCoin: true, value: e.coinDrop })
              }
              g.score += e.score; p.kills++
              if (g.powerups.vampire) p.hp = Math.min(p.maxHp, p.hp+4)
              g.particles.push(...makeParticles(e.x, e.y, '#6bcb77', 8))
              if (g.score > g.hs) { g.hs = g.score; saveHS(g.score) }
            }
            hit = true; return e.hp > 0
          }
          return true
        })
        return !hit
      } else {
        if (g.immortalTimer > 0) return false
        const d = Math.sqrt((b.x-p.x)**2+(b.y-p.y)**2)
        if (d < b.r+p.r) {
          const reduction = (g.powerups.shield||0)*0.2
          p.hp -= b.dmg*(1-reduction)
          g.particles.push(...makeParticles(p.x, p.y, '#ff6b6b', 3))
          if (p.hp <= 0) endGame(g)
          return false
        }
        return true
      }
    })

    // gems + coins
    const magnetRange = g.powerups.magnet ? 160 : 35
    g.gems = g.gems.filter(gem => {
      gem.life -= dt
      const dx = p.x-gem.x, dy = p.y-gem.y, d = Math.sqrt(dx*dx+dy*dy)
      if (d < magnetRange) { gem.x += (dx/d)*200*dt; gem.y += (dy/d)*200*dt }
      if (d < p.r+gem.r) {
        if (gem.isCoin) {
          p.coins += gem.value || 1
          saveCoins(p.coins)
          setCoins(p.coins)
        } else {
          p.xp++
          if (p.xp >= p.xpNext) {
            g.running = false
            cancelAnimationFrame(rafRef.current)
            setLevelUpChoices(getChoices())
            setPhase('levelup')
          }
        }
        return false
      }
      return gem.life > 0
    })

    g.blasts = g.blasts.filter(b => { b.r += (b.maxR/0.4)*dt; b.life -= dt; return b.life > 0 })
    g.particles = g.particles.filter(pt => { pt.x += pt.vx*dt; pt.y += pt.vy*dt; pt.life -= dt; return pt.life > 0 })

    setStats({ score: g.score, highScore: g.hs, time: Math.floor(g.time), kills: p.kills, coins: p.coins })

    // ===== DRAW =====
    ctx.fillStyle = '#0d0d1a'; ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = 'rgba(255,255,255,0.03)'
    for (let x = 0; x < W; x += 40) for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.arc(x,y,1,0,Math.PI*2); ctx.fill() }

    // blackhole vortex
    if (g.blackholeTimer > 0) {
      ctx.strokeStyle = `rgba(167,139,250,${g.blackholeTimer/4})`; ctx.lineWidth = 3
      for (let i = 1; i <= 3; i++) { ctx.beginPath(); ctx.arc(W/2, H/2, 40*i, 0, Math.PI*2); ctx.stroke() }
    }

    // immortal aura
    if (g.immortalTimer > 0) {
      ctx.strokeStyle = `rgba(255,215,0,0.6)`; ctx.lineWidth = 4
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r+12+Math.sin(Date.now()/100)*4, 0, Math.PI*2); ctx.stroke()
    }

    // blasts
    g.blasts.forEach(b => {
      ctx.strokeStyle = `rgba(255,200,50,${b.life*2})`; ctx.lineWidth = 3
      ctx.beginPath(); ctx.arc(b.x,b.y,b.r,0,Math.PI*2); ctx.stroke()
    })

    // gems and coins
    g.gems.forEach(gem => {
      ctx.shadowBlur = 10
      if (gem.isCoin) {
        ctx.shadowColor = '#ffd93d'; ctx.fillStyle = '#ffd93d'
        ctx.beginPath(); ctx.arc(gem.x, gem.y, gem.r, 0, Math.PI*2); ctx.fill()
        ctx.fillStyle = '#92400e'; ctx.font = 'bold 7px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText('$', gem.x, gem.y)
      } else {
        ctx.shadowColor = '#6bcb77'; ctx.fillStyle = '#6bcb77'
        ctx.beginPath(); ctx.arc(gem.x, gem.y, gem.r, 0, Math.PI*2); ctx.fill()
      }
      ctx.shadowBlur = 0
    })

    // bullets
    g.bullets.forEach(b => {
      ctx.shadowColor = b.color; ctx.shadowBlur = 10
      ctx.fillStyle = b.color; ctx.beginPath(); ctx.arc(b.x,b.y,b.r,0,Math.PI*2); ctx.fill()
      ctx.shadowBlur = 0
    })

    // particles
    g.particles.forEach(pt => {
      ctx.globalAlpha = pt.life/pt.maxLife; ctx.fillStyle = pt.color
      ctx.beginPath(); ctx.arc(pt.x,pt.y,pt.r,0,Math.PI*2); ctx.fill()
    })
    ctx.globalAlpha = 1

    // enemies
    g.enemies.forEach(e => {
      ctx.shadowColor = e.color; ctx.shadowBlur = 14; ctx.fillStyle = e.color
      ctx.beginPath(); ctx.arc(e.x,e.y,e.r,0,Math.PI*2); ctx.fill()
      ctx.shadowBlur = 0
      if (e.hp < e.maxHp) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(e.x-e.r,e.y-e.r-7,e.r*2,4)
        ctx.fillStyle = '#6bcb77'; ctx.fillRect(e.x-e.r,e.y-e.r-7,e.r*2*(e.hp/e.maxHp),4)
      }
    })

    // clone
    if (g.clone) {
      ctx.shadowColor = '#f472b6'; ctx.shadowBlur = 16; ctx.fillStyle = '#f472b6'
      ctx.beginPath(); ctx.arc(g.clone.x, g.clone.y, 10, 0, Math.PI*2); ctx.fill()
      ctx.shadowBlur = 0; ctx.globalAlpha = 0.6; ctx.fillStyle = '#f472b6'
      ctx.font = '8px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'
      ctx.fillText('CLONE', g.clone.x, g.clone.y-12); ctx.globalAlpha = 1
    }

    // player
    ctx.shadowColor = g.immortalTimer > 0 ? '#ffd93d' : '#a78bfa'; ctx.shadowBlur = 24
    const grad = ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,p.r)
    grad.addColorStop(0, g.immortalTimer > 0 ? '#ffd93d' : '#c4b5fd')
    grad.addColorStop(1, g.immortalTimer > 0 ? '#f59e0b' : '#7c3aed')
    ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill()
    ctx.shadowBlur = 0

    // hp ring
    ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 3
    ctx.beginPath(); ctx.arc(p.x,p.y,p.r+5,0,Math.PI*2); ctx.stroke()
    ctx.strokeStyle = p.hp>50?'#6bcb77':p.hp>25?'#ffd93d':'#ff6b6b'; ctx.lineWidth = 3
    ctx.beginPath(); ctx.arc(p.x,p.y,p.r+5,-Math.PI/2,-Math.PI/2+(p.hp/p.maxHp)*Math.PI*2); ctx.stroke()

    // freeze overlay
    if (g.powerups.freeze) {
      ctx.fillStyle = 'rgba(147,210,255,0.06)'; ctx.fillRect(0,0,W,H)
    }

    // HUD top
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0,0,W,50)
    ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = '11px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'top'
    ctx.fillText('SCORE', 16, 10)
    ctx.fillStyle = 'white'; ctx.font = 'bold 20px sans-serif'; ctx.textBaseline = 'middle'; ctx.fillText(g.score, 16, 36)

    const mins = String(Math.floor(g.time/60)).padStart(2,'0')
    const secs = String(Math.floor(g.time%60)).padStart(2,'0')
    ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = '11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top'
    ctx.fillText('TIME', W/2, 10)
    ctx.fillStyle = 'white'; ctx.font = 'bold 22px sans-serif'; ctx.textBaseline = 'middle'; ctx.fillText(`${mins}:${secs}`, W/2, 36)

    ctx.fillStyle = 'rgba(255,215,0,0.8)'; ctx.font = '11px sans-serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'top'
    ctx.fillText(`🪙 ${p.coins}`, W-16, 10)
    ctx.fillStyle = '#ff6b6b'; ctx.font = 'bold 14px sans-serif'; ctx.textBaseline = 'middle'; ctx.fillText(`⚔️ ${p.kills}`, W-90, 36)
    ctx.fillStyle = '#ffd93d'; ctx.font = 'bold 13px sans-serif'; ctx.textBaseline = 'middle'; ctx.fillText(`🏆 ${g.hs}`, W-16, 36)

    // HP bar
    ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fillRect(10,H-18,200,8)
    ctx.fillStyle=p.hp>50?'#6bcb77':p.hp>25?'#ffd93d':'#ff6b6b'; ctx.fillRect(10,H-18,200*(p.hp/p.maxHp),8)
    ctx.strokeStyle='rgba(255,255,255,0.15)'; ctx.lineWidth=1; ctx.strokeRect(10,H-18,200,8)
    ctx.fillStyle='rgba(255,255,255,0.6)'; ctx.font='10px sans-serif'; ctx.textAlign='left'; ctx.textBaseline='bottom'
    ctx.fillText(`HP ${Math.ceil(p.hp)}/${p.maxHp}`, 10, H-20)

    // XP bar
    ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fillRect(W-210,H-18,200,8)
    ctx.fillStyle='#a78bfa'; ctx.fillRect(W-210,H-18,200*(p.xp/p.xpNext),8)
    ctx.strokeStyle='rgba(255,255,255,0.15)'; ctx.lineWidth=1; ctx.strokeRect(W-210,H-18,200,8)
    ctx.fillStyle='rgba(255,255,255,0.6)'; ctx.font='10px sans-serif'; ctx.textAlign='right'; ctx.textBaseline='bottom'
    ctx.fillText(`LVL ${p.level}  XP ${p.xp}/${p.xpNext}`, W-10, H-20)

    ctx.fillStyle='rgba(255,150,50,0.7)'; ctx.font='bold 11px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='bottom'
    ctx.fillText(`WAVE ${g.wave}`, W/2, H-4)

    rafRef.current = requestAnimationFrame(loop)
  }, [spawnEnemy, fireBullet, doBlast, getChoices, endGame, applyPowerupById])

  const startGame = useCallback(() => {
    initGame()
    setPhase('playing')
    setShowShop(false)
    setTimeout(() => { rafRef.current = requestAnimationFrame(loop) }, 50)
  }, [initGame, loop])

  useEffect(() => {
    const down = (e) => {
      keysRef.current[e.key] = true
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault()
    }
    const up = (e) => { keysRef.current[e.key] = false }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      cancelAnimationFrame(rafRef.current)
      if (adIntervalRef.current) clearInterval(adIntervalRef.current)
    }
  }, [])

  const joystickRef = useRef(null)
  const handleTouchStart = (e) => { joystickRef.current = { sx: e.touches[0].clientX, sy: e.touches[0].clientY } }
  const handleTouchMove = (e) => {
    if (!joystickRef.current) return
    const dx = e.touches[0].clientX - joystickRef.current.sx
    const dy = e.touches[0].clientY - joystickRef.current.sy
    const k = keysRef.current
    k['ArrowLeft']=dx<-15; k['ArrowRight']=dx>15; k['ArrowUp']=dy<-15; k['ArrowDown']=dy>15
    e.preventDefault()
  }
  const handleTouchEnd = () => { keysRef.current = {}; joystickRef.current = null }

  const goFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen()
    else containerRef.current?.requestFullscreen()
  }

  const sideGames = games.filter(g => g.slug !== 'ikop-survival').slice(0, 12)
  const related = games.filter(g => g.slug !== 'ikop-survival').slice(0, 4)
  const catColors = {
    Action: { bg: '#fee2e2', border: '#f87171', text: '#991b1b' },
    Puzzle: { bg: '#fef3c7', border: '#fbbf24', text: '#92400e' },
    Multiplayer: { bg: '#d1fae5', border: '#34d399', text: '#065f46' },
    Racing: { bg: '#dbeafe', border: '#60a5fa', text: '#1e3a8a' },
    Sports: { bg: '#fce7f3', border: '#f472b6', text: '#831843' },
    Zombie: { bg: '#f0fdf4', border: '#86efac', text: '#166634' },
    Shooting: { bg: '#fef3c7', border: '#fbbf24', text: '#92400e' },
  }

  return (
    <div style={{ minHeight: '100vh', background: '#fafaf7', fontFamily: 'Patrick Hand, sans-serif' }}>
      <div style={{ position: 'fixed', inset: 0, backgroundImage: 'linear-gradient(#e8eef7 1px, transparent 1px), linear-gradient(90deg, #e8eef7 1px, transparent 1px)', backgroundSize: '28px 28px', opacity: 0.7, pointerEvents: 'none', zIndex: 0 }} />

      <header style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(8px)', borderBottom: '1px solid #e0e8f0', padding: '6px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', border: '2.5px solid #c4b5fd', borderRadius: '14px', padding: '4px 24px 4px 12px', background: 'rgba(255,255,255,0.95)' }}>
          <span style={{ fontSize: '18px' }}>🎮</span>
          <span style={{ fontFamily: 'Caveat, cursive', fontSize: '22px', fontWeight: 700, background: 'linear-gradient(120deg,#7c3aed,#ec4899,#f59e0b)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', paddingRight: '4px' }}>ikop</span>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f0f4ff', borderRadius: '99px', padding: '5px 14px', border: '1.5px solid #c4b5fd' }}>
          <span>🔍</span>
          <input type="text" placeholder="Search games..." onChange={e => { if (e.target.value) window.location.href = `/?search=${e.target.value}` }} style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '13px', color: '#444', width: '150px', fontFamily: 'Patrick Hand, sans-serif' }} />
        </div>
        <Link href="/" style={{ color: '#7c3aed', fontWeight: 700, textDecoration: 'none', fontSize: '13px' }}>← Back</Link>
      <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6738714121307819"
     crossorigin="anonymous"></script>
      </header>

      <main style={{ position: 'relative', zIndex: 1, maxWidth: '1300px', margin: '0 auto', padding: '10px 24px 24px' }}>
        <div style={{ marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ background: '#fee2e2', border: '2px solid #f87171', borderRadius: '99px', padding: '4px 14px', fontSize: '12px', fontWeight: 700, color: '#991b1b' }}>Action</span>
          <span style={{ background: '#fef3c7', border: '2px solid #fbbf24', borderRadius: '99px', padding: '4px 14px', fontSize: '12px', fontWeight: 700, color: '#92400e' }}>⭐ Ikop Original</span>
        </div>
        <h1 style={{ fontFamily: 'Caveat, cursive', fontSize: '26px', fontWeight: 700, color: '#1f2937', marginBottom: '8px' }}>🔮 Ikop Survival</h1>

        {/* GAME + ADS LAYOUT */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px', gap: '12px', alignItems: 'start', marginBottom: '14px' }}>

          {/* CENTER — game (takes up the big column) */}
          <div>
            <div ref={containerRef} style={{ position: 'relative', borderRadius: '16px', overflow: 'hidden', border: '3px solid #a78bfa', boxShadow: '0 8px 32px rgba(124,58,237,0.2)', background: '#0d0d1a', width: '100%' }}>
              <canvas ref={canvasRef} width={W} height={H}
                style={{ display: 'block', width: '100%', touchAction: 'none' }}
                onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
              />

              <button onClick={goFullscreen} style={{ position: 'absolute', bottom: '36px', right: '12px', background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', color: 'white', fontSize: '16px', cursor: 'pointer', padding: '6px 10px', zIndex: 10 }}>⛶</button>

              {/* shop button */}
              {phase === 'playing' && (
                <button onClick={() => { gameRef.current.running = false; cancelAnimationFrame(rafRef.current); setShowShop(true); setPhase('shop') }}
                  style={{ position: 'absolute', bottom: '36px', left: '12px', background: 'rgba(255,215,0,0.85)', border: 'none', borderRadius: '8px', color: '#92400e', fontSize: '13px', fontWeight: 700, cursor: 'pointer', padding: '6px 12px', zIndex: 10, fontFamily: 'Patrick Hand, sans-serif' }}>
                  🪙 Shop ({coins})
                </button>
              )}

              {/* START */}
              {phase === 'start' && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(13,13,26,0.95)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
                  <p style={{ fontSize: '64px', margin: 0 }}>🔮</p>
                  <p style={{ fontFamily: 'Caveat, cursive', fontSize: '52px', fontWeight: 700, color: '#a78bfa', margin: 0 }}>Ikop Survival</p>
                  <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '15px', textAlign: 'center', maxWidth: '340px', margin: 0, lineHeight: 1.6 }}>
                    Use <strong style={{ color: '#a78bfa' }}>WASD</strong> or <strong style={{ color: '#a78bfa' }}>Arrow Keys</strong> to move.<br/>
                    Auto-shoot enemies • Collect 💚 gems to level up<br/>
                    Collect 🪙 coins to buy upgrades in the shop!
                  </p>
                  <p style={{ color: '#ffd93d', fontSize: '13px', margin: 0 }}>🏆 Best: {getHS()} &nbsp;|&nbsp; 🪙 Coins: {getCoins()}</p>
                  <button onClick={startGame} style={{ background: 'linear-gradient(135deg,#7c3aed,#ec4899)', color: 'white', border: 'none', borderRadius: '99px', padding: '16px 48px', fontSize: '22px', fontFamily: 'Caveat, cursive', fontWeight: 700, cursor: 'pointer' }}>
                    Start Surviving! 🔮
                  </button>
                </div>
              )}

              {/* LEVEL UP */}
              {phase === 'levelup' && levelUpChoices && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(13,13,26,0.96)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px' }}>
                  <p style={{ fontFamily: 'Caveat, cursive', fontSize: '44px', fontWeight: 700, color: '#ffd93d', margin: 0 }}>⬆️ Level Up!</p>
                  <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', margin: 0 }}>Choose an upgrade:</p>
                  <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', justifyContent: 'center' }}>
                    {levelUpChoices.map(choice => (
                      <button key={choice.id} onClick={() => applyPowerup(choice.id)}
                        style={{ background: rarityBg[choice.rarity], border: `2px solid ${rarityColors[choice.rarity]}`, borderRadius: '16px', padding: '20px 22px', cursor: 'pointer', textAlign: 'center', width: '165px', color: 'white', fontFamily: 'Patrick Hand, sans-serif', transition: 'all 0.15s' }}
                        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.07)'; e.currentTarget.style.background = rarityBg[choice.rarity].replace('0.15', '0.3') }}
                        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.background = rarityBg[choice.rarity] }}>
                        <p style={{ fontSize: '36px', margin: '0 0 8px' }}>{choice.emoji}</p>
                        <p style={{ fontSize: '11px', color: rarityColors[choice.rarity], margin: '0 0 4px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>{choice.rarity}</p>
                        <p style={{ fontFamily: 'Caveat, cursive', fontSize: '18px', fontWeight: 700, color: 'white', margin: '0 0 6px' }}>{choice.name}</p>
                        <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', margin: 0 }}>{choice.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* SHOP */}
              {phase === 'shop' && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(13,13,26,0.97)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', padding: '20px' }}>
                  <p style={{ fontFamily: 'Caveat, cursive', fontSize: '40px', fontWeight: 700, color: '#ffd93d', margin: 0 }}>🪙 Upgrade Shop</p>
                  <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', margin: 0 }}>Your coins: <strong style={{ color: '#ffd93d' }}>{coins}</strong></p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', width: '100%', maxWidth: '600px' }}>
                    {SHOP_ITEMS.map(item => {
                      const canAfford = coins >= item.cost
                      return (
                        <button key={item.id} onClick={() => buyShopItem(item)}
                          disabled={!canAfford}
                          style={{ background: canAfford ? 'rgba(255,215,0,0.1)' : 'rgba(255,255,255,0.03)', border: `2px solid ${canAfford ? '#ffd93d' : 'rgba(255,255,255,0.1)'}`, borderRadius: '12px', padding: '14px 10px', cursor: canAfford ? 'pointer' : 'not-allowed', textAlign: 'center', color: 'white', fontFamily: 'Patrick Hand, sans-serif', opacity: canAfford ? 1 : 0.5, transition: 'all 0.15s' }}
                          onMouseEnter={e => { if (canAfford) e.currentTarget.style.background = 'rgba(255,215,0,0.2)' }}
                          onMouseLeave={e => { if (canAfford) e.currentTarget.style.background = 'rgba(255,215,0,0.1)' }}>
                          <p style={{ fontSize: '28px', margin: '0 0 6px' }}>{item.emoji}</p>
                          <p style={{ fontSize: '13px', fontWeight: 700, color: 'white', margin: '0 0 4px' }}>{item.name}</p>
                          <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', margin: '0 0 8px' }}>{item.desc}</p>
                          <p style={{ fontSize: '14px', fontWeight: 700, color: '#ffd93d', margin: 0 }}>🪙 {item.cost}</p>
                        </button>
                      )
                    })}
                  </div>
                  <button onClick={() => { const g = gameRef.current; if (g) { g.running = true; g.lastTime = performance.now(); setPhase('playing'); rafRef.current = requestAnimationFrame(loop) } }}
                    style={{ background: 'linear-gradient(135deg,#7c3aed,#ec4899)', color: 'white', border: 'none', borderRadius: '99px', padding: '12px 36px', fontSize: '18px', fontFamily: 'Caveat, cursive', fontWeight: 700, cursor: 'pointer' }}>
                    Back to Game ▶
                  </button>
                </div>
              )}

              {/* DEAD */}
              {phase === 'dead' && !watchingAd && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(13,13,26,0.96)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                  <p style={{ fontSize: '52px', margin: 0 }}>💀</p>
                  <p style={{ fontFamily: 'Caveat, cursive', fontSize: '44px', fontWeight: 700, color: '#ff6b6b', margin: 0 }}>You Died!</p>
                  <div style={{ display: 'flex', gap: '24px', margin: '6px 0' }}>
                    {[['SCORE', stats.score, '#ffd93d'], ['TIME', `${Math.floor(stats.time/60)}:${String(stats.time%60).padStart(2,'0')}`, 'white'], ['KILLS', stats.kills, '#ff6b6b'], ['COINS', `🪙${stats.coins}`, '#ffd93d']].map(([label, val, color]) => (
                      <div key={label} style={{ textAlign: 'center' }}>
                        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', margin: '0 0 3px' }}>{label}</p>
                        <p style={{ color, fontSize: '24px', fontWeight: 700, margin: 0 }}>{val}</p>
                      </div>
                    ))}
                  </div>
                  {stats.score >= stats.highScore && stats.score > 0 && <p style={{ color: '#6bcb77', fontSize: '16px', fontWeight: 700, margin: 0 }}>🎉 New High Score!</p>}
                  <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', margin: 0 }}>🏆 Best: {stats.highScore}</p>

                  {/* WATCH AD REVIVE */}
                  <div style={{ background: 'rgba(255,215,0,0.1)', border: '2px solid #ffd93d', borderRadius: '14px', padding: '14px 20px', textAlign: 'center', margin: '4px 0' }}>
                    <p style={{ color: '#ffd93d', fontSize: '14px', fontWeight: 700, margin: '0 0 8px' }}>💊 Continue Playing?</p>
                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', margin: '0 0 10px' }}>Watch a short ad to revive with 50% HP</p>
                    <button onClick={watchAdRespawn}
                      style={{ background: 'linear-gradient(135deg,#ffd93d,#f59e0b)', color: '#92400e', border: 'none', borderRadius: '99px', padding: '10px 28px', fontSize: '15px', fontFamily: 'Caveat, cursive', fontWeight: 700, cursor: 'pointer' }}>
                      ▶ Watch Ad & Revive!
                    </button>
                  </div>

                  <button onClick={startGame}
                    style={{ background: 'linear-gradient(135deg,#7c3aed,#ec4899)', color: 'white', border: 'none', borderRadius: '99px', padding: '12px 36px', fontSize: '18px', fontFamily: 'Caveat, cursive', fontWeight: 700, cursor: 'pointer' }}>
                    Try Again! 🔄
                  </button>
                </div>
              )}

              {/* WATCHING AD */}
              {watchingAd && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.97)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
                  <p style={{ fontFamily: 'Caveat, cursive', fontSize: '32px', color: '#ffd93d', margin: 0 }}>📺 Ad Playing...</p>
                  <div style={{ width: '300px', height: '180px', background: 'rgba(255,255,255,0.05)', border: '2px solid rgba(255,255,255,0.1)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '14px' }}>[ Ad Space — Place your ad here ]</p>
                  </div>
                  <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', margin: 0 }}>Reviving in <strong style={{ color: '#ffd93d' }}>{adTimer}</strong> seconds...</p>
                  <div style={{ width: '200px', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '99px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: '#ffd93d', borderRadius: '99px', width: `${((5-adTimer)/5)*100}%`, transition: 'width 0.9s' }} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT — ad slot */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <AdSlot style={{ minHeight: '250px' }} />
          </div>
        </div>

        {/* BOTTOM GAMES GRID */}
        <div style={{ marginTop: '14px' }}>
          <p style={{ fontFamily: 'Caveat, cursive', fontSize: '18px', fontWeight: 700, color: '#5b21b6', margin: '0 0 10px' }}>🕹️ More Games You'll Love</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '8px' }}>
            {games.filter(g => g.slug !== 'ikop-survival').slice(0, 12).map(g => {
              const c = catColors[g.category] || catColors.Action
              return (
                <Link key={g.slug} href={`/games/${g.slug}`} style={{ textDecoration: 'none' }}>
                  <div style={{ borderRadius: '10px', overflow: 'hidden', border: `2px solid ${c.border}`, background: 'white', transition: 'transform 0.15s', boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}
                    onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                    onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
                    <div style={{ aspectRatio: '1', background: c.bg, overflow: 'hidden' }}>
                      <img src={g.thumbnail} alt={g.title} style={{ width: '100%', height: '100%', objectFit: 'contain' }} onError={e => { e.target.style.display = 'none' }} />
                    </div>
                    <div style={{ padding: '4px 6px', borderTop: `2px solid ${c.border}` }}>
                      <p style={{ fontWeight: 700, fontSize: '11px', color: '#222', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.title}</p>
                      <p style={{ fontSize: '10px', color: c.text, margin: '2px 0 0', fontWeight: 700 }}>{g.category}</p>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>

        {/* about + how to play */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', margin: '14px 0' }}>
          <div style={{ background: 'white', borderRadius: '14px', border: '2px solid #a78bfa', padding: '14px' }}>
            <h2 style={{ fontFamily: 'Caveat, cursive', fontSize: '18px', color: '#5b21b6', marginBottom: '6px' }}>About Ikop Survival</h2>
            <p style={{ color: '#555', fontSize: '14px', lineHeight: 1.6, margin: 0 }}>A wave-based survival game made right here at Ikop! Fight waves of enemies, collect XP gems to level up, earn coins to buy upgrades, and unlock legendary powerups as you survive longer!</p>
          </div>
          <div style={{ background: 'white', borderRadius: '14px', border: '2px solid #c4b5fd', padding: '14px' }}>
            <h2 style={{ fontFamily: 'Caveat, cursive', fontSize: '18px', color: '#5b21b6', marginBottom: '6px' }}>How to Play</h2>
            <p style={{ color: '#555', fontSize: '13px', lineHeight: 1.8, margin: 0 }}>
              ⌨️ WASD / Arrow Keys to move<br/>
              🔫 Auto-shoots nearest enemy<br/>
              💚 Collect gems → level up → powerup<br/>
              🪙 Collect coins → Shop upgrades<br/>
              ☢️ Survive longer for Legendary powers!
            </p>
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