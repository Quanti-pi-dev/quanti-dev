import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Deck } from '@kd/shared';
import { useTheme } from '../theme';

interface DeckCardProps {
  deck: Deck;
  onPress: () => void;
}

export function DeckCard({ deck, onPress }: DeckCardProps) {
  const { theme } = useTheme();

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={{
        backgroundColor: theme.card,
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: theme.border,
        shadowColor: theme.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1, marginRight: 12 }}>
          <Text
            style={{
              fontFamily: 'Inter_600SemiBold',
              fontSize: 18,
              color: theme.text,
              marginBottom: 4,
            }}
            numberOfLines={1}
          >
            {deck.title}
          </Text>
          <Text
            style={{
              fontFamily: 'Inter_400Regular',
              fontSize: 14,
              color: theme.textSecondary,
              marginBottom: 12,
            }}
            numberOfLines={2}
          >
            {deck.description}
          </Text>
        </View>
        <View 
          style={{ 
            backgroundColor: theme.primaryLight, 
            paddingHorizontal: 8, 
            paddingVertical: 4, 
            borderRadius: 6 
          }}
        >
          <Text 
            style={{ 
              fontFamily: 'Inter_600SemiBold', 
              fontSize: 12, 
              color: theme.primaryDark 
            }}
          >
            {deck.category}
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Ionicons name="layers-outline" size={16} color={theme.textTertiary} />
        <Text
          style={{
            fontFamily: 'Inter_500Medium',
            fontSize: 14,
            color: theme.textSecondary,
            marginLeft: 6,
          }}
        >
          {deck.cardCount} Cards
        </Text>
      </View>
    </TouchableOpacity>
  );
}
