// ─── Icon ────────────────────────────────────────────────────
// Thin wrapper around Ionicons with theme-aware default color.


import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface IconProps {
  name: IoniconName;
  size?: number;
  color?: string;
}

export function Icon({ name, size = 24, color }: IconProps) {
  const { theme } = useTheme();
  return <Ionicons name={name} size={size} color={color ?? theme.text} />;
}
