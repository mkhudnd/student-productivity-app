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
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
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
  sectionGap: 24,
  cardGap: 12,
  minTouchTarget: 44,
};

export const shadow = {
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
};

export const makePalette = (isDark) => ({
  background: isDark ? '#0B1020' : '#F6F7FB',
  surface: isDark ? '#131A2A' : '#FFFFFF',
  surfaceMuted: isDark ? '#1A2234' : '#EEF1F7',
  card: isDark ? '#131A2A' : '#FFFFFF',
  text: isDark ? '#F8FAFC' : '#111827',
  textSecondary: isDark ? '#AAB4C5' : '#667085',
  textMuted: isDark ? '#7E8A9E' : '#98A2B3',
  textInverse: '#FFFFFF',
  primary: isDark ? '#8B8CF8' : '#5856D6',
  primarySoft: isDark ? '#242653' : '#ECEBFF',
  primaryText: '#FFFFFF',
  accent: isDark ? '#4FD1C5' : '#0F9F95',
  accentSoft: isDark ? '#133A39' : '#E6F7F5',
  success: isDark ? '#4ADE80' : '#16A34A',
  error: isDark ? '#FB7185' : '#DC2626',
  warning: isDark ? '#FBBF24' : '#D97706',
  info: isDark ? '#60A5FA' : '#2563EB',
  border: isDark ? '#263044' : '#E4E7EC',
  separator: isDark ? '#202A3D' : '#EAECF0',
  input: isDark ? '#1A2234' : '#F2F4F7',
  inputText: isDark ? '#F8FAFC' : '#111827',
  placeholder: isDark ? '#7E8A9E' : '#98A2B3',
  tabBackground: isDark ? '#101727' : '#FFFFFF',
  tabBorder: isDark ? '#263044' : '#EAECF0',
  tabActive: isDark ? '#A5A6FF' : '#5856D6',
  tabInactive: isDark ? '#7E8A9E' : '#98A2B3',
  overlay: isDark ? 'rgba(4, 8, 18, 0.72)' : 'rgba(17, 24, 39, 0.36)',
});
