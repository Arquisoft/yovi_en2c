import React from 'react'
import { render } from '@testing-library/react'
import { describe, test, expect } from 'vitest'
import PlayPage from '../PlayPage.jsx'

describe('PlayPage', () => {
  test('renders no visible UI elements because the game screen is not implemented yet', () => {
    const { container } = render(<PlayPage />)
    expect(container.firstChild).toBeNull()
  })
})
