import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import AppBoardV4 from './AppBoardV4.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppBoardV4 />
  </StrictMode>,
);
