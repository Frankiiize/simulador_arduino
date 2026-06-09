import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Controls from './pages/Controls.jsx';
import Resources from './pages/Resources.jsx';
import Location from './pages/Location.jsx';
import Stats from './pages/Stats.jsx';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />}>
          <Route index element={<Dashboard />} />
          <Route path="controles" element={<Controls />} />
          <Route path="recursos" element={<Resources />} />
          <Route path="ubicacion" element={<Location />} />
          <Route path="estadisticas" element={<Stats />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
