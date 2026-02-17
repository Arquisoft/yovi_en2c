import React from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, test, expect } from 'vitest'
import '@testing-library/jest-dom'
import Navbar from '../Navbar.jsx'

function renderWithRouter(ui) {
  return render(
    <MemoryRouter
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      {ui}
    </MemoryRouter>
  )
}

describe('Navbar', () => {
  test('renders logo text to anchor the top navigation bar', () => {
    renderWithRouter(<Navbar />)
    expect(screen.getByText(/logo/i)).toBeInTheDocument()
  })

  test('renders navigation buttons that target HOME, PLAY, and EXIT routes', () => {
    renderWithRouter(<Navbar />)

    const homeLink = screen.getByRole('link', { name: /home/i })
    const playLink = screen.getByRole('link', { name: /play/i })
    const exitLink = screen.getByRole('link', { name: /exit/i })

    expect(homeLink).toHaveAttribute('href', '/home')
    expect(playLink).toHaveAttribute('href', '/play')
    expect(exitLink).toHaveAttribute('href', '/')
  })
})
