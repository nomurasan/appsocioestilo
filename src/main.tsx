import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { validateFrontendEnv } from './lib/env-validator.ts';

// Executar auditoria de variáveis públicas na inicialização do bundle
validateFrontendEnv();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

