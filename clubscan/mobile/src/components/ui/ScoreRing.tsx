import { View, Text } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

interface ScoreRingProps {
  /** Composite ClubScan Score 0..100. */
  score: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
}

/** Maps a 0..100 score to the red→amber→green ramp (Phase 4 §2.1). */
export function scoreColor(score: number): string {
  if (score >= 75) return '#2ED573';
  if (score >= 50) return '#FFB020';
  if (score >= 25) return '#FF8C42';
  return '#FF4757';
}

/**
 * The signature ClubScan Score visual: an animated-capable progress ring with
 * the numeric score centered. Pure presentational component.
 */
export function ScoreRing({ score, size = 88, strokeWidth = 8, label }: ScoreRingProps) {
  const clamped = Math.max(0, Math.min(100, score));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);
  const color = scoreColor(clamped);

  return (
    <View style={{ width: size, height: size }} className="items-center justify-center">
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#2A2A38"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          fill="none"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View className="absolute items-center">
        <Text className="text-xl font-bold text-text-primary">{Math.round(clamped)}</Text>
        {label ? <Text className="text-[10px] text-text-muted">{label}</Text> : null}
      </View>
    </View>
  );
}
