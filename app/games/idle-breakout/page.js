'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { games } from '../../data/games'
import AdSlot from '../../components/AdSlot'

const COLS = 10
const ROWS = 10
const BRICK_W = 70
const BRICK_H = 32
const CW = 720
const CH = 480
const TOP = 52

const BALL_TYPES = [
  { id: 'basic',   name: 'Basic',   emoji: '🟡', color: '#f59e0b', cost: 25,     dmg: 1,   spd: 140, desc: '1 dmg/hit' },
  { id: 'plasma',  name: 'Plasma',  emoji: '🟣', color: '#ec4899', cost: 500,    dmg: 5,   spd: 170, desc: '5 dmg/hit' },
  { id: 'sniper',  name: 'Sniper',  emoji: '🔵', color: '#3b82f6', cost: 2000,   dmg: 25,  spd: 280, desc: '25 dmg/hit, fast' },
  { id: 'scatter', name: 'Scatter', emoji: '🟢', color: '#10b981', cost: 10000,  dmg: 10,  spd: 155, desc: '10 dmg, splits' },
  { id: 'cannon',  name: 'Cannon',  emoji: '⚫', color: '#6b7280', cost: 50000,  dmg: 120, spd: 110, desc: '120 dmg/hit' },
  { id: 'poison',  name: 'Poison',  emoji: '🔴', color: '#ef4444', cost: 200000, dmg: 60,  spd: 160, desc: '60 dmg + poison' },
]

function fmt(n) {
  if (n >= 1e12) return (n/1e12).toFixed(2)+'T'
  if (n >= 1e9)  return (n/1e9).toFixed(2)+'B'
  if (n >= 1e6)  return (n/1e6).toFixed(2)+'M'
  if (n >= 1e3)  return (n/1e3).toFixed(1)+'K'
  return Math.floor(n)+''
}

function brickX(col) { return (CW - COLS*BRICK_W)/2 + col*BRICK_W }
function brickY(row) { return TOP + row*BRICK_H }

function makeBricks(level) {
  const bricks = []
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const hp = Math.floor(10 * Math.pow(1.18, level-1 + r*0.5))
      bricks.push({ r, c, hp, maxHp: hp, poisoned: false, alive: true })
    }
  }
  return bricks
}

function newBall(type, upgrade=1) {
  const angle = -Math.PI/2 + (Math.random()-0.5)*1.2
  const spd = type.spd * (1 + (upgrade-1)*0.15)
  const dmg = type.dmg * Math.pow(1.5, upgrade-1)
  return {
    id: Math.random().toString(36),
    typeId: type.id,
    color: type.color,
    x: CW/2 + (Math.random()-0.5)*300,
    y: CH - 20,
    vx: Math.cos(angle)*spd,
    vy: Math.sin(angle)*spd,
    r: type.id==='cannon'?13:type.id==='sniper'?5:8,
    dmg, spd, upgrade,
    poisonBall: type.id==='poison',
    scatterBall: type.id==='scatter',
  }
}

function saveGame(state) {
  try {
    localStorage.setItem('ib2-save', JSON.stringify({
      money: state.money,
      level: state.level,
      clickPow: state.clickPow,
      ballDefs: state.balls.map(b => ({ typeId: b.typeId, upgrade: b.upgrade })),
    }))
  } catch {}
}

function loadGame() {
  try {
    const s = JSON.parse(localStorage.getItem('ib2-save') || 'null')
    return s
  } catch { return null }
}

