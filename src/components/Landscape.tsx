import React from 'react';
import { Image, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { theme } from '../constants/theme';
import type { AppSettings } from '../types';
import type { PlantGrowthStage } from '../utils/plantGrowth';
import { AppText, Icon } from './ui';

const plantSources = {
  heart: require('../../assets/plants/heart-growth-aligned.png'),
  violet: require('../../assets/plants/violet-growth-aligned.png'),
  cactus: require('../../assets/plants/cactus-growth-aligned.png'),
} as const;

const landscapeSources = {
  morning: require('../../assets/landscape-morning.png'),
  day: require('../../assets/landscape-day.png'),
  evening: require('../../assets/landscape-evening.png'),
  night: require('../../assets/landscape-night.png'),
} as const;
const booksSource = require('../../assets/books.png');
const shelfSource = require('../../assets/shelf.png');

interface LandscapeProps {
  plant: AppSettings['plant'];
  stage: PlantGrowthStage;
  wilt: 0 | 1 | 2 | 3;
  onPlant(): void;
  onBooks(): void;
  pigeonProgress?: number;
  pigeonMirrored?: boolean;
  onPigeon?(): void;
}

export function Landscape({ plant, stage, wilt, onPlant, onBooks, pigeonProgress, pigeonMirrored, onPigeon }: LandscapeProps) {
  const { width } = useWindowDimensions();
  const height = Math.min(190, (Math.min(width, 1040) - 48) * 235 / 760);
  const current = new Date();
  const hour = current.getHours() + current.getMinutes() / 60;
  const night = hour < 6 || hour >= 20;
  const period = hour < 6 || hour >= 21 ? 'night' : hour < 9 ? 'morning' : hour < 17 ? 'day' : 'evening';

  return <View style={[s.scene, { height }]}>
    <Image source={landscapeSources[period]} resizeMode="cover" style={s.landscape} />
    <Image pointerEvents="none" source={shelfSource} resizeMode="stretch" style={s.shelfArt} />
    <Image pointerEvents="none" source={booksSource} resizeMode="contain" style={s.booksArt} />
    {pigeonProgress !== undefined && <Pressable accessibilityRole="button" accessibilityLabel="Gelen mektubu aç" onPress={onPigeon} style={[s.pigeon, { left: width * (.72 - pigeonProgress * .46), top: height * (.18 + pigeonProgress * .39) }]}><AppText style={[s.pigeonText, { transform: [{ scale: pigeonMirrored ? 0.55 + pigeonProgress * 0.45 : 0.55 + pigeonProgress * 0.45 }, { scaleX: pigeonMirrored ? -1 : 1 }] } ]}>🕊️</AppText></Pressable>}
    <View pointerEvents="none" style={[s.plantArt, { height: height * .84, opacity: 1 - wilt * .12, transform: [{ rotate: `${wilt * 0.7}deg` }, { scaleY: 1 - wilt * .025 }] }]}> 
      <Image source={plantSources[plant]} resizeMode="stretch" style={[s.plantStrip, { left: `${-stage * 100}%` }]} />
    </View>
    <Pressable accessibilityRole="button" accessibilityLabel="Ortak bitkinizle ilgilenin" onPress={onPlant} style={[s.plantHit, { height: height * .84 }]} />
    <Pressable accessibilityRole="button" accessibilityLabel="Ortak kitap listenizi açın" onPress={onBooks} style={[s.booksHit, { top: height * .52, height: height * .4 }]} />
    <View pointerEvents="none" style={s.caption}><Icon name={night ? 'Heart' : 'Sprout'} size={13} color={theme.white} /><AppText style={s.captionText}>Birlikte büyüttüğünüz bir dünya.</AppText></View>
  </View>;
}

const s = StyleSheet.create({
  scene: { height: 174, borderRadius: 22, overflow: 'hidden', position: 'relative', backgroundColor: '#C8D9DD' },
  landscape: { position: 'absolute', inset: 0, width: '100%', height: '100%' },
  plantArt: { position: 'absolute', left: '1.5%', bottom: '11.5%', width: '19%', overflow: 'hidden' },
  plantStrip: { position: 'absolute', top: 0, width: '400%', height: '100%' },
  booksArt: { position: 'absolute', left: '15%', top: '51%', width: '15%', height: '40%' },
  shelfArt: { position: 'absolute', left: '2.6%', top: '85.5%', width: '31%', height: '10%' },
  plantHit: { position: 'absolute', left: 0, top: 8, width: '22%' },
  booksHit: { position: 'absolute', left: '13%', width: '19%' },
  caption: { position: 'absolute', bottom: 13, right: 16, flexDirection: 'row', alignItems: 'center', gap: 6 },
  captionText: { fontSize: 10, color: theme.white, fontFamily: theme.medium },
  pigeon: { position: 'absolute', top: 4, left: 0, zIndex: 5 }, pigeonText: { fontSize: 32, color: '#FFFFFF' },
});
