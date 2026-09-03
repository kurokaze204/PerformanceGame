import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import AppBoardV6 from './AppBoardV6.tsx';
import { NetworkActionFeedback } from './components/NetworkActionFeedback.tsx';
import { ViewportLayoutGuard } from './components/ViewportLayoutGuard.tsx';
import './index.css';
import './invest-panel-layout.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ViewportLayoutGuard />
    <NetworkActionFeedback />
    <AppBoardV6 />
  </StrictMode>,
);
