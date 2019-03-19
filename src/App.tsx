import React, { RefObject, useRef, useCallback, useEffect, ReactNode, useState } from 'react'
import { css, cx } from 'emotion'
import './index.css'
import { read, write } from './scheduler'

type Measurable = { getBoundingClientRect(): ClientRect }
type Dimensions = Pick<ClientRect, 'height' | 'width'>
type Position = Pick<ClientRect, Exclude<keyof ClientRect, 'height' | 'width'>>
type Direction = keyof Position

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
      bottom: window.innerHeight,
      height: window.innerHeight,
      left: 0,
      right: window.innerWidth,
      top: 0,
      width: window.innerWidth,
    }
  },
}

const oppositeDirection: { [K in Direction]: Direction } = {
  bottom: 'top',
  left: 'right',
  right: 'left',
  top: 'bottom',
}

function calculatePosition(
  anchor: Position,
  dimensions: Dimensions,
  direction: Direction
): Position {
  const padding = 12
  // to the right
  switch (direction) {
    case 'bottom':
      return {
        bottom: anchor.bottom + padding + dimensions.height,
        left: anchor.left,
        right: anchor.left + dimensions.width,
        top: anchor.bottom + padding,
      }
    case 'left':
      return {
        bottom: anchor.top + dimensions.height,
        left: anchor.left - padding - dimensions.width,
        right: anchor.left - padding,
        top: anchor.top,
      }
    case 'right':
      return {
        bottom: anchor.top + dimensions.height,
        left: anchor.right + padding,
        right: anchor.right + padding + dimensions.width,
        top: anchor.top,
      }
    case 'top':
      return {
        bottom: anchor.top - padding,
        left: anchor.left,
        right: anchor.left + dimensions.width,
        top: anchor.top - padding - dimensions.height,
      }
  }
}

function checkBoundaryOutOfBounds(
  rect: Position,
  boundary: Position
): { [K in Direction]: boolean } {
  return {
    bottom: rect.bottom > boundary.bottom || rect.top > boundary.bottom,
    left: rect.left < boundary.left || rect.right < boundary.left,
    right: rect.left > boundary.right || rect.right > boundary.right,
    top: rect.top < boundary.top || rect.bottom < boundary.top,
  }
}

function isContained(rect: ClientRect, boundary: ClientRect) {
  const outOufBoundsSides = checkBoundaryOutOfBounds(rect, boundary)
  return !Object.keys(outOufBoundsSides).some(side => outOufBoundsSides[side as Direction])
}

interface PopoutProps {
  // anchor element on which the popout will be attached
  anchor: RefObject<Measurable>
  show: boolean
  // boundary element -- required for flip to work, otherwise flip settings are ignored
  boundary?: RefObject<Measurable>
  children?: ReactNode
  className?: string
  // the direction towards which the popout will be attach
  direction?: Direction
  // whether or not to flip the direction when there isn't enough room to attach the popout
  flip?: boolean
  // method of flip failure recovery: if original it will just use the original direction
  // otherwise it will prioritize a natural scrollable direction (down or right)
  // flip fails when there's not enough room to attach the popout in the reverse direction
  flipFailureRecovery?: 'original' | 'scrollable'
}

export function Popout(props: PopoutProps) {
  const {
    anchor,
    boundary,
    className,
    children,
    direction = 'right',
    flip = false,
    flipFailureRecovery = 'original',
    show,
  } = props
  const popoutRef = useRef<HTMLDivElement>(null)
  const positionPopout = useCallback(() => {
    read(() => {
      if (!anchor.current || !popoutRef.current) return
      let flipped = false
      const el = popoutRef.current
      const anchorRect = anchor.current.getBoundingClientRect()
      const popoutRect = el.getBoundingClientRect()
      let position = calculatePosition(anchorRect, popoutRect, direction)
      if (boundary && boundary.current) {
        const boundaryRect = boundary.current.getBoundingClientRect()
        const outOufBoundsSides = checkBoundaryOutOfBounds(position, boundaryRect)
        if (flip && outOufBoundsSides[direction]) {
          flipped = true
          const opposite = oppositeDirection[direction]
          const newPosition = calculatePosition(anchorRect, popoutRect, opposite)
          position = checkBoundaryOutOfBounds(newPosition, boundaryRect)[opposite]
            ? flipFailureRecovery === 'original'
              ? // just use original position
                position
              : // alternative: prioritize direction where you can scroll
              opposite === 'top'
              ? position
              : opposite === 'bottom'
              ? newPosition
              : opposite === 'left'
              ? position
              : newPosition
            : newPosition
        }
        // debug stuff
        const boundaryEl = boundary.current as HTMLDivElement
        write(() => {
          Object.keys(outOufBoundsSides).forEach(key => {
            const side = key as Direction
            const borderColorKey = `border${side.toUpperCase()[0] +
              side.toLowerCase().substr(1)}Color` as any
            boundaryEl.style[borderColorKey] = outOufBoundsSides[side] ? 'orange' : 'green'
          })
        })
      }
      write(() => {
        el.style.top = `${position.top}px`
        el.style.left = `${position.left}px`
      })
    })
  }, [anchor, boundary, direction, flip, flipFailureRecovery, show])

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
    <div
      className={cx(popoutStyle, className)}
      data-show={show || undefined}
      ref={popoutRef}
      style={{ border: '1px solid black' }}
    >
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
          background: 'white',
          zIndex: -1,
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
      <Popout
        anchor={popoutAnchorRef}
        // boundary={{
        //   current: Object.assign(
        //     {
        //       get style() {
        //         return popoutBoundaryRef.current!.style
        //       },
        //     },
        //     viewport
        //   ),
        // }}
        // show={showPopout}
        boundary={popoutBoundaryRef}
        direction="top"
        show={showPopout}
        flip={true}
      >
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
