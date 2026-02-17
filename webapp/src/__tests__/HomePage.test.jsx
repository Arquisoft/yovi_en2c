import React from 'react'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, test, expect, afterEach, vi } from 'vitest'
import '@testing-library/jest-dom'
import HomePage from '../HomePage.jsx'

const mockNavigate = vi.fn()

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

function renderWithRouter(ui) {
  return render(
    <MemoryRouter
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      {ui}
    </MemoryRouter>
  )
}

describe('HomePage', () => {
  afterEach(() => {
    mockNavigate.mockReset()
    localStorage.clear()
    cleanup()
  })

  test('renders stored username when localStorage already has a username entry', () => {
    localStorage.setItem('username', 'Pablo')

    renderWithRouter(<HomePage />)

    expect(screen.getByText('Pablo')).toBeInTheDocument()
  })

  test('falls back to Guest when localStorage does not contain a username entry', () => {
    renderWithRouter(<HomePage />)

    expect(screen.getByText('Guest')).toBeInTheDocument()
  })

  test('navigates to the play screen when the PLAY button is clicked', async () => {
    const user = userEvent.setup()
    renderWithRouter(<HomePage />)

    const playButtons = screen.getAllByRole('button', { name: /play/i })
    const pagePlayButton = playButtons[playButtons.length - 1]
    await user.click(pagePlayButton)

    expect(mockNavigate).toHaveBeenCalledWith('/play')
  })
})
