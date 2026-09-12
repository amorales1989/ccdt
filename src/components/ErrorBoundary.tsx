import { Component, type ErrorInfo, type ReactNode } from "react";
import { useRouteError } from "react-router-dom";

/** Pantalla de último recurso. Sin esto, un error de render deja la pantalla en blanco
 *  (o el cartel crudo de React Router) sin forma de recuperarse. */
function ErrorFallback({ error }: { error: unknown }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg text-center">
        <h1 className="text-lg font-semibold text-slate-900">Algo salió mal</h1>
        <p className="mt-2 text-sm text-slate-600">
          Ocurrió un error inesperado. Podés recargar la página o volver al inicio.
        </p>
        {import.meta.env.DEV && (
          <pre className="mt-4 max-h-40 overflow-auto rounded bg-slate-100 p-2 text-left text-xs text-slate-700">
            {error instanceof Error ? error.stack || error.message : String(error)}
          </pre>
        )}
        <div className="mt-6 flex justify-center gap-2">
          <button
            onClick={() => window.location.reload()}
            className="rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
          >
            Recargar
          </button>
          <button
            onClick={() => { window.location.href = "/"; }}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Ir al inicio
          </button>
        </div>
      </div>
    </div>
  );
}

/** Para las rutas: React Router atrapa los errores de las páginas antes que cualquier
 *  boundary de arriba, así que sin esto se ve su cartel crudo sin botón de salida. */
export function RouteErrorElement() {
  const error = useRouteError();
  console.error("Error no controlado (ruta):", error);
  return <ErrorFallback error={error} />;
}

/** Para lo que queda fuera del router (providers, banners, el propio RouterProvider). */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Error no controlado:", error, info.componentStack);
  }

  render() {
    if (this.state.error) return <ErrorFallback error={this.state.error} />;
    return this.props.children;
  }
}
