import React from 'react';
import { formatUsdCurrency } from './utils/currency.util';

export function App(): React.ReactElement {
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', maxWidth: '900px', margin: '0 auto' }}>
      <header style={{ borderBottom: '2px solid #e2e8f0', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0, color: '#0f172a' }}>
          Sistema de Control de Pagos y Asignaciones ({formatUsdCurrency(0).slice(0, 1)} USD)
        </h1>
        <p style={{ margin: '0.5rem 0 0', color: '#475569' }}>
          Universidad de Carabobo — Escuela de Computación · Sistemas de Información
        </p>
      </header>

      <section style={{ backgroundColor: '#f8fafc', padding: '1.25rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }}>
        <h2 style={{ marginTop: 0, fontSize: '1.15rem', color: '#1e293b' }}>
          Estado de Infraestructura — Etapa 0 Completada
        </h2>
        <ul style={{ lineHeight: 1.7, color: '#334155' }}>
          <li><strong>Arquitectura:</strong> Cliente SPA (React + Vite) + Servidor Modular (NestJS) + PostgreSQL 16</li>
          <li><strong>Roles Segregados (RN-SEG-02):</strong> Administrador · Generador de Nómina · Receptor de Nómina</li>
          <li><strong>Áreas de Proyectos (RN-CAT-01):</strong> Física · Química · Biología</li>
        </ul>
      </section>
    </main>
  );
}
