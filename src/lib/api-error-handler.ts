import { toast } from "sonner"

interface ApiCallOptions<T> {
  successMessage?: string
  errorMessage?: string
  onSuccess?: (data: T) => void
  onError?: (error: unknown) => void
  showSuccessToast?: boolean
  showErrorToast?: boolean
}

/**
 * API çağrılarını standart error handling ile sarar
 * @param apiCall - Fetch çağrısını döndüren fonksiyon
 * @param options - Başarı/hata mesajları ve callback'ler
 * @returns API response data veya null (hata durumunda)
 */
export async function handleApiCall<T>(
  apiCall: () => Promise<Response>,
  options: ApiCallOptions<T> = {}
): Promise<T | null> {
  const {
    successMessage,
    errorMessage = "Bir hata oluştu",
    onSuccess,
    onError,
    showSuccessToast = true,
    showErrorToast = true,
  } = options

  try {
    const response = await apiCall()

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const message = errorData.error || errorData.message || errorMessage

      if (showErrorToast) {
        toast.error(message)
      }

      onError?.(new Error(message))
      return null
    }

    const data = await response.json()

    if (successMessage && showSuccessToast) {
      toast.success(successMessage)
    }

    onSuccess?.(data)
    return data
  } catch (error) {
    console.error("API Error:", error)

    if (showErrorToast) {
      toast.error(errorMessage)
    }

    onError?.(error)
    return null
  }
}

/**
 * API çağrısı yapar ve response'u döndürür (JSON parse etmeden)
 * @param apiCall - Fetch çağrısını döndüren fonksiyon
 * @param errorMessage - Hata mesajı
 * @returns Response veya null
 */
export async function handleApiResponse(
  apiCall: () => Promise<Response>,
  errorMessage = "Bir hata oluştu"
): Promise<Response | null> {
  try {
    const response = await apiCall()

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      toast.error(errorData.error || errorData.message || errorMessage)
      return null
    }

    return response
  } catch (error) {
    console.error("API Error:", error)
    toast.error(errorMessage)
    return null
  }
}

/**
 * Birden fazla API çağrısını paralel yapar
 * @param calls - API çağrıları array'i
 * @returns Sonuçlar array'i (hata olanlar null)
 */
export async function handleParallelApiCalls<T>(
  calls: Array<{
    apiCall: () => Promise<Response>
    options?: ApiCallOptions<T>
  }>
): Promise<Array<T | null>> {
  return Promise.all(
    calls.map(({ apiCall, options }) => handleApiCall<T>(apiCall, options))
  )
}
