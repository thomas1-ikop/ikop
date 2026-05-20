'use client'
import { useEffect } from 'react'

export default function AdSlot({ style = {} }) {
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        (window.adsbygoogle = window.adsbygoogle || []).push({})
      }
    } catch (e) {}
  }, [])

  return (
    <div style={{ background: 'white', border: '2px dashed #c4b5fd', borderRadius: '12px', overflow: 'hidden', minHeight: '250px', ...style }}>
      <ins
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client="ca-pub-6738714121307819"
        data-ad-slot="7726595749"
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  )
}