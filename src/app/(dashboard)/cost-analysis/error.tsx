"use client"

import { useEffect } from "react"

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Cost Analysis Error:", error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center h-96 gap-4">
      <h2 className="text-xl font-bold text-red-600">Bir hata oluştu</h2>
      <p className="text-sm text-gray-600 max-w-lg text-center">
        {error.message}
      </p>
      <pre className="text-xs bg-gray-100 p-4 rounded max-w-lg overflow-auto">
        {error.stack}
      </pre>
      <button
        onClick={reset}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Tekrar Dene
      </button>
    </div>
  )
}
