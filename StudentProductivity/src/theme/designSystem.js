export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
};

export const radius = {
  sm: 12,
  md: 16,
  lg: 20,
  xl: 26,
  pill: 999,
};

export const typography = {
  regular: 'Poppins_400Regular',
  semibold: 'Poppins_600SemiBold',
  bold: 'Poppins_700Bold',
  sizes: {
    caption: 12,
    bodySmall: 14,
    body: 16,
    titleSmall: 18,
    title: 22,
    display: 30,
  },
  lineHeights: {
    caption: 18,
    bodySmall: 20,
    body: 24,
    titleSmall: 26,
    title: 30,
    display: 38,
  },
};

export const layout = {
  screenPadding: 20,
  sectionGap: 28,
  cardGap: 12,
  minTouchTarget: 44,
};

export const shadow = {
  card: {
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.055,
    shadowRadius: 18,
    elevation: 2,
  },
  floating: {
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 5,
  },
};

export const makePalette = (isDark) => ({
  background: isDark ? '#0C1020' : '#F7F8FC',
  surface: isDark ? '#151B2D' : '#FFFFFF',
  surfaceMuted: isDark ? '#1C2438' : '#F1F3F8',
  card: isDark ? '#151B2D' : '#FFFFFF',
  text: isDark ? '#F8FAFC' : '#141827',
  textSecondary: isDark ? '#AAB4C5' : '#667085',
  textMuted: isDark ? '#7E8A9E' : '#98A2B3',
  textInverse: '#FFFFFF',
  primary: isDark ? '#999BFF' : '#6267F1',
  primarySoft: isDark ? '#272A59' : '#EEEFFF',
  primaryText: '#FFFFFF',
  accent: isDark ? '#52D3B7' : '#1FA37A',
  accentSoft: isDark ? '#143B34' : '#E7F7F1',
  success: isDark ? '#4ADE80' : '#16A34A',
  error: isDark ? '#FB7185' : '#DC2626',
  warning: isDark ? '#FBBF24' : '#D97706',
  info: isDark ? '#60A5FA' : '#2563EB',
  border: isDark ? '#283249' : '#E9EBF1',
  separator: isDark ? '#222B40' : '#EEF0F4',
  input: isDark ? '#1B2336' : '#F4F5F9',
  inputText: isDark ? '#F8FAFC' : '#141827',
  placeholder: isDark ? '#7E8A9E' : '#98A2B3',
  tabBackground: isDark ? '#111729' : '#FFFFFF',
  tabBorder: isDark ? '#242D43' : '#ECEEF3',
  tabActive: isDark ? '#AEB0FF' : '#6267F1',
  tabInactive: isDark ? '#7E8A9E' : '#9AA2B1',
  overlay: isDark ? 'rgba(4, 8, 18, 0.76)' : 'rgba(17, 24, 39, 0.34)',
});