export default function IdleBreakout() {
  const canvasRef = useRef(null)
  const rafRef = useRef(null)
  const sRef = useRef(null)
  const lastRef = useRef(0)
  const [ui, setUi] = useState({ money: 0, level: 1, clickPow: 1, ballCounts: {} })
  const [tab, setTab] = useState('buy')
  const [, forceRender] = useState(0)

  useEffect(() => {
    const saved = loadGame()
    const level = saved?.level || 1
    const money = saved?.money || 0
    const clickPow = saved?.clickPow || 1
    const balls = (saved?.ballDefs || []).map(bd => {
      const type = BALL_TYPES.find(t => t.id === bd.typeId) || BALL_TYPES[0]
      return newBall(type, bd.upgrade)
    })

    sRef.current = {
      money, level, clickPow,
      bricks: makeBricks(level),
      balls,
      particles: [],
      floats: [],
      poisonTimers: {},
    }
    setUi({ money, level, clickPow, ballCounts: countBalls(balls) })

    lastRef.current = performance.now()
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  function countBalls(balls) {
    const c = {}
    balls.forEach(b => { c[b.typeId] = (c[b.typeId]||0)+1 })
    return c
  }

  const tick = useCallback(ts => {
    const s = sRef.current
    const canvas = canvasRef.current
    if (!s || !canvas) { rafRef.current = requestAnimationFrame(tick); return }
    const ctx = canvas.getContext('2d')
    const dt = Math.min((ts - lastRef.current)/1000, 0.05)
    lastRef.current = ts

    // poison tick
    s.bricks.forEach(b => {
      if (!b.alive || !b.poisoned) return
      b.hp -= 8 * dt
      if (b.hp <= 0) destroyBrick(s, b)
    })

    // move balls + collide
    const toAdd = []
    s.balls.forEach(ball => {
      ball.x += ball.vx * dt
      ball.y += ball.vy * dt
      if (ball.x - ball.r < 0) { ball.x = ball.r; ball.vx = Math.abs(ball.vx) }
      if (ball.x + ball.r > CW) { ball.x = CW - ball.r; ball.vx = -Math.abs(ball.vx) }
      if (ball.y - ball.r < 0) { ball.y = ball.r; ball.vy = Math.abs(ball.vy) }
      if (ball.y + ball.r > CH) { ball.y = CH - ball.r; ball.vy = -Math.abs(ball.vy) }

      s.bricks.forEach(brick => {
        if (!brick.alive) return
        const bx = brickX(brick.c), by = brickY(brick.r)
        const cx2 = bx + BRICK_W/2, cy2 = by + BRICK_H/2
        const dx = ball.x - cx2, dy = ball.y - cy2
        if (Math.abs(dx) < BRICK_W/2 + ball.r && Math.abs(dy) < BRICK_H/2 + ball.r) {
          brick.hp -= ball.dmg
          if (ball.poisonBall) brick.poisoned = true
          // bounce direction
          if (Math.abs(dx)/(BRICK_W/2) > Math.abs(dy)/(BRICK_H/2)) {
            ball.vx = dx > 0 ? Math.abs(ball.vx) : -Math.abs(ball.vx)
          } else {
            ball.vy = dy > 0 ? Math.abs(ball.vy) : -Math.abs(ball.vy)
          }
          // scatter mini balls
          if (ball.scatterBall && Math.random() < 0.12) {
            const ang = Math.atan2(ball.vy, ball.vx) + (Math.random()-0.5)*1.4
            const sp = Math.hypot(ball.vx, ball.vy) * 0.65
            toAdd.push({
              id: Math.random()+'', typeId: 'scatter', color: '#10b981',
              x: ball.x, y: ball.y,
              vx: Math.cos(ang)*sp, vy: Math.sin(ang)*sp,
              r: 4, dmg: ball.dmg*0.4, spd: sp,
              poisonBall: false, scatterBall: false,
              upgrade: 1, _temp: true, _life: 1.5,
            })
          }
          s.particles.push(...hitParticles(ball.x, ball.y, ball.color))
          if (brick.hp <= 0) destroyBrick(s, brick)
        }
      })
    })
    toAdd.forEach(b => s.balls.push(b))
    s.balls = s.balls.filter(b => !b._temp || (b._life -= dt) > 0)

    // level complete
    if (s.bricks.every(b => !b.alive)) {
      s.level++
      const bonus = s.level * 300
      s.money += bonus
      s.bricks = makeBricks(s.level)
      s.floats.push({ x: CW/2, y: CH/2-30, text: `LEVEL ${s.level}!  +$${fmt(bonus)}`, color: '#ffd93d', life: 2.5, maxLife: 2.5, big: true })
      saveGame(s)
    }

    s.particles = s.particles.filter(p => { p.x+=p.vx*dt; p.y+=p.vy*dt; p.life-=dt; return p.life>0 })
    s.floats = s.floats.filter(f => { f.y-=30*dt; f.life-=dt; return f.life>0 })

    draw(ctx, s, ts)
    setUi({ money: Math.floor(s.money), level: s.level, clickPow: s.clickPow, ballCounts: countBalls(s.balls.filter(b => !b._temp)) })
    rafRef.current = requestAnimationFrame(tick)
  }, [])

  function destroyBrick(s, brick) {
    brick.alive = false
    const reward = Math.max(1, brick.maxHp * 0.08 + s.level)
    s.money += reward
    s.floats.push({ x: brickX(brick.c)+BRICK_W/2, y: brickY(brick.r)+BRICK_H/2, text: `+$${fmt(reward)}`, color: '#ffd93d', life: 0.9, maxLife: 0.9, big: false })
  }

  function hitParticles(x, y, color) {
    return Array.from({length:4}, () => ({
      x, y, color,
      vx: (Math.random()-0.5)*180, vy: (Math.random()-0.5)*180,
      life: 0.28, maxLife: 0.28, r: 2+Math.random()*3,
    }))
  }

  function draw(ctx, s, ts) {
    // background
    ctx.fillStyle = '#e8dcc8'
    ctx.fillRect(0, 0, CW, CH)

    // grid lines (notebook feel)
    ctx.strokeStyle = 'rgba(0,0,0,0.06)'; ctx.lineWidth = 1
    for (let x = 0; x <= CW; x += BRICK_W) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,CH); ctx.stroke() }
    for (let y = TOP; y <= CH; y += BRICK_H) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(CW,y); ctx.stroke() }

    // border
    ctx.strokeStyle = '#8b7355'; ctx.lineWidth = 4
    ctx.strokeRect(2, TOP-2, CW-4, CH-TOP)

    // bricks
    const brickColors = ['#2c3e50','#8b0000','#006400','#00008b','#4b0082','#8b4513','#2f4f4f','#800000','#483d8b','#2e8b57']
    s.bricks.forEach(brick => {
      if (!brick.alive) return
      const pct = Math.max(0, brick.hp / brick.maxHp)
      const bx = brickX(brick.c), by = brickY(brick.r)
      const baseColor = brickColors[brick.r % brickColors.length]

      ctx.globalAlpha = 0.5 + pct*0.5
      ctx.fillStyle = baseColor
      ctx.fillRect(bx+1, by+1, BRICK_W-2, BRICK_H-2)

      // hp text
      ctx.globalAlpha = 1
      ctx.fillStyle = 'white'; ctx.font = 'bold 9px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.shadowColor = 'black'; ctx.shadowBlur = 3
      ctx.fillText(fmt(Math.max(0,brick.hp)), bx+BRICK_W/2, by+BRICK_H/2)
      ctx.shadowBlur = 0

      // hp bar
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(bx+2, by+BRICK_H-5, BRICK_W-4, 4)
      ctx.fillStyle = pct>0.6?'#00c853':pct>0.3?'#ffd600':'#d50000'
      ctx.fillRect(bx+2, by+BRICK_H-5, (BRICK_W-4)*pct, 4)

      // poison overlay
      if (brick.poisoned) {
        ctx.fillStyle = 'rgba(255,0,0,0.15)'
        ctx.fillRect(bx+1, by+1, BRICK_W-2, BRICK_H-2)
      }

      // border
      ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 0.5
      ctx.strokeRect(bx+1, by+1, BRICK_W-2, BRICK_H-2)
    })

    // particles
    s.particles.forEach(p => {
      ctx.globalAlpha = p.life/p.maxLife
      ctx.fillStyle = p.color
      ctx.beginPath(); ctx.arc(p.x,p.y,p.r*(p.life/p.maxLife),0,Math.PI*2); ctx.fill()
    })
    ctx.globalAlpha = 1

    // balls
    s.balls.forEach(ball => {
      ctx.shadowColor = ball.color; ctx.shadowBlur = 8
      ctx.fillStyle = ball.color
      ctx.beginPath(); ctx.arc(ball.x,ball.y,ball.r,0,Math.PI*2); ctx.fill()
      // shine
      ctx.fillStyle = 'rgba(255,255,255,0.5)'
      ctx.beginPath(); ctx.arc(ball.x-ball.r*0.3,ball.y-ball.r*0.3,ball.r*0.35,0,Math.PI*2); ctx.fill()
      ctx.shadowBlur = 0
    })

    // floating texts
    s.floats.forEach(f => {
      ctx.globalAlpha = Math.min(1, f.life/f.maxLife*2)
      ctx.fillStyle = f.color
      ctx.font = `bold ${f.big?18:11}px Arial`; ctx.textAlign='center'; ctx.textBaseline='middle'
      ctx.shadowColor='black'; ctx.shadowBlur=4
      ctx.fillText(f.text, f.x, f.y)
      ctx.shadowBlur=0
    })
    ctx.globalAlpha=1

    // HUD top bar
    ctx.fillStyle = '#2c2c2c'; ctx.fillRect(0,0,CW,TOP-2)
    ctx.fillStyle='#ffd93d'; ctx.font='bold 13px Arial'; ctx.textAlign='left'; ctx.textBaseline='middle'
    ctx.fillText(`$ ${fmt(s.money)}`, 10, 17)
    ctx.fillStyle='#a78bfa'; ctx.fillText(`Level ${s.level}`, 10, 36)
    ctx.fillStyle='rgba(255,255,255,0.6)'; ctx.font='11px Arial'; ctx.textAlign='right'
    ctx.fillText(`${s.balls.filter(b=>!b._temp).length} balls  |  click: $${fmt(s.clickPow)}/hit`, CW-10, 17)
    ctx.fillText('Click bricks to deal damage!', CW-10, 36)
  }

  const handleClick = useCallback(e => {
    const s = sRef.current; if (!s) return
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const mx = (e.clientX-rect.left)*(CW/rect.width)
    const my = (e.clientY-rect.top)*(CH/rect.height)
    let hit = false
    s.bricks.forEach(brick => {
      if (!brick.alive||hit) return
      const bx=brickX(brick.c), by=brickY(brick.r)
      if (mx>bx&&mx<bx+BRICK_W&&my>by&&my<by+BRICK_H) {
        brick.hp -= s.clickPow
        s.floats.push({ x:mx, y:my, text:`-${fmt(s.clickPow)}`, color:'#ff6b6b', life:0.6, maxLife:0.6, big:false })
        s.particles.push(...hitParticles(mx,my,'#ff6b6b'))
        if (brick.hp<=0) destroyBrick(s,brick)
        hit=true
      }
    })
  }, [])

  const buyBall = useCallback(type => {
    const s = sRef.current; if (!s||s.money<type.cost) return
    s.money -= type.cost
    const ball = newBall(type)
    s.balls.push(ball)
    saveGame(s)
    forceRender(n=>n+1)
  }, [])

  const upgradeBalls = useCallback((typeId, stat) => {
    const s = sRef.current; if (!s) return
    const ballsOfType = s.balls.filter(b=>b.typeId===typeId&&!b._temp)
    if (ballsOfType.length===0) return
    const type = BALL_TYPES.find(t=>t.id===typeId)
    const cost = Math.floor(type.cost * 0.6 * ballsOfType[0].upgrade)
    if (s.money < cost) return
    s.money -= cost
    ballsOfType.forEach(b => {
      b.upgrade++
      if (stat==='dmg') b.dmg *= 1.5
      if (stat==='spd') {
        b.spd *= 1.18
        const ang = Math.atan2(b.vy,b.vx)
        b.vx=Math.cos(ang)*b.spd; b.vy=Math.sin(ang)*b.spd
      }
    })
    saveGame(s)
    forceRender(n=>n+1)
  }, [])

  const upgradeClick = useCallback(() => {
    const s = sRef.current; if (!s) return
    const cost = Math.floor(s.clickPow * 50)
    if (s.money < cost) return
    s.money -= cost
    s.clickPow = Math.floor(s.clickPow * 2)
    saveGame(s)
    forceRender(n=>n+1)
  }, [])

  const realBalls = sRef.current?.balls.filter(b=>!b._temp) || []
  const grouped = {}
  realBalls.forEach(b => { if (!grouped[b.typeId]) grouped[b.typeId]={typeId:b.typeId,count:0,upgrade:b.upgrade}; grouped[b.typeId].count++ })

  const related = games.filter(g => g.slug !== 'idle-breakout').slice(0, 4)
  const catColors2 = {
    Action:{bg:'#fee2e2',border:'#f87171',text:'#991b1b'},
    Puzzle:{bg:'#fef3c7',border:'#fbbf24',text:'#92400e'},
    Multiplayer:{bg:'#d1fae5',border:'#34d399',text:'#065f46'},
    Racing:{bg:'#dbeafe',border:'#60a5fa',text:'#1e3a8a'},
    Sports:{bg:'#fce7f3',border:'#f472b6',text:'#831843'},
    Zombie:{bg:'#f0fdf4',border:'#86efac',text:'#166534'},
    Shooting:{bg:'#fff1f2',border:'#fda4af',text:'#9f1239'},
    Word:{bg:'#eff6ff',border:'#93c5fd',text:'#1e40af'},
    Adventure:{bg:'#fff7ed',border:'#fdba74',text:'#9a3412'},
  }

  return (
    <div style={{minHeight:'100vh',background:'#f8f9ff',fontFamily:'Patrick Hand, sans-serif'}}>
      <div style={{position:'fixed',inset:0,backgroundImage:'linear-gradient(#e8eef7 1px,transparent 1px),linear-gradient(90deg,#e8eef7 1px,transparent 1px)',backgroundSize:'28px 28px',opacity:0.5,pointerEvents:'none',zIndex:0}}/>
      <header style={{position:'sticky',top:0,zIndex:50,background:'rgba(255,255,255,0.92)',backdropFilter:'blur(12px)',borderBottom:'1px solid #e5e7eb',padding:'10px 24px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:'16px'}}>
        <Link href="/" style={{textDecoration:'none',display:'flex',alignItems:'center',gap:'8px',border:'2px solid #e0d7ff',borderRadius:'14px',padding:'6px 32px 6px 14px',background:'white',flexShrink:0}}>
          <span style={{fontSize:'20px'}}>🎮</span>
          <span style={{fontFamily:'Caveat, cursive',fontSize:'26px',fontWeight:700,background:'linear-gradient(120deg,#7c3aed,#ec4899,#f59e0b)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>ikop</span>
        </Link>
        <div style={{display:'flex',alignItems:'center',gap:'6px',background:'#f3f4f6',borderRadius:'99px',padding:'8px 18px',border:'2px solid #e5e7eb',flex:1,maxWidth:'400px'}}>
          <span style={{color:'#9ca3af'}}>🔍</span>
          <input type="text" placeholder="Search games..." onChange={e=>{if(e.target.value)window.location.href=`/?search=${e.target.value}`}} style={{border:'none',background:'transparent',outline:'none',fontSize:'14px',color:'#374151',width:'100%',fontFamily:'Patrick Hand, sans-serif'}}/>
        </div>
        <Link href="/" style={{color:'#7c3aed',fontWeight:700,textDecoration:'none',fontSize:'13px',flexShrink:0}}>← Back</Link>
      </header>

      <main style={{position:'relative',zIndex:1,maxWidth:'1300px',margin:'0 auto',padding:'16px 24px 40px'}}>
        <div style={{marginBottom:'8px',display:'flex',alignItems:'center',gap:'8px'}}>
          <span style={{background:'#fef3c7',border:'2px solid #fbbf24',borderRadius:'99px',padding:'4px 14px',fontSize:'12px',fontWeight:700,color:'#92400e'}}>Puzzle</span>
          <span style={{background:'#fef3c7',border:'2px solid #fbbf24',borderRadius:'99px',padding:'4px 14px',fontSize:'12px',fontWeight:700,color:'#92400e'}}>⭐ Ikop Original</span>
        </div>
        <h1 style={{fontFamily:'Caveat, cursive',fontSize:'28px',fontWeight:700,color:'#1f2937',marginBottom:'14px'}}>🧱 Idle Breakout</h1>

        <div style={{display:'grid',gridTemplateColumns:'1fr 300px',gap:'16px',alignItems:'start',marginBottom:'16px'}}>
          <div>
            <div style={{borderRadius:'16px',overflow:'hidden',border:'3px solid #7c3aed',boxShadow:'0 8px 32px rgba(124,58,237,0.2)',cursor:'crosshair'}}>
              <canvas ref={canvasRef} width={CW} height={CH} style={{display:'block',width:'100%'}} onClick={handleClick}/>
            </div>
            <div style={{background:'white',borderRadius:'12px',border:'2px solid #e0d7ff',padding:'8px 14px',marginTop:'8px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <span style={{fontSize:'13px',color:'#555'}}>🖱️ Click bricks to deal damage • Balls bounce automatically</span>
              <button onClick={upgradeClick} style={{background:'linear-gradient(135deg,#7c3aed,#ec4899)',color:'white',border:'none',borderRadius:'8px',padding:'7px 14px',fontSize:'12px',cursor:'pointer',fontFamily:'Patrick Hand, sans-serif',fontWeight:700,whiteSpace:'nowrap'}}>
                ⬆️ Click Power (${fmt(ui.clickPow*50)})
              </button>
            </div>
          </div>

          <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
            <div style={{background:'white',borderRadius:'14px',border:'2px solid #a78bfa',padding:'12px'}}>
              <p style={{fontFamily:'Caveat, cursive',fontSize:'16px',color:'#5b21b6',margin:'0 0 8px'}}>📊 Stats</p>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'5px'}}>
                {[['💰',fmt(ui.money)],['🎯 Lvl',ui.level],['🎱 Balls',realBalls.length],['🖱️',fmt(ui.clickPow)]].map(([l,v])=>(
                  <div key={l} style={{background:'#f8f9ff',borderRadius:'8px',padding:'5px 8px'}}>
                    <p style={{fontSize:'10px',color:'#9ca3af',margin:0}}>{l}</p>
                    <p style={{fontSize:'14px',fontWeight:700,color:'#1f2937',margin:0}}>{v}</p>
                  </div>
                ))}
              </div>
            </div>

            <div style={{background:'white',borderRadius:'14px',border:'2px solid #e0d7ff',overflow:'hidden'}}>
              <div style={{display:'flex',borderBottom:'1px solid #e5e7eb'}}>
                {[['buy','🛒 Buy'],['upgrade','⬆️ Upgrade']].map(([id,label])=>(
                  <button key={id} onClick={()=>setTab(id)} style={{flex:1,padding:'9px',border:'none',background:tab===id?'#7c3aed':'white',color:tab===id?'white':'#6b7280',fontWeight:700,fontSize:'12px',cursor:'pointer',fontFamily:'Patrick Hand, sans-serif'}}>
                    {label}
                  </button>
                ))}
              </div>
              <div style={{padding:'8px',maxHeight:'280px',overflowY:'auto'}}>
                {tab==='buy' && BALL_TYPES.map(type=>{
                  const can = ui.money>=type.cost
                  return (
                    <div key={type.id} style={{display:'flex',alignItems:'center',gap:'7px',padding:'7px',borderRadius:'10px',background:can?'#f8f9ff':'#fafafa',border:`2px solid ${can?type.color:'#e5e7eb'}`,marginBottom:'5px',opacity:can?1:0.55}}>
                      <span style={{fontSize:'18px'}}>{type.emoji}</span>
                      <div style={{flex:1,minWidth:0}}>
                        <p style={{fontWeight:700,fontSize:'12px',color:'#1f2937',margin:0}}>{type.name}</p>
                        <p style={{fontSize:'9px',color:'#9ca3af',margin:0}}>{type.desc}</p>
                        {ui.ballCounts[type.id]&&<p style={{fontSize:'9px',color:type.color,margin:0}}>x{ui.ballCounts[type.id]} owned</p>}
                      </div>
                      <button onClick={()=>buyBall(type)} disabled={!can} style={{background:can?type.color:'#e5e7eb',color:can?'white':'#9ca3af',border:'none',borderRadius:'7px',padding:'5px 8px',fontSize:'10px',cursor:can?'pointer':'not-allowed',fontWeight:700,whiteSpace:'nowrap',fontFamily:'Patrick Hand, sans-serif'}}>
                        ${fmt(type.cost)}
                      </button>
                    </div>
                  )
                })}
                {tab==='upgrade'&&Object.values(grouped).length===0&&(
                  <p style={{color:'#9ca3af',textAlign:'center',padding:'20px 0',fontSize:'12px'}}>Buy some balls first!</p>
                )}
                {tab==='upgrade'&&Object.values(grouped).map(g=>{
                  const type=BALL_TYPES.find(t=>t.id===g.typeId)||BALL_TYPES[0]
                  const cost=Math.floor(type.cost*0.6*g.upgrade)
                  const can=ui.money>=cost
                  return (
                    <div key={g.typeId} style={{padding:'7px',borderRadius:'10px',background:'#f8f9ff',border:`2px solid ${type.color}`,marginBottom:'5px'}}>
                      <div style={{display:'flex',alignItems:'center',gap:'5px',marginBottom:'5px'}}>
                        <span style={{fontSize:'14px'}}>{type.emoji}</span>
                        <span style={{fontWeight:700,fontSize:'11px',color:'#1f2937'}}>{type.name} x{g.count}</span>
                        <span style={{fontSize:'9px',color:'#9ca3af'}}>Lv.{g.upgrade}</span>
                      </div>
                      <div style={{display:'flex',gap:'4px'}}>
                        <button onClick={()=>upgradeBalls(g.typeId,'dmg')} disabled={!can} style={{flex:1,background:can?'#7c3aed':'#e5e7eb',color:can?'white':'#9ca3af',border:'none',borderRadius:'6px',padding:'4px 3px',fontSize:'9px',cursor:can?'pointer':'not-allowed',fontFamily:'Patrick Hand, sans-serif'}}>
                          💥 DMG ${fmt(cost)}
                        </button>
                        <button onClick={()=>upgradeBalls(g.typeId,'spd')} disabled={!can} style={{flex:1,background:can?'#ec4899':'#e5e7eb',color:can?'white':'#9ca3af',border:'none',borderRadius:'6px',padding:'4px 3px',fontSize:'9px',cursor:can?'pointer':'not-allowed',fontFamily:'Patrick Hand, sans-serif'}}>
                          ⚡ SPD ${fmt(cost)}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
            <AdSlot style={{minHeight:'160px'}}/>
          </div>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'14px',marginBottom:'20px'}}>
          <div style={{background:'white',borderRadius:'14px',border:'2px solid #a78bfa',padding:'14px'}}>
            <h2 style={{fontFamily:'Caveat, cursive',fontSize:'18px',color:'#5b21b6',marginBottom:'6px'}}>About Idle Breakout</h2>
            <p style={{color:'#555',fontSize:'14px',lineHeight:1.6,margin:0}}>Click bricks to earn money, buy balls that bounce automatically, upgrade them for more damage and speed. Clear all bricks to advance levels. How far can you go?</p>
          </div>
          <div style={{background:'white',borderRadius:'14px',border:'2px solid #c4b5fd',padding:'14px'}}>
            <h2 style={{fontFamily:'Caveat, cursive',fontSize:'18px',color:'#5b21b6',marginBottom:'6px'}}>How to Play</h2>
            <p style={{color:'#555',fontSize:'14px',lineHeight:1.8,margin:0}}>
              🖱️ Click bricks to deal damage<br/>
              💰 Earn money when bricks break<br/>
              🎱 Buy balls — they bounce on their own<br/>
              ⬆️ Upgrade damage or speed<br/>
              🎯 Clear all bricks to level up!
            </p>
          </div>
        </div>

        <h2 style={{fontFamily:'Caveat, cursive',fontSize:'20px',fontWeight:700,color:'#5b21b6',marginBottom:'10px'}}>🕹️ More Games</h2>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(90px, 1fr))',gap:'8px'}}>
          {related.map((g,i)=>{
            const c=catColors2[g.category]||catColors2.Action
            const borderColor=['#f87171','#fb923c','#fbbf24','#34d399'][i%4]
            return (
              <Link key={g.slug} href={`/games/${g.slug}`} style={{textDecoration:'none'}}>
                <div style={{borderRadius:'10px',overflow:'hidden',border:`2px solid ${borderColor}`,background:'white',transition:'transform 0.15s'}}
                  onMouseEnter={e=>e.currentTarget.style.transform='scale(1.05)'}
                  onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}>
                  <div style={{aspectRatio:'1',background:c.bg}}>
                    <img src={g.thumbnail} alt={g.title} style={{width:'100%',height:'100%',objectFit:'contain'}} onError={e=>{e.target.style.display='none'}}/>
                  </div>
                  <div style={{padding:'4px 6px',borderTop:`2px solid ${borderColor}`}}>
                    <p style={{fontWeight:700,fontSize:'10px',color:'#222',margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{g.title}</p>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </main>

      <footer style={{position:'relative',zIndex:1,background:'white',borderTop:'1px solid #e5e7eb',padding:'24px',textAlign:'center',marginTop:'20px'}}>
        <p style={{fontFamily:'Caveat, cursive',fontSize:'26px',fontWeight:700,background:'linear-gradient(120deg,#7c3aed,#ec4899,#f59e0b)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',margin:'0 0 6px'}}>ikop</p>
        <p style={{color:'#9ca3af',fontSize:'13px',margin:0}}>© 2026 Ikop — Free Online Games. No download. No login. Just play.</p>
      </footer>
    </div>
  )
}