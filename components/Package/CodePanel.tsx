/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '../../Theme.tsx';
import TextArea from '../Core/TextArea.tsx';

interface CodePanelProps {
  codeText: string;
  onCodeChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onCopyCode: () => void;
  onApplyCode: () => void;
  onFocus: () => void;
  onBlur: () => void;
  btnProps?: any; // Made optional
}

const CodePanel: React.FC<CodePanelProps> = ({ codeText, onCodeChange, onCopyCode, onApplyCode, onFocus, onBlur }) => {
  const { theme } = useTheme();

  const buttonStyle: React.CSSProperties = {
    background: theme.Color.Base.Surface[1],
    border: `1px solid ${theme.Color.Base.Surface[3]}`,
    borderRadius: theme.radius['Radius.S'],
    padding: '4px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: theme.Color.Base.Content[1],
  };

  return (
    <>
      <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column' }}>
        <TextArea value={codeText} onChange={onCodeChange} onFocus={onFocus} onBlur={onBlur} style={{ flex: 1 }} />
        <div style={{
            position: 'absolute',
            top: theme.spacing['Space.S'],
            right: theme.spacing['Space.S'],
            display: 'flex',
            gap: theme.spacing['Space.XS'],
        }}>
          <motion.button
            onClick={onApplyCode}
            style={buttonStyle}
            whileHover={{ scale: 1.1, backgroundColor: theme.Color.Success.Surface[1], color: theme.Color.Success.Content[1] }}
            whileTap={{ scale: 0.9 }}
            aria-label="Apply Changes"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <i className="ph-bold ph-check-circle" style={{ fontSize: '14px' }} />
          </motion.button>
          <motion.button
            onClick={onCopyCode}
            style={buttonStyle}
            whileHover={{ scale: 1.1, backgroundColor: theme.Color.Accent.Surface[1], color: theme.Color.Accent.Content[1] }}
            whileTap={{ scale: 0.9 }}
            aria-label="Copy JSON"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <i className="ph-bold ph-copy" style={{ fontSize: '14px' }} />
          </motion.button>
        </div>
      </div>
    </>
  );
};

export default CodePanel;