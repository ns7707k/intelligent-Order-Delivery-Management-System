/**
 * Tests for the Navigation component.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material';
import Navigation from '../components/common/Navigation';

const theme = createTheme();

const renderNavigation = (initialRoute = '/kitchen') => {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={[initialRoute]}>
        <Navigation />
      </MemoryRouter>
    </ThemeProvider>
  );
};

describe('Navigation', () => {
  it('renders the ODMS brand', () => {
    renderNavigation();
    const logos = screen.getAllByText('ODMS');
    expect(logos.length).toBeGreaterThanOrEqual(1);
  });

  it('renders main navigation links', () => {
    renderNavigation();
    // These should appear in the AppBar buttons (desktop view)
    expect(screen.getByText('Kitchen')).toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Orders')).toBeInTheDocument();
    expect(screen.getByText('Drivers')).toBeInTheDocument();
    expect(screen.getByText('Routes')).toBeInTheDocument();
  });

  it('renders the menu icon button', () => {
    renderNavigation();
    // The menu icon button should exist for drawer toggle
    const menuButtons = screen.getAllByRole('button');
    expect(menuButtons.length).toBeGreaterThan(0);
  });
});
