/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';
import { useTheme } from '../../Theme.tsx';
import { GameConfig } from '../../types/index.tsx';
import RangeSlider from '../Core/RangeSlider.tsx';
import Toggle from '../Core/Toggle.tsx';
import { useMotionValue } from 'framer-motion';

interface ControlPanelProps {
  config: GameConfig;
  onConfigChange: (updates: Partial<GameConfig>) => void;
}

const ControlPanel: React.FC<ControlPanelProps> = ({ config, onConfigChange }) => {
  const { theme } = useTheme();

  // Create MotionValues for sliders (bridging logic)
  const gravityMV = useMotionValue(Math.abs(config.gravity));
  const spawnMV = useMotionValue(config.spawnRate);
  const sizeMV = useMotionValue(config.objectSize * 10);
  const timeMV = useMotionValue(config.timeScale * 100);

  return (
    <>
      <div style={{ marginBottom: theme.spacing['Space.L'] }}>
          <label style={{ ...theme.Type.Readable.Label.M, color: theme.Color.Base.Content[1] }}>GAME STATUS</label>
          <div style={{ 
              marginTop: theme.spacing['Space.S'], 
              fontSize: '32px', 
              fontFamily: theme.Type.Expressive.Display.S.fontFamily,
              color: theme.Color.Accent.Content[1]
          }}>
              SCORE: {config.score}
          </div>
      </div>

      <Toggle 
        label={config.isPlaying ? "System Active" : "System Paused"} 
        isOn={config.isPlaying} 
        onToggle={() => onConfigChange({ isPlaying: !config.isPlaying })} 
      />

      <div style={{ borderTop: `1px solid ${theme.Color.Base.Surface[3]}`, margin: `${theme.spacing['Space.L']} 0` }} />

      <label style={{ ...theme.Type.Readable.Label.S, display: 'block', marginBottom: theme.spacing['Space.M'], color: theme.Color.Base.Content[2], textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Physics Parameters
      </label>

      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing['Space.L'] }}>
          <RangeSlider
            label="Gravity Force"
            motionValue={gravityMV}
            onCommit={(v) => onConfigChange({ gravity: -v })}
            min={1}
            max={20}
          />
          
          <RangeSlider
            label="Time Scale (%)"
            motionValue={timeMV}
            onCommit={(v) => onConfigChange({ timeScale: v / 100 })}
            min={10}
            max={200}
          />
      </div>

      <div style={{ borderTop: `1px solid ${theme.Color.Base.Surface[3]}`, margin: `${theme.spacing['Space.L']} 0` }} />

      <label style={{ ...theme.Type.Readable.Label.S, display: 'block', marginBottom: theme.spacing['Space.M'], color: theme.Color.Base.Content[2], textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Spawner Configuration
      </label>

      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing['Space.L'] }}>
          <RangeSlider
            label="Spawn Rate (ms)"
            motionValue={spawnMV}
            onCommit={(v) => onConfigChange({ spawnRate: v })}
            min={200}
            max={2000}
          />
          
          <RangeSlider
            label="Geometry Size"
            motionValue={sizeMV}
            onCommit={(v) => onConfigChange({ objectSize: v / 10 })}
            min={5}
            max={30}
          />
      </div>
    </>
  );
};

export default ControlPanel;