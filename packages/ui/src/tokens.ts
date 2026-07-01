export const colors = {
  theme: {
    DARK_BLACK: {
      background: '#000000',
      textPrimary: '#ffffff',
      textSecondary: '#8e9192',
      accent: '#e9c349',
      border: 'rgba(255, 255, 255, 0.2)',
    },
    MOODY_WALNUT: {
      background: '#0a0a0a',
      textPrimary: '#F0E6D2',
      textSecondary: '#8A7D6B',
      accent: '#C5A059',
      border: 'rgba(197, 160, 89, 0.15)',
    },
    CLEAN_DOODLING: {
      background: '#fcf9ee',
      textPrimary: '#002b7f',
      textSecondary: '#4a608c',
      accent: '#ffb84d',
      border: '#002b7f',
    }
  }
};

export const typography = {
  headlines: {
    fontFamily: '"Bodoni Moda", serif',
  },
  body: {
    fontFamily: '"Hanken Grotesk", sans-serif',
  }
};

export const shape = {
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  pill: 9999,
};

export const shadows = {
  soft: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 6,
  },
  medium: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.25,
    shadowRadius: 36,
    elevation: 10,
  },
  glow: {
    shadowColor: '#C5A059', // Brushed gold glow
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
  strong: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 32 },
    shadowOpacity: 0.4,
    shadowRadius: 48,
    elevation: 20,
  }
};
