import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { OverlayApp } from './components/overlay/overlay-app';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <OverlayApp />
  </StrictMode>,
);
