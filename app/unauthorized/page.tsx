export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md space-y-6 rounded-lg bg-white p-8 shadow-lg text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100">
          <svg
            className="h-6 w-6 text-yellow-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Acceso Denegado
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Tu cuenta no está asociada a ninguna familia en el sistema.
          </p>
        </div>

        <div className="rounded-md bg-blue-50 p-4">
          <p className="text-sm text-blue-800">
            Por favor, espera a que un administrador de tu familia te dé de
            alta en el sistema. Una vez que estés asociado a una familia,
            podrás acceder al dashboard.
          </p>
        </div>

        <div className="pt-4">
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              Cerrar sesión
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}



