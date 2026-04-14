// ─── DraggableList ───────────────────────────────────────────
// A reusable drag-and-drop reordering list built on
// react-native-reanimated + react-native-gesture-handler.
// Long-press an item to pick it up and drag to reorder.

import React, { useCallback } from 'react';
import { View, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../theme';

// ─── Types ───────────────────────────────────────────────────

interface DraggableListProps<T> {
  data: T[];
  keyExtractor: (item: T, index: number) => string;
  renderItem: (item: T, index: number) => React.ReactNode;
  onReorder: (fromIndex: number, toIndex: number) => void;
  itemHeight: number;
  containerStyle?: ViewStyle;
}

// ─── Draggable Item ──────────────────────────────────────────

function DraggableItem({
  children,
  index,
  itemHeight,
  totalItems,
  onReorder,
}: {
  children: React.ReactNode;
  index: number;
  itemHeight: number;
  totalItems: number;
  onReorder: (from: number, to: number) => void;
}) {
  const { theme } = useTheme();
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const zIndex = useSharedValue(0);
  const opacity = useSharedValue(1);

  // Haptic feedback on drag start (FIX H8)
  const triggerHaptic = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const gesture = Gesture.Pan()
    .activateAfterLongPress(300)
    .onStart(() => {
      runOnJS(triggerHaptic)();
      scale.value = withTiming(1.04, { duration: 150 });
      zIndex.value = 100;
      opacity.value = withTiming(0.9, { duration: 100 });
    })
    .onUpdate((e) => {
      translateY.value = e.translationY;
    })
    .onEnd(() => {
      // Calculate how many slots the user has dragged
      const rawOffset = Math.round(translateY.value / itemHeight);
      const clampedTarget = Math.min(
        Math.max(0, index + rawOffset),
        totalItems - 1,
      );

      if (clampedTarget !== index) {
        runOnJS(onReorder)(index, clampedTarget);
      }

      translateY.value = withTiming(0, { duration: 200 });
      scale.value = withTiming(1, { duration: 200 });
      zIndex.value = 0;
      opacity.value = withTiming(1, { duration: 200 });
    })
    .onFinalize(() => {
      translateY.value = withTiming(0, { duration: 200 });
      scale.value = withTiming(1, { duration: 200 });
      zIndex.value = 0;
      opacity.value = withTiming(1, { duration: 200 });
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { scale: scale.value },
    ],
    zIndex: zIndex.value,
    opacity: opacity.value,
    shadowColor: zIndex.value > 0 ? '#000' : 'transparent',
    shadowOffset: { width: 0, height: zIndex.value > 0 ? 8 : 0 },
    shadowOpacity: zIndex.value > 0 ? 0.15 : 0,
    shadowRadius: zIndex.value > 0 ? 16 : 0,
    elevation: zIndex.value > 0 ? 8 : 0,
  }));

  const dropIndicatorStyle = useAnimatedStyle(() => ({
    height: zIndex.value > 0 ? 2 : 0,
    backgroundColor: theme.primary,
    borderRadius: 1,
    marginVertical: zIndex.value > 0 ? 2 : 0,
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[{ height: itemHeight }, animatedStyle]}>
        {/* Drop indicator (FIX U14) */}
        <Animated.View style={dropIndicatorStyle} />
        {children}
      </Animated.View>
    </GestureDetector>
  );
}

// ─── Main Component ──────────────────────────────────────────

export function DraggableList<T>({
  data,
  keyExtractor,
  renderItem,
  onReorder,
  itemHeight,
  containerStyle,
}: DraggableListProps<T>) {
  const handleReorder = useCallback(
    (fromIndex: number, toIndex: number) => {
      onReorder(fromIndex, toIndex);
    },
    [onReorder],
  );

  return (
    <View style={containerStyle}>
      {data?.map((item, index) => (
        <DraggableItem
          key={keyExtractor(item, index)}
          index={index}
          itemHeight={itemHeight}
          totalItems={data.length}
          onReorder={handleReorder}
        >
          {renderItem(item, index)}
        </DraggableItem>
      ))}
    </View>
  );
}
