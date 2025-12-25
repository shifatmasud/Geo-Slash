/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// --- Window Management ---
export type WindowId = 'control' | 'code' | 'console';

export interface WindowState {
  id: WindowId;
  title: string;
  isOpen: boolean;
  zIndex: number;
  x: number;
  y: number;
}

// --- Console Logging ---
export interface LogEntry {
  id: string;
  timestamp: string;
  message: string;
}

// --- Game Configuration ---
export interface GameConfig {
    gravity: number;
    spawnRate: number; // ms between spawns
    timeScale: number;
    objectSize: number;
    colors: string[];
    isPlaying: boolean;
    score: number;
    lives: number;
    gameOver: boolean;
}