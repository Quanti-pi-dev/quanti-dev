// ─── BadgeShowcase ────────────────────────────────────────────
// Earned badges grid inside a Card. Renders nothing if no badges.
// Extracted from ProfileScreen for memoization.

import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing } from '../../theme/tokens';
import { Typography } from '../ui/Typography';
import { Card } from '../ui/Card';
import { BadgeItem } from '../BadgeItem';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

export interface EarnedBadge {
  id: string;
  name: string;
  icon: IoniconName;
  earned: boolean;
  accent: string;
}

interface BadgeShowcaseProps {
  badges: EarnedBadge[];
}

export const BadgeShowcase = React.memo(function BadgeShowcase({ badges }: BadgeShowcaseProps) {
  if (!badges || badges.length === 0) return null;

  return (
    <Card>
      <View style={{ gap: spacing.md }}>
        <Typography variant="h4">Badges Earned</Typography>
        <View style={{ flexDirection: 'row', gap: spacing.xl }}>
          {badges.map((b) => (
            <BadgeItem key={b.id} name={b.name} icon={b.icon} earned={b.earned} accent={b.accent} />
          ))}
        </View>
      </View>
    </Card>
  );
});
