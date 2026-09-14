import React from 'react';
import {
  AlarmClock,
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Bell,
  BookOpen,
  Bookmark,
  Calendar,
  CalendarDays,
  CalendarX,
  Check,
  CheckCheck,
  CheckCircle2,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Circle,
  CircleDot,
  Clock,
  Contrast,
  Eye,
  EyeOff,
  File,
  FileText,
  Flag,
  Flame,
  GraduationCap,
  HelpCircle,
  Info,
  KeyRound,
  Layers,
  Library,
  Link2,
  List,
  Lock,
  LockOpen,
  LogOut,
  Mail,
  MessageCircle,
  MoreHorizontal,
  MoreVertical,
  Pause,
  PauseCircle,
  Pencil,
  Play,
  PlayCircle,
  Plus,
  RefreshCcw,
  RefreshCw,
  Save,
  Search,
  Settings,
  Share2,
  ShieldCheck,
  SkipForward,
  SlidersHorizontal,
  Smartphone,
  Smile,
  Sparkles,
  Square,
  Timer,
  Trash2,
  Undo2,
  User,
  UserPlus,
  X,
  Zap,
} from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';

// AppIcon is the only place where product semantics are coupled to an icon library.
// Keep screen code on semantic names so the library can be changed without another
// app-wide rewrite. Legacy Ionicons-style keys remain supported during V2 migration.
const ICONS = {
  // Primary navigation
  'today-outline': CalendarDays,
  today: CalendarDays,
  'calendar-outline': Calendar,
  calendar: Calendar,
  'calendar-number-outline': CalendarDays,
  'timer-outline': Timer,
  timer: Timer,
  'layers-outline': Layers,
  layers: Layers,
  'stats-chart-outline': BarChart3,
  'stats-chart': BarChart3,
  'analytics-outline': BarChart3,

  // Global actions
  close: X,
  add: Plus,
  'add-outline': Plus,
  checkmark: Check,
  'checkmark-outline': Check,
  'checkmark-done-outline': CheckCheck,
  'checkmark-circle-outline': CheckCircle2,
  'checkmark-circle': CheckCircle2,
  'chevron-forward': ChevronRight,
  'chevron-back': ChevronLeft,
  'arrow-forward-outline': ArrowRight,
  'arrow-back-outline': ArrowLeft,
  'arrow-undo-outline': Undo2,
  'ellipsis-horizontal': MoreHorizontal,
  'ellipsis-horizontal-outline': MoreHorizontal,
  'ellipsis-vertical': MoreVertical,
  'ellipsis-vertical-outline': MoreVertical,
  'create-outline': Pencil,
  'save-outline': Save,
  'trash-outline': Trash2,
  'search-outline': Search,
  'share-outline': Share2,
  'options-outline': SlidersHorizontal,
  'refresh-outline': RefreshCw,
  'sync-outline': RefreshCcw,
  'link-outline': Link2,

  // Study/product semantics
  'book-outline': BookOpen,
  'bookmark-outline': Bookmark,
  'albums-outline': Library,
  'library-outline': Library,
  'school-outline': GraduationCap,
  'document-outline': File,
  'document-text-outline': FileText,
  'list-outline': List,
  'calendar-clear-outline': CalendarX,
  'time-outline': Clock,
  'flag-outline': Flag,
  'flame-outline': Flame,
  'flash-outline': Zap,
  'happy-outline': Smile,
  'play-skip-forward-outline': SkipForward,

  // Playback/focus
  play: Play,
  'play-outline': Play,
  'play-circle-outline': PlayCircle,
  pause: Pause,
  'pause-outline': Pause,
  'pause-circle-outline': PauseCircle,

  // Account/settings
  'person-outline': User,
  'person-add-outline': UserPlus,
  'mail-outline': Mail,
  'lock-closed-outline': Lock,
  'lock-open-outline': LockOpen,
  'shield-checkmark-outline': ShieldCheck,
  'key-outline': KeyRound,
  'settings-outline': Settings,
  'log-out-outline': LogOut,
  'notifications-outline': Bell,
  'alarm-outline': AlarmClock,
  'contrast-outline': Contrast,
  'phone-portrait-outline': Smartphone,
  'sparkles-outline': Sparkles,
  'chatbubble-ellipses-outline': MessageCircle,
  'eye-outline': Eye,
  'eye-off-outline': EyeOff,
  checkbox: CheckSquare,
  'square-outline': Square,
  'radio-button-on': CircleDot,
  'radio-button-off': Circle,

  // Status
  'information-circle-outline': Info,
  'alert-circle-outline': AlertCircle,
  'warning-outline': AlertTriangle,
};

export default function AppIcon({
  name,
  size = 20,
  color,
  strokeWidth = 2,
  style,
  accessibilityLabel,
  ...props
}) {
  const { theme } = useTheme();
  const Icon = ICONS[name] || HelpCircle;

  return (
    <Icon
      size={size}
      color={color || theme.colors.textSecondary}
      strokeWidth={strokeWidth}
      absoluteStrokeWidth
      style={style}
      accessibilityLabel={accessibilityLabel}
      {...props}
    />
  );
}
