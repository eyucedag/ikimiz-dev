import type { AppSettings } from '../types';
import { localDay, parseLocalDay } from './date';

const STAGE_MS = 2 * 24 * 60 * 60 * 1000;

export type PlantGrowthStage = 0 | 1 | 2 | 3;

export function plantGrowthStage(settings: Pick<AppSettings, 'plantStartedAt'> & Partial<Pick<AppSettings, 'plantWaterings'>>, now = new Date()): PlantGrowthStage {
  if (settings.plantWaterings?.length) return Math.min(3, Math.floor(settings.plantWaterings.length / 4)) as PlantGrowthStage;
  if (!settings.plantStartedAt) return 0;
  const started = Date.parse(settings.plantStartedAt);
  if (!Number.isFinite(started)) return 0;
  return Math.min(3, Math.max(0, Math.floor((now.getTime() - started) / STAGE_MS))) as PlantGrowthStage;
}

export function plantWiltLevel(settings: Pick<AppSettings, 'plantWaterings' | 'wateredAt'>, now = new Date()): 0 | 1 | 2 | 3 {
  const lastDay = settings.plantWaterings.at(-1)?.date ?? (settings.wateredAt ? localDay(new Date(settings.wateredAt)) : null);
  if (!lastDay) return 0;
  const parsed = parseLocalDay(lastDay);
  const today = parseLocalDay(localDay(now));
  if (!parsed || !today) return 0;
  const missedDays = Math.floor((today.getTime() - parsed.getTime()) / 86400000);
  return Math.min(3, Math.max(0, missedDays - 1)) as 0 | 1 | 2 | 3;
}

export function plantGrowthLabel(plant: AppSettings['plant'], stage: PlantGrowthStage): string {
  if (plant === 'heart') return ['Yeni filiz', 'Dallar beliriyor', 'Dallar uzuyor', 'Yemyeşil oldu'][stage];
  return ['Yeni filiz', 'Güçleniyor', 'Tomurcuklanıyor', 'Çiçek açtı'][stage];
}
