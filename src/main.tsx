import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ThemeProvider } from './providers/ThemeProvider';
import { NotificationProvider } from './providers/NotificationProvider';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider defaultTheme="light" storageKey="nexvelt-theme">
        <NotificationProvider>
          <App />
        </NotificationProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);
