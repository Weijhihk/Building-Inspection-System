import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import AdminApp from './AdminApp.tsx';
import './index.css';

const path = window.location.pathname;
const isAdmin = path.endsWith('/admin') || path.endsWith('/admin/');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isAdmin ? <AdminApp /> : <App />}
  </StrictMode>
);
