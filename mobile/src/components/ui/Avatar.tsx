// ─── Avatar ──────────────────────────────────────────────────
// Circular user avatar. Falls back to initials when no image provided.
// Uses expo-image for remote URIs: built-in disk cache, blur-up
// placeholder, and smooth fade-in prevent the layout "flash" from
// uncached network images.

import { View, Text, ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { useTheme } from '../../theme';
import { radius } from '../../theme/tokens';

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface AvatarProps {
  uri?: string | null;
  name?: string;
  size?: AvatarSize;
  style?: ViewStyle;
}

const sizeMap: Record<AvatarSize, number> = {
  xs: 28,
  sm: 36,
  md: 48,
  lg: 64,
  xl: 88,
};

const fontSizeMap: Record<AvatarSize, number> = {
  xs: 11,
  sm: 13,
  md: 18,
  lg: 24,
  xl: 34,
};

function getInitials(name?: string): string {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return (parts[0]?.[0] ?? '?').toUpperCase();
  return ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase();
}

export function Avatar({ uri, name, size = 'md', style }: AvatarProps) {
  const { theme } = useTheme();
  const dim = sizeMap[size];
  const fontSize = fontSizeMap[size];

  return (
    <View
      style={[
        {
          width: dim,
          height: dim,
          borderRadius: radius.full,
          backgroundColor: theme.primaryMuted,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          borderWidth: 2,
          borderColor: theme.primary,
        },
        style,
      ]}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: dim, height: dim, borderRadius: radius.full }}
          contentFit="cover"
          // Blur-up: start blurred while the network image loads,
          // then cross-fade to the sharp version in 300 ms.
          placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
          transition={{ duration: 300, effect: 'cross-dissolve' }}
          // expo-image manages its own LRU disk + memory cache
          cachePolicy="memory-disk"
        />
      ) : (
        <Text
          style={{
            fontWeight: '700',
            fontSize,
            color: theme.primary,
          }}
        >
          {getInitials(name)}
        </Text>
      )}
    </View>
  );
}
