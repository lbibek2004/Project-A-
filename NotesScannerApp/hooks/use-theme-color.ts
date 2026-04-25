/**
 * Simplified theme color hook — always returns light mode values.
 * Dark mode support removed; the app uses a fixed light palette.
 */

import { Colors } from '@/constants/theme';

type LegacyColorName = 'text' | 'background' | 'tint' | 'icon' | 'tabIconDefault' | 'tabIconSelected';

const palette: Record<LegacyColorName, string> = {
  text: Colors.textPrimary,
  background: Colors.background,
  tint: Colors.accent,
  icon: Colors.textSecondary,
  tabIconDefault: Colors.textSecondary,
  tabIconSelected: Colors.accent,
};

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: LegacyColorName
): string {
  return props.light ?? palette[colorName];
}
