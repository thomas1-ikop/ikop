'use client'
import { useEffect, useRef } from 'react'

export default function AdSlot({ style = {}, label = 'Advertisement' }) {
  const ref = useRef(null)
  const pushed = useRef(false)

  useEffect(() => {
    if (pushed.current) return
    try {
      if (typeof window !== 'undefined' && ref.current) {
        pushed.current = true;
        (window.adsbygoogle = window.adsbygoogle || []).push({})
      }
    } catch (e) { console.log('AdSense error:', e) }
  }, [])

  return (
    <div style={{ background: '#fafafa', border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden', minHeight: '250px', display: 'flex', flexDirection: 'column', ...style }}>
      <p style={{ fontSize: '9px', color: '#d1d5db', textAlign: 'center', padding: '4px 0 0', margin: 0, letterSpacing: '1px', textTransform: 'uppercase' }}>{label}</p>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <ins
          ref={ref}
          className="adsbygoogle"
          style={{ display: 'block', width: '100%', height: '100%', minHeight: '240px' }}
          data-ad-client="ca-pub-6738714121307819"
          data-ad-slot="7726595749"
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      </div>
    </div>
  )
}