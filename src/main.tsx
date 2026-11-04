import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { unlockSpeechOnFirstTap } from './lib/tts';
import './styles.css';

registerSW({ immediate: true });
unlockSpeechOnFirstTap();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
