import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  apiError,
  apiSuccess,
  apiCreated,
  apiNoContent,
  apiUnauthorized,
  apiForbidden,
  apiNotFound,
  apiBadRequest,
  API_ERRORS
} from './api-response'

// Mock logger
vi.mock('./logger', () => ({
  logger: {
    error: vi.fn()
  }
}))

describe('apiError', () => {
  it('hata mesajı ve status code döndürmeli', async () => {
    const response = apiError('Test hatası', 400)

    expect(response.status).toBe(400)

    const body = await response.json()
    expect(body.error).toBe('Test hatası')
  })

  it('varsayılan status 500 olmalı', async () => {
    const response = apiError('Sunucu hatası')

    expect(response.status).toBe(500)
  })

  it('log context varsa logger çağrılmalı', async () => {
    const { logger } = await import('./logger')

    apiError('Hata', 500, {
      endpoint: '/api/test',
      error: new Error('Test error'),
      userId: 'user-123'
    })

    expect(logger.error).toHaveBeenCalledWith(
      'API',
      '/api/test failed',
      expect.objectContaining({
        message: 'Test error',
        userId: 'user-123'
      })
    )
  })
})

describe('apiSuccess', () => {
  it('data ve 200 status döndürmeli', async () => {
    const data = { id: 1, name: 'Test' }
    const response = apiSuccess(data)

    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body).toEqual(data)
  })

  it('custom status desteklemeli', async () => {
    const response = apiSuccess({ result: 'ok' }, 201)

    expect(response.status).toBe(201)
  })

  it('array data döndürebilmeli', async () => {
    const data = [{ id: 1 }, { id: 2 }]
    const response = apiSuccess(data)

    const body = await response.json()
    expect(body).toEqual(data)
  })
})

describe('apiCreated', () => {
  it('201 status döndürmeli', async () => {
    const data = { id: 'new-id' }
    const response = apiCreated(data)

    expect(response.status).toBe(201)

    const body = await response.json()
    expect(body).toEqual(data)
  })
})

describe('apiNoContent', () => {
  it('204 status ve boş body döndürmeli', async () => {
    const response = apiNoContent()

    expect(response.status).toBe(204)
    expect(response.body).toBeNull()
  })
})

describe('hızlı error response fonksiyonları', () => {
  it('apiUnauthorized 401 döndürmeli', async () => {
    const response = apiUnauthorized()

    expect(response.status).toBe(401)

    const body = await response.json()
    expect(body.error).toBe(API_ERRORS.UNAUTHORIZED)
  })

  it('apiForbidden 403 döndürmeli', async () => {
    const response = apiForbidden()

    expect(response.status).toBe(403)

    const body = await response.json()
    expect(body.error).toBe(API_ERRORS.FORBIDDEN)
  })

  it('apiNotFound 404 döndürmeli', async () => {
    const response = apiNotFound()

    expect(response.status).toBe(404)

    const body = await response.json()
    expect(body.error).toBe(API_ERRORS.NOT_FOUND)
  })

  it('apiNotFound custom mesaj desteklemeli', async () => {
    const response = apiNotFound('Kullanıcı bulunamadı')

    const body = await response.json()
    expect(body.error).toBe('Kullanıcı bulunamadı')
  })

  it('apiBadRequest 400 döndürmeli', async () => {
    const response = apiBadRequest()

    expect(response.status).toBe(400)

    const body = await response.json()
    expect(body.error).toBe(API_ERRORS.BAD_REQUEST)
  })

  it('apiBadRequest custom mesaj desteklemeli', async () => {
    const response = apiBadRequest('E-posta geçersiz')

    const body = await response.json()
    expect(body.error).toBe('E-posta geçersiz')
  })
})

describe('API_ERRORS sabitleri', () => {
  it('tüm error sabitleri tanımlı olmalı', () => {
    expect(API_ERRORS.UNAUTHORIZED).toBe('Yetkisiz erişim')
    expect(API_ERRORS.FORBIDDEN).toBe('Bu işlem için yetkiniz yok')
    expect(API_ERRORS.NOT_FOUND).toBe('Kayıt bulunamadı')
    expect(API_ERRORS.BAD_REQUEST).toBe('Geçersiz istek')
    expect(API_ERRORS.INTERNAL_ERROR).toBe('Bir hata oluştu')
    expect(API_ERRORS.VALIDATION_ERROR).toBe('Doğrulama hatası')
  })
})
