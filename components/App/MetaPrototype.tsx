/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useTheme } from '../../Theme.tsx';
import ThemeToggleButton from '../Core/ThemeToggleButton.tsx';
import FloatingWindow from '../Package/FloatingWindow.tsx';
import Dock from '../Section/Dock.tsx';
import GeoSlashGame from '../Section/GeoSlashGame.tsx';
import ControlPanel from '../Package/ControlPanel.tsx';
import CodePanel from '../Package/CodePanel.tsx';
import ConsolePanel from '../Package/ConsolePanel.tsx';
import { WindowId, WindowState, LogEntry, GameConfig } from '../../types/index.tsx';

/**
 * 🏎️ Meta Prototype App: Geo-Slash Edition
 */
const MetaPrototype = () => {
  const { theme } = useTheme();

  const getInitialGameConfig = (): GameConfig => ({
    gravity: -9.8,
    spawnRate: 800,
    timeScale: 1.0,
    objectSize: 2.0,
    colors: [
        theme.Color.Signal.Content[1],
        theme.Color.Focus.Content[1],
        theme.Color.Warning.Content[1],
        theme.Color.Success.Content[1],
    ],
    isPlaying: true,
    score: 0,
    lives: 3,
    gameOver: false
  });
  
  // -- Game State --
  const [gameConfig, setGameConfig] = useState<GameConfig>(getInitialGameConfig);
  const [gameId, setGameId] = useState(0);
  const [codeJsonString, setCodeJsonString] = useState(JSON.stringify(gameConfig, null, 2));


  // -- Logging --
  const [logs, setLogs] = useState<LogEntry[]>([]);
  
  const logEvent = (msg: string) => {
    const entry: LogEntry = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toLocaleTimeString(),
      message: msg,
    };
    setLogs(prev => [...prev, entry].slice(-50));
  };
  
  // Sync code editor when game config changes from other sources (e.g., controls)
  useEffect(() => {
    setCodeJsonString(JSON.stringify(gameConfig, null, 2));
  }, [gameConfig]);


  // --- Window Management ---
  const WINDOW_WIDTH = 400;
  
  const [windows, setWindows] = useState<Record<WindowId, WindowState>>({
    control: { id: 'control', title: 'System', isOpen: false, zIndex: 1, x: -WINDOW_WIDTH / 2, y: -250 },
    code: { id: 'code', title: 'Telemetry', isOpen: false, zIndex: 2, x: -WINDOW_WIDTH / 2, y: -250 },
    console: { id: 'console', title: 'Events', isOpen: false, zIndex: 3, x: -WINDOW_WIDTH / 2, y: -250 },
  });

  // -- Actions --

  const handleConfigChange = (updates: Partial<GameConfig>) => {
    setGameConfig(prev => ({ ...prev, ...updates }));
    logEvent(`System Update: ${Object.keys(updates).join(', ')}`);
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCodeJsonString(e.target.value);
  };
  
  const handleApplyCode = () => {
    try {
      const newConfig = JSON.parse(codeJsonString);
      // Basic validation could be added here
      handleConfigChange(newConfig);
      logEvent("SUCCESS: Telemetry synced with system.");
    } catch (error) {
      logEvent(`ERROR: Invalid JSON format. ${error.message}`);
      console.error("JSON Parse Error:", error);
    }
  };

  const handleScore = (points: number, pos: {x: number, y: number}) => {
    if (gameConfig.gameOver) return;
    
    setGameConfig(prev => {
        // Minimalist scoring: +1 for standard, +3 for rare
        // Max score 404
        const increment = points > 20 ? 3 : 1; 
        const nextScore = Math.min(404, prev.score + increment);
        
        return { ...prev, score: nextScore };
    });
    
    // Log less frequently to avoid spam
    if (Math.random() > 0.8) logEvent(`Target Neutralized`);
  };

  const handleMiss = () => {
    if (gameConfig.gameOver) return;

    // NOTE: Misses do NOT decrease lives. Only bombs do.
    logEvent("Target Escaped");
  };

  const handleBomb = () => {
     if (gameConfig.gameOver) return;

     setGameConfig(prev => {
         const newLives = prev.lives - 1;
         logEvent("WARNING: EXPLOSIVE DETONATED");
         if (newLives <= 0) {
             return { ...prev, lives: 0, gameOver: true, isPlaying: false };
         }
         return { ...prev, lives: newLives };
     });
  };

  const handleRestart = () => {
    setGameConfig(getInitialGameConfig());
    setLogs([]);
    setGameId(prevId => prevId + 1);
  };

  const bringToFront = (id: WindowId) => {
    setWindows(prev => {
      const maxZ = Math.max(...Object.values(prev).map((w: WindowState) => w.zIndex));
      if (prev[id].zIndex === maxZ) return prev;
      return { ...prev, [id]: { ...prev[id], zIndex: maxZ + 1 } };
    });
  };

  const toggleWindow = (id: WindowId) => {
    setWindows(prev => {
      const isOpen = !prev[id].isOpen;
      
      const updatedWindow: WindowState = { 
        ...prev[id], 
        isOpen 
      };

      if (isOpen) {
        // Bring to front
        const maxZ = Math.max(...Object.values(prev).map((w: WindowState) => w.zIndex));
        updatedWindow.zIndex = maxZ + 1;

        // Reset position to center
        updatedWindow.x = -WINDOW_WIDTH / 2;
        updatedWindow.y = -250; // Estimate for vertical centering
      }

      return { ...prev, [id]: updatedWindow };
    });
  };

  return (
    <div style={{
      width: '100vw',
      height: '100%',
      backgroundColor: theme.Color.Base.Surface[1],
      overflow: 'hidden',
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <ThemeToggleButton />

      {/* --- GAME STAGE --- */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0 }}>
         <GeoSlashGame 
            key={gameId}
            config={gameConfig} 
            onScore={handleScore}
            onMiss={handleMiss}
            onBomb={handleBomb}
            onRestart={handleRestart}
         />
      </div>

      {/* --- WINDOWS --- */}
      <AnimatePresence>
        {windows.control.isOpen && (
          <FloatingWindow
            key="control"
            {...windows.control}
            onClose={() => toggleWindow('control')}
            onFocus={() => bringToFront('control')}
          >
            <ControlPanel
                config={gameConfig}
                onConfigChange={handleConfigChange}
            />
          </FloatingWindow>
        )}

        {windows.code.isOpen && (
          <FloatingWindow
            key="code"
            {...windows.code}
            onClose={() => toggleWindow('code')}
            onFocus={() => bringToFront('code')}
          >
            <CodePanel
              codeText={codeJsonString}
              onCodeChange={handleCodeChange} 
              onCopyCode={() => navigator.clipboard.writeText(codeJsonString)}
              onApplyCode={handleApplyCode}
              onFocus={() => {}}
              onBlur={() => {}}
              btnProps={{} as any} 
            />
          </FloatingWindow>
        )}

        {windows.console.isOpen && (
          <FloatingWindow
            key="console"
            {...windows.console}
            onClose={() => toggleWindow('console')}
            onFocus={() => bringToFront('console')}
          >
            <ConsolePanel logs={logs} />
          </FloatingWindow>
        )}
      </AnimatePresence>

      <Dock windows={windows} toggleWindow={toggleWindow} />
      
    </div>
  );
};

export default MetaPrototype;