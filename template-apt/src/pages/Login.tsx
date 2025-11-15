import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Truck } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const normalizeRut = (value: string) =>
    value
      .replace(/[^0-9kK]/g, '')
      .toUpperCase();

  const isValidRut = (value: string) => {
    const clean = normalizeRut(value);
    if (!/^[0-9]{7,8}[0-9K]$/.test(clean)) return false;
    const body = clean.slice(0, -1);
    const dv = clean.slice(-1);
    let multiplier = 2;
    const sum = body
      .split('')
      .reverse()
      .reduce((acc, digit) => {
        const result = acc + parseInt(digit, 10) * multiplier;
        multiplier = multiplier === 7 ? 2 : multiplier + 1;
        return result;
      }, 0);
    const expected = 11 - (sum % 11);
    const computed = expected === 11 ? '0' : expected === 10 ? 'K' : String(expected);
    return dv === computed;
  };

  const validateForm = () => {
    let isValid = true;
    const trimmedUsername = username.trim();
    const trimmedPassword = password.trim();

    if (!trimmedUsername) {
      setUsernameError('Ingresa tu usuario o RUT.');
      isValid = false;
    } else if (
      !/^[a-zA-Z0-9._-]{3,50}$/.test(trimmedUsername) &&
      !isValidRut(trimmedUsername)
    ) {
      setUsernameError('Usa un usuario válido o un RUT con dígito verificador (Ej: 12.345.678-9).');
      isValid = false;
    } else {
      setUsernameError('');
    }

    if (!trimmedPassword) {
      setPasswordError('La contraseña es obligatoria.');
      isValid = false;
    } else if (trimmedPassword.length < 6) {
      setPasswordError('Debe tener al menos 6 caracteres.');
      isValid = false;
    } else {
      setPasswordError('');
    }

    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      await login(username.trim(), password.trim());
      navigate('/');
    } catch (err) {
      setError('Usuario o contraseña incorrectos');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-5xl bg-white shadow-2xl rounded-3xl overflow-hidden flex flex-col-reverse md:flex-row">
        <div className="relative hidden md:flex md:w-1/2 bg-gradient-to-br from-blue-900 via-blue-800 to-blue-600 text-white px-10 py-12 flex-col gap-10">
          <div className="flex items-center gap-3">
            <div className="bg-white/10 rounded-full p-3">
              <Truck size={36} className="text-white" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.4em] text-blue-100">Sistema</p>
              <h2 className="text-2xl font-bold leading-tight">Gestión Taller PepsiCo</h2>
            </div>
          </div>

          <div className="space-y-5">
            <h1 className="text-4xl font-semibold leading-tight">Bienvenido al Asistente de Gestión de Taller</h1>
            <p className="text-blue-100 text-lg">
              Administra vehículos, agenda mantenimientos y gestiona tu taller con una experiencia moderna y segura.
            </p>
          </div>

          <div className="mt-auto text-sm text-blue-100/80">
            <p className="font-semibold">Soporte disponible 24/7</p>
            <p className="mt-1">¿Necesitas ayuda? Contacta a soporte@pepsico.com</p>
          </div>

          <div className="absolute inset-x-0 bottom-5 px-10 hidden md:block">
            <div className="h-px bg-white/20" />
            <p className="text-xs text-blue-100/60 text-right mt-3">© 2025 PepsiCo, Inc. Todos los derechos reservados.</p>
          </div>
        </div>

        <div className="w-full md:w-1/2 px-6 sm:px-10 py-8 sm:py-12">
          <div className="md:hidden mb-8">
            <div className="flex items-center gap-3">
              <div className="bg-blue-50 rounded-full p-2">
                <Truck size={28} className="text-blue-600" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-blue-600/70">Sistema</p>
                <h2 className="text-xl font-semibold text-slate-900">Gestión Taller PepsiCo</h2>
              </div>
            </div>
            <p className="mt-4 text-sm text-slate-500">
              Administra vehículos, agenda mantenimientos y gestiona tu taller en un solo lugar.
            </p>
          </div>

          <div className="mb-8">
            <p className="text-sm uppercase tracking-[0.3em] text-blue-600 font-semibold">Acceso seguro</p>
            <h2 className="text-3xl font-bold text-slate-900 mt-2">Inicia sesión en tu cuenta</h2>
            <p className="text-slate-500 mt-3 text-sm">
              Ingresa tus credenciales corporativas para continuar gestionando las operaciones del taller.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6" noValidate>
            <div className="space-y-2">
              <label htmlFor="username" className="block text-sm font-semibold text-slate-700">
                Usuario
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={`w-full rounded-xl border bg-white px-4 py-3 text-slate-900 shadow-sm transition focus:outline-none focus:ring-4 ${
                  usernameError
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20'
                    : 'border-slate-200 focus:border-blue-500 focus:ring-blue-500/20'
                }`}
                placeholder="Ej: 12.345.678-9"
                aria-invalid={Boolean(usernameError)}
                aria-describedby="username-help username-error"
              />
              <p id="username-help" className="text-xs text-slate-500">
                Ingresa tu nombre de usuario corporativo.
              </p>
              {usernameError && (
                <p id="username-error" className="text-xs text-red-600 font-medium">
                  {usernameError}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-semibold text-slate-700">
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`w-full rounded-xl border bg-white px-4 py-3 text-slate-900 shadow-sm transition focus:outline-none focus:ring-4 ${
                  passwordError
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20'
                    : 'border-slate-200 focus:border-blue-500 focus:ring-blue-500/20'
                }`}
                placeholder="Ingresa tu contraseña"
                aria-invalid={Boolean(passwordError)}
                aria-describedby="password-error"
              />
              {passwordError && (
                <p id="password-error" className="text-xs text-red-600 font-medium">
                  {passwordError}
                </p>
              )}
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-blue-600 py-3 text-base font-semibold text-white shadow-lg shadow-blue-600/30 transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-500/30 disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none"
            >
              {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
            </button>
          </form>

          <div className="mt-10 space-y-4 text-sm text-slate-600">
            <div>
              <Link to="/" className="font-semibold text-blue-600 hover:text-blue-700">
                ← Volver al inicio
              </Link>
            </div>

            <div>
              <p className="mb-2 font-semibold text-slate-700">Accesos de demostración:</p>
              <div className="space-y-2 text-xs text-slate-500">
                <div className="flex justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <span>Administrador</span>
                  <span className="font-mono text-slate-700">admin / admin123</span>
                </div>
                <div className="flex justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <span>Planificador</span>
                  <span className="font-mono text-slate-700">planner / planner123</span>
                </div>
                <div className="flex justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <span>Chofer</span>
                  <span className="font-mono text-slate-700">driver1 / driver123</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
