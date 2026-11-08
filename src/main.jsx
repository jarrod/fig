import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './gen-card.js';
import App from './App.jsx';

// Keep the theme in step with the system setting while the page is open.
const dark = matchMedia('(prefers-color-scheme: dark)');
dark.addEventListener('change', (event) => document.documentElement.classList.toggle('dark', event.matches));

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
