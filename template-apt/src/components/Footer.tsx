export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-slate-800 text-white border-t-4 border-blue-600">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Información de la empresa */}
          <div>
            <h3 className="text-lg font-bold text-white mb-3">PepsiCo</h3>
            <p className="text-sm text-slate-400">
              Sistema de Gestión de Activos y Producción
            </p>
          </div>

          {/* Enlaces rápidos */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-3">Enlaces Rápidos</h4>
            <ul className="space-y-2 text-sm text-slate-400">
              <li>
                <a href="#" className="hover:text-blue-400 transition-colors">
                  Dashboard
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-blue-400 transition-colors">
                  Soporte
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-blue-400 transition-colors">
                  Documentación
                </a>
              </li>
            </ul>
          </div>

          {/* Contacto */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-3">Contacto</h4>
            <ul className="space-y-2 text-sm text-slate-400">
              <li>
                <span className="hover:text-blue-400 transition-colors">
                  soporte@pepsico.com
                </span>
              </li>
              <li>
                <span className="hover:text-blue-400 transition-colors">
                  +1 (555) 123-4567
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Barra inferior */}
        <div className="border-t border-slate-700 mt-6 pt-4">
          <div className="flex flex-col md:flex-row justify-between items-center text-sm text-slate-400">
            <p>© {currentYear} PepsiCo. Todos los derechos reservados.</p>
            <div className="flex gap-4 mt-2 md:mt-0">
              <a href="#" className="hover:text-blue-400 transition-colors">
                Privacidad
              </a>
              <a href="#" className="hover:text-blue-400 transition-colors">
                Términos
              </a>
              <a href="#" className="hover:text-blue-400 transition-colors">
                Políticas
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}



