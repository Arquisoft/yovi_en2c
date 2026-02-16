import React from 'react'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { act } from 'react'
import { describe, test, expect, afterEach, vi } from 'vitest'
import '@testing-library/jest-dom'
import LoginPage from '../LoginPage.jsx'

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

describe('LoginPage', () => {
  afterEach(() => {
    mockNavigate.mockReset()
    localStorage.clear()
    cleanup()
  })

  test('does not submit when the username input is empty or whitespace only', async () => {
    const user = userEvent.setup()

    renderWithRouter(<LoginPage />)

    await act(async () => {
      await user.type(screen.getByRole('textbox'), '   ')
      await user.click(screen.getByRole('button', { name: /log in/i }))
    })

    await waitFor(() => {
      expect(localStorage.getItem('username')).toBeNull()
      expect(mockNavigate).not.toHaveBeenCalled()
    })
  })

  test('stores username in localStorage and navigates to home after login', async () => {
    const user = userEvent.setup()

    renderWithRouter(<LoginPage />)

    await act(async () => {
      await user.type(screen.getByRole('textbox'), 'Ana')
      await user.click(screen.getByRole('button', { name: /log in/i }))
    })

    await waitFor(() => {
      expect(localStorage.getItem('username')).toBe('Ana')
      expect(mockNavigate).toHaveBeenCalledWith('/home')
    })
  })

  test('renders a register link pointing to the register page', () => {
    renderWithRouter(<LoginPage />)

    const registerLink = screen.getByRole('link', { name: /register/i })
    expect(registerLink).toHaveAttribute('href', '/register')
  })
})
