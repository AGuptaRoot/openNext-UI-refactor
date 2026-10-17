/**
 * Backward-compatible aliases for the OpenNext CMS ThemeContext API.
 * Prefer importing from `@/context/ThemeContext`:
 *
 *   import { useTheme } from '@/context/ThemeContext';
 *   const { theme } = useTheme();
 */

export {
  ThemeProvider as CmsThemeProvider,
  useTheme as useCmsTheme,
  useTheme,
  ThemeProvider,
  type ThemeMode as CmsThemeMode,
} from './ThemeContext';
