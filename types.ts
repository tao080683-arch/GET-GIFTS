
export type Rarity = 'Common' | 'Rare' | 'Epic' | 'Legendary';
export type Language = 'en' | 'ru';

export interface NFTItem {
  id: string;
  name: string;
  rarity: Rarity;
  image: string;
  timestamp: number;
  value?: number; // Value in STARS for selling
}

export interface Case {
  id: string;
  name: string;
  price: number;
  image: string;
  rarity: Rarity;
}

export interface PromoCode {
  code: string;
  reward: number;
}

export enum Tab {
  UPGRADE = 'upgrade',
  CRAFT = 'craft',
  CASES = 'cases',
  PVP = 'pvp',
  PROFILE = 'profile'
}
