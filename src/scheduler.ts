const reads: (() => void)[] = []
const writes: (() => void)[] = []
let rafId: number | null = null
let timeoutId: number | null = null

function schedule() {
  let i: number, cb: undefined | (() => void)
  rafId =
    rafId ||
    window.requestAnimationFrame(() => {
      rafId = null
      for (i = writes.length; i > 0; i--) if ((cb = writes.shift())) cb()
      timeoutId =
        timeoutId ||
        window.setTimeout(() => {
          timeoutId = null
          for (i = reads.length; i > 0; i--) if ((cb = reads.shift())) cb()
        })
    })
}

export function read(cb: () => void) {
  schedule()
  return reads.push(cb)
}

export function write(cb: () => void) {
  schedule()
  return writes.push(cb)
}
