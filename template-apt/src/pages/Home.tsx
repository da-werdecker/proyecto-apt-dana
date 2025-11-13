import React, { useState } from 'react';
import { Link } from 'react-router-dom';

type HomeProps = {
  onGoToLogin?: () => void; // opcional para compatibilidad con usos anteriores
};

export default function Home(_props: HomeProps) {
  const [logoSrc, setLogoSrc] = useState<string>('/pepsico-logo.png');
  const handleLogoError = () => {
    // Intenta svg local, luego un recurso existente del proyecto
    if (logoSrc === '/pepsico-logo.png') {
      setLogoSrc('/pepsico-logo.svg');
      return;
    }
    if (logoSrc === '/pepsico-logo.svg') {
      setLogoSrc('/truck.svg');
      return;
    }
  };
  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-5xl bg-white shadow-2xl rounded-3xl overflow-hidden grid grid-cols-1 md:grid-cols-2">
        <div className="flex flex-col items-center justify-center gap-6 bg-white p-12">
          <img
            src={logoSrc}
            alt="PepsiCo"
            className="max-h-28 w-auto object-contain"
            onError={handleLogoError}
          />
          <div className="text-center space-y-3">
            <h1 className="text-3xl font-bold text-slate-800">Sistema de Gestión Taller PepsiCo</h1>
            <p className="text-slate-500">
              Controla flotas, agenda mantenimientos y administra tu taller desde una sola plataforma corporativa.
            </p>
          </div>
        </div>

        <div className="bg-blue-900 text-white p-12 flex flex-col justify-between">
          <div className="space-y-5">
            <p className="text-sm uppercase tracking-[0.4em] text-blue-200">Entrada principal</p>
            <h2 className="text-3xl font-semibold leading-tight">
              Accede con tus credenciales corporativas para comenzar.
            </h2>
            <p className="text-blue-100">
              Gestiona diagnósticos, órdenes de trabajo y la portería desde un entorno seguro y centralizado.
            </p>
          </div>

          <Link
            to="/login"
            className="inline-flex w-full items-center justify-center rounded-xl bg-white py-3 text-base font-semibold text-blue-900 shadow-lg shadow-blue-500/30 transition hover:bg-blue-50"
          >
            Ir a iniciar sesión
          </Link>

          <div className="text-xs text-blue-200 text-right">© 2025 PepsiCo, Inc. Todos los derechos reservados.</div>
        </div>
      </div>
    </div>
  );
}


