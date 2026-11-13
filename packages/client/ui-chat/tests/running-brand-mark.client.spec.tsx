// @vitest-environment jsdom

import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { RunningBrandMark } from '../src/client/chat/RunningBrandMark.tsx'

afterEach(cleanup)

describe('RunningBrandMark', () => {
  it('renders the decorative TimeGleam mark without inline animation state', () => {
    const view = render(<RunningBrandMark />)
    const icon = view.container.firstElementChild!
    expect(icon.tagName).toBe('SPAN')
    expect(icon.getAttribute('aria-hidden')).toBe('true')
    const svg = icon.querySelector('svg')!
    expect(svg.getAttribute('viewBox')).toBe('0 0 32 32')
    expect(svg.querySelectorAll('path')).toHaveLength(1)
    expect(view.container.querySelector('animate')).toBeNull()
    expect(view.container.querySelector('[style]')).toBeNull()
  })
})
