import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import RegisterForm from '../RegisterForm'
import { afterEach, describe, expect, test, vi } from 'vitest'
import '@testing-library/jest-dom'

describe('RegisterForm', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  function renderWithRouter() {
    return render(
      <MemoryRouter>
        <RegisterForm />
      </MemoryRouter>
    )
  }

  test('shows validation error when username is empty', async () => {
    const user = userEvent.setup()
    renderWithRouter()

    await user.click(screen.getByRole('button', { name: /lets go!/i }))

    expect(
      screen.getByText(/please enter a username/i)
    ).toBeInTheDocument()
  })

  test('submits username and displays response', async () => {
    const user = userEvent.setup()

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: 'Hello Pablo! Welcome to the course!' }),
    } as Response)

    renderWithRouter()

    await user.type(
      screen.getByLabelText(/whats your name\?/i),
      'Pablo'
    )

    await user.click(screen.getByRole('button', { name: /lets go!/i }))

    await waitFor(() => {
      expect(
        screen.getByText(/hello pablo! welcome to the course!/i)
      ).toBeInTheDocument()
    })
  })
})
