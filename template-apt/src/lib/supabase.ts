import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const hasSupabaseEnv = Boolean(supabaseUrl) && Boolean(supabaseAnonKey);

const createStubPromise = () => {
  const result = { data: null, error: new Error('Supabase no está configurado (modo offline).') };
  const promise = Promise.resolve(result);

  return new Proxy(
    {},
    {
      get: (_target, prop: PropertyKey) => {
        if (prop === 'then') {
          return promise.then.bind(promise);
        }
        if (prop === 'catch') {
          return promise.catch.bind(promise);
        }
        if (prop === 'finally') {
          return promise.finally.bind(promise);
        }

        return () => createStubPromise();
      },
    },
  );
};

const createStubFrom = () =>
  new Proxy(
    {},
    {
      get: () => () => createStubPromise(),
    },
  );

const createStubClient = (): SupabaseClient =>
  new Proxy(
    {},
    {
      get: (_target, prop: PropertyKey) => {
        if (prop === 'from') {
          console.warn('Supabase no configurado: usando modo offline/localStorage.');
          return () => createStubFrom();
        }

        if (prop === 'auth') {
          console.warn('Supabase auth no disponible en modo offline.');
          return {
            signInWithPassword: async () => ({
              data: null,
              error: new Error('Supabase no está configurado (modo offline).'),
            }),
            signOut: async () => ({
              error: new Error('Supabase no está configurado (modo offline).'),
            }),
          };
        }

        return () => createStubPromise();
      },
    },
  ) as SupabaseClient;

export const supabase = hasSupabaseEnv
  ? createClient(supabaseUrl, supabaseAnonKey)
  : createStubClient();

export const isSupabaseConfigured = hasSupabaseEnv;
