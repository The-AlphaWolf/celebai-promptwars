import { Moon, Sun, Leaf, Zap, Crown } from 'lucide-react';

export const DEFAULT_THEME = 'cosmic';

export const THEMES = [
  { id: 'cosmic', name: 'Cosmic Twilight', icon: Moon, previewColor: '#8B5CF6', accentColor: '#EC4899', mood: 'Obsidian, violet and magenta' },
  { id: 'royal-gold', name: 'Champagne Royal', icon: Crown, previewColor: '#F59E0B', accentColor: '#D97706', mood: 'Velvet black and amber gold' },
  { id: 'emerald', name: 'Emerald Sanctuary', icon: Leaf, previewColor: '#10B981', accentColor: '#059669', mood: 'Forest noir and mint' },
  { id: 'cyberpunk', name: 'Cyberpunk Synthwave', icon: Zap, previewColor: '#FF007F', accentColor: '#00F0FF', mood: 'Magenta and electric cyan' },
  { id: 'aurora-light', name: 'Pearl Aurora', icon: Sun, previewColor: '#7C3AED', accentColor: '#D946EF', mood: 'Light theme: ivory and amethyst' },
];

export const themeName = (id) => THEMES.find((theme) => theme.id === id)?.name ?? id;
