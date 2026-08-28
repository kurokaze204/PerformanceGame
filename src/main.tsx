import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import AppBoardV5 from './AppBoardV5.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppBoardV5 />
  </StrictMode>,
);
