import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import AppBoardV6 from './AppBoardV6.tsx';
import { GlobalRiverTool } from './components/GlobalRiverTool.tsx';
import './index.css';
import './invest-panel-layout.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppBoardV6 />
    <GlobalRiverTool />
  </StrictMode>,
);
