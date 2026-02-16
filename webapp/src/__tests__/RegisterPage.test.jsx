import React from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, test, expect, vi } from 'vitest'
import '@testing-library/jest-dom'
import RegisterPage from '../RegisterPage.jsx'

vi.mock('../RegisterForm.tsx', () => ({
  default: () => <div>RegisterFormStub</div>,
}))

function renderWithRouter(ui) {
  return render(
    <MemoryRouter
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      {ui}
    </MemoryRouter>
  )
}

describe('RegisterPage', () => {
  test('shows the register heading to orient new users on the page', () => {
    renderWithRouter(<RegisterPage />)
    expect(screen.getByRole('heading', { name: /register/i })).toBeInTheDocument()
  })

  test('renders the register form inside the registration card container', () => {
    renderWithRouter(<RegisterPage />)
    expect(screen.getByText('RegisterFormStub')).toBeInTheDocument()
  })
})
