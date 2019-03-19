import React, { RefObject, useRef, useCallback, useEffect, ReactNode, useState } from 'react'
import { css, cx } from 'emotion'
import './index.css'
import { read, write } from './scheduler'

type Measurable = { getBoundingClientRect(): ClientRect }
type Dimensions = Pick<ClientRect, 'height' | 'width'>
type Position = Pick<ClientRect, Exclude<keyof ClientRect, 'height' | 'width'>>

const popoutStyle = css`
  background: slategray;
  border-radius: 4px;
  color: red;
  padding: 16px;
  position: fixed;
  opacity: 0;
  transform: scale(0);
  transition: opacity 200ms ease-in, transform 200ms step-end, visibility 200ms step-end;
  transition-delay: 300ms;
  visibility: hidden;

  &[data-show],
  &:hover,
  &:focus,
  &:focus-within {
    opacity: 1;
    transform: none;
    transition: opacity 200ms ease-in, transform 200ms step-start, visibility 200ms step-start;
    visibility: visible;
  }
`

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

function calculatePosition(anchor: Position, dimensions: Dimensions): Position {
  const padding = 12
  // to the right
  return {
    bottom: anchor.top + dimensions.height,
    left: padding + anchor.right,
    right: padding + anchor.right + dimensions.width,
    top: anchor.top,
  }
}

function checkBoundaryOutOfBounds(
  rect: Position,
  boundary: Position
): { [K in keyof Position]: boolean } {
  return {
    bottom: rect.bottom > boundary.bottom || rect.top > boundary.bottom,
    left: rect.left < boundary.left || rect.right < boundary.left,
    right: rect.left > boundary.right || rect.right > boundary.right,
    top: rect.top < boundary.top || rect.bottom < boundary.top,
  }
}

function isContained(rect: ClientRect, boundary: ClientRect) {
  const outOufBoundsSides = checkBoundaryOutOfBounds(rect, boundary)
  return !Object.keys(outOufBoundsSides).some(side => outOufBoundsSides[side as keyof Position])
}

interface PopoutProps {
  anchor: RefObject<Measurable>
  boundary?: RefObject<Measurable>
  children?: ReactNode
  className?: string
  show: boolean
}

export function Popout(props: PopoutProps) {
  const { anchor, boundary, className, children, show } = props
  const popoutRef = useRef<HTMLDivElement>(null)
  const positionPopout = useCallback(() => {
    read(() => {
      if (!anchor.current || !popoutRef.current) return
      const el = popoutRef.current
      const anchorRect = anchor.current.getBoundingClientRect()
      const popoutRect = el.getBoundingClientRect()
      const position = calculatePosition(anchorRect, popoutRect)
      const outOufBoundsSides =
        boundary &&
        boundary.current &&
        checkBoundaryOutOfBounds(position, boundary.current.getBoundingClientRect())
      write(() => {
        el.style.top = `${position.top}px`
        el.style.left = `${position.left}px`
        if (boundary && boundary.current && outOufBoundsSides) {
          const boundaryEl = boundary.current as HTMLDivElement
          Object.keys(outOufBoundsSides).forEach(side => {
            const borderColorKey = `border${side.toUpperCase()[0] +
              side.toLowerCase().substr(1)}Color` as any
            if (outOufBoundsSides[side as keyof Position])
              boundaryEl.style[borderColorKey] = 'orange'
            else {
              boundaryEl.style[borderColorKey] = 'green'
            }
          })
        }
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
  return (
    <div className={cx(popoutStyle, className)} data-show={show || undefined} ref={popoutRef}>
      {children}
    </div>
  )
}

export default function App() {
  const [showPopout, setShowPopout] = useState(false)
  const popoutAnchorRef = useRef<HTMLDivElement>(null)
  const popoutBoundaryRef = useRef<HTMLDivElement>(null)
  return (
    <div
      style={{
        border: '1px solid gray',
        padding: 'calc(100vh - 24px) calc(100vw - 24px)',
        height: '200vh',
        width: '200vw',
      }}
    >
      <div
        ref={popoutBoundaryRef}
        style={{
          height: 512,
          width: 512,
          position: 'fixed',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          border: '1px solid green',
        }}
      />
      <div
        ref={popoutAnchorRef}
        onMouseEnter={() => setShowPopout(true)}
        onMouseLeave={() => setShowPopout(false)}
        style={{
          height: 24,
          width: 24,
          border: '1px solid blue',
        }}
      />
      <Popout anchor={popoutAnchorRef} boundary={popoutBoundaryRef} show={true /* showPopout */}>
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
