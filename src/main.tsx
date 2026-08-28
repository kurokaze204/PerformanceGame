import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import AppBoard from './AppBoard.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppBoard />
  </StrictMode>,
);
