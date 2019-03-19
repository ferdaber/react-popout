import React, { RefObject, useRef, useCallback, useEffect, useMemo, ReactNode } from 'react'
import './index.css'
import { read, write } from './scheduler'

type Measurable = { getBoundingClientRect(): ClientRect }
type Dimensions = Pick<ClientRect, 'height' | 'width'>
type Position = Pick<ClientRect, Exclude<keyof ClientRect, 'height' | 'width'>>

const viewport = {
  getBoundingClientRect(): ClientRect {
    return {
      bottom: window.innerHeight + window.scrollY,
      height: window.innerHeight,
      left: window.scrollX,
      right: window.innerWidth + window.scrollX,
      top: window.scrollY,
      width: window.innerWidth,
    }
  },
}

function calculatePosition(anchor: ClientRect, dimensions: Dimensions): Position {
  const padding = 12
  // to the right
  return {
    bottom: anchor.top + dimensions.height,
    left: padding + anchor.right,
    right: padding + anchor.right + dimensions.width,
    top: anchor.top,
  }
}

interface PopoutProps {
  anchor: RefObject<Measurable>
  children?: ReactNode
}

export function Popout(props: PopoutProps) {
  const { anchor, children } = props
  const popoutRef = useRef<HTMLDivElement | null>(null)
  const positionPopout = useCallback(() => {
    read(() => {
      if (!anchor.current || !popoutRef.current) return
      const el = popoutRef.current
      const anchorRect = anchor.current.getBoundingClientRect()
      const popoutRect = el.getBoundingClientRect()
      const position = calculatePosition(anchorRect, popoutRect)
      write(() => {
        el.style.position = 'fixed'
        el.style.top = `${position.top}px`
        el.style.left = `${position.left}px`
      })
    })
  }, [])

  useEffect(() => {
    window.addEventListener('resize', positionPopout)
    window.addEventListener('scroll', positionPopout, { passive: true, capture: true })
    return () => {
      window.removeEventListener('resize', positionPopout)
      window.removeEventListener('scroll', positionPopout, { capture: true })
    }
  }, [positionPopout])
  useEffect(positionPopout)
  return <div ref={popoutRef}>{children}</div>
}

export default function App() {
  const popoutAnchorRef = useRef<HTMLDivElement | null>(null)
  return (
    <div
      style={{
        border: '1px solid gray',
        padding: 256,
        height: '200vh',
        width: '200vw',
      }}
    >
      <div
        ref={popoutAnchorRef}
        style={{
          height: 24,
          width: 24,
          border: '1px solid blue',
        }}
      />
      <Popout anchor={popoutAnchorRef}>
        <div
          style={{
            height: 48,
            width: 48,
            border: '1px solid red',
          }}
        />
      </Popout>
    </div>
  )
}
