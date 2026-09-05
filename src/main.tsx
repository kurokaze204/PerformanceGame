import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import AppBoardV6 from './AppBoardV6.tsx';
import { NetworkActionFeedback } from './components/NetworkActionFeedback.tsx';
import { ViewportLayoutGuard } from './components/ViewportLayoutGuard.tsx';
import { ColdStartJoinFallback } from './components/ColdStartJoinFallback.tsx';
import { KnowledgeGapWordingFix } from './components/KnowledgeGapWordingFix.tsx';
import './index.css';
import './invest-panel-layout.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ViewportLayoutGuard />
    <NetworkActionFeedback />
    <KnowledgeGapWordingFix />
    <ColdStartJoinFallback />
    <AppBoardV6 />
  </StrictMode>,
);
