import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import AppBoardV2 from './AppBoardV2.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppBoardV2 />
  </StrictMode>,
);
