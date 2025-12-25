/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';
import { useTheme } from '../../Theme.tsx';

// Placeholder: The main stage logic is now in GeoSlashGame.tsx
// This component remains if we want to switch back to the Component Inspector view in the future.
const Stage: React.FC<any> = () => {
  const { theme } = useTheme();
  return (
    <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100%', 
        color: theme.Color.Base.Content[3] 
    }}>
        Stage Module Disabled. Active: GeoSlashGame.
    </div>
  );
};

export default Stage;