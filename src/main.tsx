import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Could not find the app root element');
}

const root = createRoot(rootElement);
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

if (!supabaseUrl || !supabaseAnonKey) {
  root.render(
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <section className="max-w-xl rounded-2xl border border-amber-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Supabase setup required</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          The dashboard needs your Supabase project URL and anon key before it can start.
          Add them to a <code className="rounded bg-slate-100 px-1.5 py-0.5">.env</code> file
          in the project root, then restart the development server.
        </p>
        <pre className="mt-4 overflow-x-auto rounded-lg bg-slate-900 p-4 text-sm text-slate-100">
          <code>{'VITE_SUPABASE_URL=https://your-project.supabase.co\nVITE_SUPABASE_ANON_KEY=your-anon-key'}</code>
        </pre>
        <p className="mt-4 text-xs text-slate-500">
          Use the anon (publishable) key from your Supabase project settings, not a service-role key.
        </p>
      </section>
    </main>
  );
} else {
  void Promise.all([import('./App.tsx'), import('@/lib/auth')]).then(([{ default: App }, { AuthProvider }]) => {
    root.render(
      <StrictMode>
        <AuthProvider>
          <App />
        </AuthProvider>
      </StrictMode>
    );
  });
}
