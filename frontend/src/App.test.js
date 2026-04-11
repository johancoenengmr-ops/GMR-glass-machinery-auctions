import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';

describe('Navbar', () => {
  function renderNavbar() {
    return render(
      <AuthProvider>
        <MemoryRouter>
          <Navbar />
        </MemoryRouter>
      </AuthProvider>
    );
  }

  test('renders brand name', () => {
    renderNavbar();
    expect(screen.getByText(/Glass Machinery Auctions/i)).toBeInTheDocument();
  });

  test('shows Login and Register links when not authenticated', () => {
    renderNavbar();
    expect(screen.getByRole('link', { name: /login/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /register/i })).toBeInTheDocument();
  });

  test('Login link points to /login', () => {
    renderNavbar();
    expect(screen.getByRole('link', { name: /login/i })).toHaveAttribute('href', '/login');
  });

  test('Register link points to /register', () => {
    renderNavbar();
    expect(screen.getByRole('link', { name: /register/i })).toHaveAttribute('href', '/register');
  });

  test('Auctions link points to /', () => {
    renderNavbar();
    // The explicit nav item "Auctions" (not the brand link)
    const links = screen.getAllByRole('link', { name: /^auctions$/i });
    expect(links.length).toBeGreaterThan(0);
    expect(links[0]).toHaveAttribute('href', '/');
  });
});

describe('LoginPage', () => {
  function renderLogin() {
    return render(
      <AuthProvider>
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      </AuthProvider>
    );
  }

  test('renders the welcome heading', () => {
    renderLogin();
    expect(screen.getByText(/Welcome back/i)).toBeInTheDocument();
  });

  test('renders email input', () => {
    renderLogin();
    expect(screen.getByPlaceholderText(/you@example.com/i)).toBeInTheDocument();
  });

  test('renders password input', () => {
    renderLogin();
    expect(screen.getByPlaceholderText(/your password/i)).toBeInTheDocument();
  });

  test('renders Sign In button', () => {
    renderLogin();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  test('renders a link to the register page', () => {
    renderLogin();
    expect(screen.getByRole('link', { name: /register here/i })).toHaveAttribute('href', '/register');
  });
});

describe('RegisterPage', () => {
  function renderRegister() {
    return render(
      <AuthProvider>
        <MemoryRouter>
          <RegisterPage />
        </MemoryRouter>
      </AuthProvider>
    );
  }

  test('renders the "Create account" heading', () => {
    renderRegister();
    // "Create account" appears as both auth-title div and in the submit button text
    const items = screen.getAllByText(/Create account/i);
    expect(items.length).toBeGreaterThan(0);
  });

  test('renders Full Name input', () => {
    renderRegister();
    expect(screen.getByPlaceholderText(/John Smith/i)).toBeInTheDocument();
  });

  test('renders email input', () => {
    renderRegister();
    expect(screen.getByPlaceholderText(/john@company.com/i)).toBeInTheDocument();
  });

  test('renders Create Account button', () => {
    renderRegister();
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
  });

  test('renders a link back to the login page', () => {
    renderRegister();
    expect(screen.getByRole('link', { name: /sign in/i })).toHaveAttribute('href', '/login');
  });
});
