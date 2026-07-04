import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AuthScreen from './AuthScreen';
import { supabase } from '../supabaseClient';
import { vi } from 'vitest';

// Mock Supabase
vi.mock('../supabaseClient', () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      signInWithOAuth: vi.fn(),
    },
  },
}));

describe('AuthScreen Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('Form Validation: shows error on empty email submission', async () => {
    render(<AuthScreen />);
    const submitBtn = screen.getByTestId('auth-submit-btn');
    
    // Trigger submit directly to bypass native HTML5 required validation in JSDOM
    fireEvent.submit(submitBtn);
    
    expect(await screen.findByText('Email address is required.')).toBeInTheDocument();
    expect(supabase.auth.signInWithPassword).not.toHaveBeenCalled();
  });

  test('State Toggling: switches to Sign Up form', async () => {
    render(<AuthScreen />);
    
    // Initial state is Sign In
    expect(screen.getByText('Welcome Back')).toBeInTheDocument();
    
    // Switch to Sign Up
    const createAccountBtn = screen.getByText('Create Account');
    fireEvent.click(createAccountBtn);
    
    expect(await screen.findByText('Create an Account')).toBeInTheDocument();
  });

  test('Mocked API: Happy Path - Sign In', async () => {
    const user = userEvent.setup();
    supabase.auth.signInWithPassword.mockResolvedValue({ data: {}, error: null });
    
    render(<AuthScreen />);
    
    await user.type(screen.getByTestId('auth-email-input'), 'test@example.com');
    await user.type(screen.getByTestId('auth-password-input'), 'password123');
    
    fireEvent.click(screen.getByTestId('auth-submit-btn'));
    
    await waitFor(() => {
      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123'
      });
    });
    
    expect(await screen.findByText('Successfully logged in! Opening family tree...')).toBeInTheDocument();
  });

  test('Error Handling: displays API error message', async () => {
    const user = userEvent.setup();
    supabase.auth.signInWithPassword.mockResolvedValue({ 
      data: null, 
      error: { message: 'Invalid credentials' } 
    });
    
    render(<AuthScreen />);
    
    await user.type(screen.getByTestId('auth-email-input'), 'test@example.com');
    await user.type(screen.getByTestId('auth-password-input'), 'wrongpass');
    
    fireEvent.click(screen.getByTestId('auth-submit-btn'));
    
    expect(await screen.findByText('Invalid credentials')).toBeInTheDocument();
  });

  test('UI Interactions: toggles password visibility', async () => {
    const user = userEvent.setup();
    render(<AuthScreen />);
    
    const passwordInput = screen.getByTestId('auth-password-input');
    expect(passwordInput).toHaveAttribute('type', 'password');
    
    // Find the button wrapping the eye icon (assuming it's next to the input)
    // The closest button is the toggle visibility button.
    const toggleBtn = passwordInput.nextElementSibling;
    await user.click(toggleBtn);
    
    expect(passwordInput).toHaveAttribute('type', 'text');
    
    await user.click(toggleBtn);
    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('Mocked API: Happy Path - Forgot Password', async () => {
    const user = userEvent.setup();
    supabase.auth.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
    
    render(<AuthScreen redirectTo="https://test.com" />);
    
    // Switch to forgot password
    fireEvent.click(screen.getByText('Forgot password?'));
    
    await user.type(screen.getByTestId('auth-email-input'), 'reset@example.com');
    fireEvent.click(screen.getByTestId('auth-submit-btn'));
    
    await waitFor(() => {
      expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
        'reset@example.com',
        { redirectTo: 'https://test.com' }
      );
    });
    
    expect(await screen.findByText('Password reset link sent! Check your email inbox.')).toBeInTheDocument();
  });
});
