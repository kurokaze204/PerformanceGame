import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import AppBoardV6 from './AppBoardV6.tsx';
import { NetworkActionFeedback } from './components/NetworkActionFeedback.tsx';
import { ViewportLayoutGuard } from './components/ViewportLayoutGuard.tsx';
import { ColdStartJoinFallback } from './components/ColdStartJoinFallback.tsx';
import { KnowledgeGapWordingFix } from './components/KnowledgeGapWordingFix.tsx';
import { PrivacyPolicyPage } from './components/PrivacyPolicyPage.tsx';
import { FrontPageExtras } from './components/FrontPageExtras.tsx';
import { EndGameOptIn } from './components/EndGameOptIn.tsx';
import './index.css';
import './invest-panel-layout.css';

const privacyPath=window.location.pathname.replace(/\/+$/,'')==='/privacy';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {privacyPath?<PrivacyPolicyPage/>:<>
      <ViewportLayoutGuard />
      <NetworkActionFeedback />
      <KnowledgeGapWordingFix />
      <ColdStartJoinFallback />
      <FrontPageExtras />
      <EndGameOptIn />
      <AppBoardV6 />
    </>}
  </StrictMode>,
);
