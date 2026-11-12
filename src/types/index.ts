export type CategoryId = 'calendar' | 'special-days' | 'lists' | 'notebook' | 'documents' | 'gallery' | 'voice' | 'tasks' | 'partner-note' | 'song' | 'gifts' | 'info' | 'places' | 'steps' | 'mood' | 'letters' | 'upcoming';
export type HomeCardId = CategoryId | 'upcoming';
export interface ListItem { id: string; text: string; done: boolean }
export interface SharedRecord {
  id: string;
  category: CategoryId;
  title: string;
  body?: string;
  date?: string;
  time?: string;
  location?: string;
  done?: boolean;
  items?: ListItem[];
  url?: string;
  mood?: string;
  specialDayType?: 'birthday' | 'anniversary' | 'other';
  price?: string;
  deliveryAt?: string;
  distanceKm?: number;
  authorId: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}
export type RecordInput = Omit<SharedRecord, 'id' | 'authorId' | 'createdAt' | 'updatedAt' | 'version'>;
export type RecordPatch = Partial<RecordInput>;
export interface Profile { name: string; partnerName: string; relationshipDate: string }
export interface AppNotification { id: string; title: string; body: string; createdAt: string; read: boolean; category?: CategoryId; kind?: string }
export interface PlantWatering { userId: string; date: string; createdAt: string }
export interface AppSettings {
  homeOrder: HomeCardId[];
  hiddenCards: HomeCardId[];
  plant: 'heart' | 'violet' | 'cactus';
  wateredAt: string | null;
  plantStartedAt: string | null;
  plantWaterings: PlantWatering[];
}
export interface AppData { records: SharedRecord[]; profile: Profile; settings: AppSettings; notifications: AppNotification[] }
