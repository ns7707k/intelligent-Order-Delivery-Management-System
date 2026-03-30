import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: {
      main: '#0A0F1E',
      light: '#1C253A',
      dark: '#070B16',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#3B82F6',
      light: '#93C5FD',
      dark: '#2563EB',
      contrastText: '#FFFFFF',
    },
    success: {
      main: '#10B981',
      light: '#34D399',
      dark: '#059669',
    },
    warning: {
      main: '#F59E0B',
      light: '#FBBF24',
      dark: '#D97706',
    },
    error: {
      main: '#EF4444',
      light: '#F87171',
      dark: '#DC2626',
    },
    info: {
      main: '#06B6D4',
      light: '#22D3EE',
      dark: '#0891B2',
    },
    background: {
      default: '#F0F2F7',
      paper: '#FFFFFF',
    },
    text: {
      primary: '#0A0F1E',
      secondary: '#374151',
    },
    divider: '#E2E8F0',
    grey: {
      50: '#F8FAFC',
      100: '#F1F5F9',
      200: '#E2E8F0',
      300: '#CBD5E1',
      400: '#94A3B8',
      500: '#64748B',
      600: '#475569',
      700: '#334155',
      800: '#1E293B',
      900: '#0F172A',
    },
  },
  typography: {
    fontFamily: '"Manrope", "Segoe UI", "Helvetica Neue", "Arial", sans-serif',
    h1: {
      fontSize: '2.25rem',
      fontWeight: 700,
      lineHeight: 1.2,
      letterSpacing: '-0.025em',
    },
    h2: {
      fontSize: '1.875rem',
      fontWeight: 700,
      lineHeight: 1.25,
      letterSpacing: '-0.02em',
    },
    h3: {
      fontSize: '1.5rem',
      fontWeight: 600,
      lineHeight: 1.3,
    },
    h4: {
      fontSize: '1.25rem',
      fontWeight: 600,
      lineHeight: 1.35,
    },
    h5: {
      fontSize: '1.1rem',
      fontWeight: 600,
      lineHeight: 1.4,
    },
    h6: {
      fontSize: '0.95rem',
      fontWeight: 600,
      lineHeight: 1.45,
    },
    subtitle1: {
      fontSize: '1rem',
      fontWeight: 500,
      lineHeight: 1.5,
      color: '#6B7280',
    },
    subtitle2: {
      fontSize: '0.875rem',
      fontWeight: 500,
      lineHeight: 1.5,
      color: '#6B7280',
    },
    body1: {
      fontSize: '1rem',
      lineHeight: 1.6,
    },
    body2: {
      fontSize: '0.9rem',
      lineHeight: 1.55,
    },
    caption: {
      fontSize: '0.8rem',
      lineHeight: 1.5,
      color: '#6B7280',
    },
    button: {
      fontWeight: 600,
      fontSize: '0.9375rem',
    },
    overline: {
      fontSize: '0.6875rem',
      fontWeight: 700,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
    },
  },
  shape: {
    borderRadius: 10,
  },
  shadows: [
    'none',
    '0 1px 2px rgba(15,23,42,0.04)',
    '0 1px 3px rgba(15,23,42,0.06), 0 1px 2px rgba(15,23,42,0.04)',
    '0 4px 6px -1px rgba(15,23,42,0.06), 0 2px 4px -2px rgba(15,23,42,0.04)',
    '0 10px 15px -3px rgba(15,23,42,0.06), 0 4px 6px -4px rgba(15,23,42,0.04)',
    '0 20px 25px -5px rgba(15,23,42,0.08), 0 8px 10px -6px rgba(15,23,42,0.04)',
    '0 25px 30px -6px rgba(15,23,42,0.10), 0 10px 12px -6px rgba(15,23,42,0.04)',
    ...Array(18).fill('0 25px 50px -12px rgba(15,23,42,0.15)'),
  ],
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        '*': {
          '&::-webkit-scrollbar': { width: 8, height: 8 },
          '&::-webkit-scrollbar-track': { background: '#F1F5F9', borderRadius: 4 },
          '&::-webkit-scrollbar-thumb': { background: '#CBD5E1', borderRadius: 4, '&:hover': { background: '#94A3B8' } },
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableRipple: true,
      },
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 8,
          fontWeight: 600,
          padding: '8px 20px',
          boxShadow: 'none',
          transition: 'all 0.2s ease',
          '&:hover': { boxShadow: '0 4px 12px rgba(15,23,42,0.12)' },
        },
        containedPrimary: {
          background: '#3B82F6',
          color: '#FFFFFF',
          '&:hover': { background: '#2563EB' },
        },
        containedSecondary: {
          background: '#3B82F6',
          color: '#FFFFFF',
          '&:hover': { background: '#2563EB' },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 14,
          border: '1px solid #E5E7EB',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 8px 24px rgba(0,0,0,0.04)',
          transition: 'all 0.25s ease',
          '&:hover': { boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 10px 28px rgba(0,0,0,0.06)', transform: 'translateY(-1px)' },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 600,
          borderRadius: 8,
          fontSize: '0.75rem',
        },
        colorSuccess: { backgroundColor: '#ECFDF5', color: '#059669', border: '1px solid #A7F3D0' },
        colorError: { backgroundColor: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' },
        colorWarning: { backgroundColor: '#FFFBEB', color: '#D97706', border: '1px solid #FDE68A' },
        colorInfo: { backgroundColor: '#ECFEFF', color: '#0891B2', border: '1px solid #A5F3FC' },
        colorPrimary: { backgroundColor: '#F1F5F9', color: '#0F172A', border: '1px solid #CBD5E1' },
        colorSecondary: { backgroundColor: '#EFF6FF', color: '#2563EB', border: '1px solid #BFDBFE' },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { borderRadius: 14 },
        elevation1: { boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 8px 24px rgba(0,0,0,0.04)' },
        elevation2: { boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 8px 24px rgba(0,0,0,0.04)' },
        elevation3: { boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 8px 24px rgba(0,0,0,0.04)' },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: { boxShadow: 'none', borderBottom: '1px solid rgba(255,255,255,0.1)' },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { borderColor: '#F1F5F9', padding: '14px 16px' },
        head: { fontWeight: 700, color: '#475569', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', backgroundColor: '#F8FAFC' },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: 10, fontWeight: 500 },
        standardInfo: { backgroundColor: '#EFF6FF', color: '#1E40AF', border: '1px solid #BFDBFE' },
        standardSuccess: { backgroundColor: '#ECFDF5', color: '#065F46', border: '1px solid #A7F3D0' },
        standardWarning: { backgroundColor: '#FFFBEB', color: '#92400E', border: '1px solid #FDE68A' },
        standardError: { backgroundColor: '#FEF2F2', color: '#991B1B', border: '1px solid #FECACA' },
      },
    },
    MuiFab: {
      styleOverrides: {
        root: {
          boxShadow: '0 8px 24px rgba(15,23,42,0.15)',
          '&:hover': { boxShadow: '0 12px 32px rgba(15,23,42,0.2)' },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 10,
            '& fieldset': { borderColor: '#E2E8F0' },
            '&:hover fieldset': { borderColor: '#94A3B8' },
          },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: { borderRadius: 16 },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: { borderRadius: 4, height: 6 },
      },
    },
  },
  breakpoints: {
    values: {
      xs: 0,
      sm: 600,
      md: 960,
      lg: 1280,
      xl: 1920,
    },
  },
});

export default theme;
