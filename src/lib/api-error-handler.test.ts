import { describe, it, expect, vi, beforeEach } from 'vitest'
import { handleApiCall, handleApiResponse, handleParallelApiCalls } from './api-error-handler'

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn()
  }
}))

describe('handleApiCall', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const createMockResponse = (ok: boolean, data: unknown, status = 200): Response => {
    return {
      ok,
      status,
      json: vi.fn().mockResolvedValue(data)
    } as unknown as Response
  }

  describe('başarılı çağrılar', () => {
    it('başarılı response data döndürmeli', async () => {
      const mockData = { id: 1, name: 'Test' }
      const apiCall = vi.fn().mockResolvedValue(createMockResponse(true, mockData))

      const result = await handleApiCall(apiCall)

      expect(result).toEqual(mockData)
    })

    it('successMessage varsa toast göstermeli', async () => {
      const { toast } = await import('sonner')
      const apiCall = vi.fn().mockResolvedValue(createMockResponse(true, {}))

      await handleApiCall(apiCall, { successMessage: 'Başarılı!' })

      expect(toast.success).toHaveBeenCalledWith('Başarılı!')
    })

    it('showSuccessToast false ise toast göstermemeli', async () => {
      const { toast } = await import('sonner')
      const apiCall = vi.fn().mockResolvedValue(createMockResponse(true, {}))

      await handleApiCall(apiCall, {
        successMessage: 'Başarılı!',
        showSuccessToast: false
      })

      expect(toast.success).not.toHaveBeenCalled()
    })

    it('onSuccess callback çağrılmalı', async () => {
      const onSuccess = vi.fn()
      const mockData = { id: 1 }
      const apiCall = vi.fn().mockResolvedValue(createMockResponse(true, mockData))

      await handleApiCall(apiCall, { onSuccess })

      expect(onSuccess).toHaveBeenCalledWith(mockData)
    })
  })

  describe('hatalı çağrılar', () => {
    it('response.ok false ise null döndürmeli', async () => {
      const apiCall = vi.fn().mockResolvedValue(
        createMockResponse(false, { error: 'Hata' }, 400)
      )

      const result = await handleApiCall(apiCall)

      expect(result).toBeNull()
    })

    it('hata mesajı toast göstermeli', async () => {
      const { toast } = await import('sonner')
      const apiCall = vi.fn().mockResolvedValue(
        createMockResponse(false, { error: 'Özel hata' }, 400)
      )

      await handleApiCall(apiCall)

      expect(toast.error).toHaveBeenCalledWith('Özel hata')
    })

    it('showErrorToast false ise toast göstermemeli', async () => {
      const { toast } = await import('sonner')
      const apiCall = vi.fn().mockResolvedValue(
        createMockResponse(false, { error: 'Hata' }, 400)
      )

      await handleApiCall(apiCall, { showErrorToast: false })

      expect(toast.error).not.toHaveBeenCalled()
    })

    it('onError callback çağrılmalı', async () => {
      const onError = vi.fn()
      const apiCall = vi.fn().mockResolvedValue(
        createMockResponse(false, { error: 'Hata' }, 400)
      )

      await handleApiCall(apiCall, { onError })

      expect(onError).toHaveBeenCalled()
    })

    it('network hatası null döndürmeli', async () => {
      const apiCall = vi.fn().mockRejectedValue(new Error('Network error'))

      const result = await handleApiCall(apiCall)

      expect(result).toBeNull()
    })

    it('varsayılan hata mesajı kullanılmalı', async () => {
      const { toast } = await import('sonner')
      const apiCall = vi.fn().mockRejectedValue(new Error('Network error'))

      await handleApiCall(apiCall, { errorMessage: 'Özel hata mesajı' })

      expect(toast.error).toHaveBeenCalledWith('Özel hata mesajı')
    })
  })
})

describe('handleApiResponse', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const createMockResponse = (ok: boolean, data: unknown = {}): Response => {
    return {
      ok,
      json: vi.fn().mockResolvedValue(data)
    } as unknown as Response
  }

  it('başarılı response döndürmeli', async () => {
    const mockResponse = createMockResponse(true)
    const apiCall = vi.fn().mockResolvedValue(mockResponse)

    const result = await handleApiResponse(apiCall)

    expect(result).toBe(mockResponse)
  })

  it('hatalı response null döndürmeli', async () => {
    const apiCall = vi.fn().mockResolvedValue(
      createMockResponse(false, { error: 'Hata' })
    )

    const result = await handleApiResponse(apiCall)

    expect(result).toBeNull()
  })

  it('hata toast göstermeli', async () => {
    const { toast } = await import('sonner')
    const apiCall = vi.fn().mockResolvedValue(
      createMockResponse(false, { error: 'API Hatası' })
    )

    await handleApiResponse(apiCall)

    expect(toast.error).toHaveBeenCalledWith('API Hatası')
  })
})

describe('handleParallelApiCalls', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const createMockResponse = (ok: boolean, data: unknown): Response => {
    return {
      ok,
      json: vi.fn().mockResolvedValue(data)
    } as unknown as Response
  }

  it('tüm çağrıları paralel yapmalı', async () => {
    const calls = [
      { apiCall: vi.fn().mockResolvedValue(createMockResponse(true, { id: 1 })) },
      { apiCall: vi.fn().mockResolvedValue(createMockResponse(true, { id: 2 })) },
      { apiCall: vi.fn().mockResolvedValue(createMockResponse(true, { id: 3 })) },
    ]

    const results = await handleParallelApiCalls(calls)

    expect(results).toHaveLength(3)
    expect(results[0]).toEqual({ id: 1 })
    expect(results[1]).toEqual({ id: 2 })
    expect(results[2]).toEqual({ id: 3 })
  })

  it('bazı çağrılar başarısız olsa da sonuç döndürmeli', async () => {
    const calls = [
      { apiCall: vi.fn().mockResolvedValue(createMockResponse(true, { id: 1 })) },
      { apiCall: vi.fn().mockResolvedValue(createMockResponse(false, { error: 'Hata' })) },
      { apiCall: vi.fn().mockResolvedValue(createMockResponse(true, { id: 3 })) },
    ]

    const results = await handleParallelApiCalls(calls)

    expect(results[0]).toEqual({ id: 1 })
    expect(results[1]).toBeNull()
    expect(results[2]).toEqual({ id: 3 })
  })
})
