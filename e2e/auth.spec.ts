import { test, expect } from '@playwright/test'

test.describe('Authentication', () => {
  test('login page should load correctly', async ({ page }) => {
    await page.goto('/auth/login')

    // Login sayfasının yüklendiğini kontrol et
    await expect(page).toHaveURL(/\/auth\/login/)

    // Login form elementlerini kontrol et
    await expect(page.locator('input[name="email"], input[type="email"]')).toBeVisible()
    await expect(page.locator('input[name="password"], input[type="password"]')).toBeVisible()
  })

  test('unauthenticated access to dashboard should redirect to login', async ({ page }) => {
    // Dashboard'a erişmeye çalış
    await page.goto('/dashboard')

    // Login sayfasına yönlendirilmeli
    await expect(page).toHaveURL(/\/auth\/login/)
  })

  test('unauthenticated access to protected routes should redirect to login', async ({ page }) => {
    const protectedRoutes = [
      '/suggestions',
      '/forms/visit-reports',
      '/settings',
    ]

    for (const route of protectedRoutes) {
      await page.goto(route)
      await expect(page).toHaveURL(/\/auth\/login/)
    }
  })

  test('login page should have proper title', async ({ page }) => {
    await page.goto('/auth/login')

    // Sayfa başlığını kontrol et
    await expect(page).toHaveTitle(/IleriHub|Giriş|Login/i)
  })
})
