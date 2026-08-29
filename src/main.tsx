import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import AppBoardV6 from './AppBoardV6.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppBoardV6 />
  </StrictMode>,
);
