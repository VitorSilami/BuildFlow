import { expect, test } from '@playwright/test'

const SESSION_URL = '**/_allauth/browser/v1/auth/session'
const PROVIDER_TOKEN_URL = '**/_allauth/browser/v1/auth/provider/token'

const USUARIO_ATIVO = {
  id: '1',
  email: 'gerente@empresaA.example.com',
  nome: 'Gerente Empresa A',
  perfil: 'gerente',
  empresa: 'uuid-empresa-a',
  empresa_nome: 'Empresa A',
}

// Substitui o script real do Google Identity Services por um stub controlavel
// pelo teste — evita depender de credenciais/rede do Google no E2E.
async function stubGoogleIdentityScript(page: import('@playwright/test').Page) {
  await page.route('https://accounts.google.com/gsi/client', (route) =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }),
  )
  await page.addInitScript(() => {
    // @ts-expect-error stub global para o teste
    window.google = {
      accounts: {
        id: {
          initialize: ({ callback }: { callback: (r: { credential: string }) => void }) => {
            // @ts-expect-error expõe o callback pro teste disparar o login
            window.__triggerGoogleLogin = () => callback({ credential: 'fake-id-token' })
          },
          renderButton: (parent: HTMLElement) => {
            const button = document.createElement('button')
            button.textContent = 'Entrar com Google (stub)'
            button.addEventListener('click', () => {
              // @ts-expect-error ver acima
              window.__triggerGoogleLogin?.()
            })
            parent.appendChild(button)
          },
        },
      },
    }
  })
}

test('usuário não autenticado é redirecionado para /login', async ({ page }) => {
  await page.route(SESSION_URL, (route) =>
    route.fulfill({ json: { status: 401, data: {}, meta: { is_authenticated: false } } }),
  )
  await stubGoogleIdentityScript(page)

  await page.goto('/projetos')

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'BuildFlow' })).toBeVisible()
});

test('login com Google bem-sucedido redireciona para /projetos', async ({ page }) => {
  let authenticated = false
  await page.route(SESSION_URL, (route) => {
    const body = authenticated
      ? { status: 200, data: { user: USUARIO_ATIVO }, meta: { is_authenticated: true } }
      : { status: 401, data: {}, meta: { is_authenticated: false } }
    return route.fulfill({ json: body })
  })
  await page.route(PROVIDER_TOKEN_URL, (route) => {
    authenticated = true
    return route.fulfill({
      json: { status: 200, data: { user: USUARIO_ATIVO }, meta: { is_authenticated: true } },
    })
  })
  await stubGoogleIdentityScript(page)

  await page.goto('/login')
  await page.getByRole('button', { name: 'Entrar com Google (stub)' }).click()

  await expect(page).toHaveURL(/\/projetos$/)
})

test('login recusado (usuário não autorizado) mantém na tela de login com erro', async ({ page }) => {
  await page.route(SESSION_URL, (route) =>
    route.fulfill({ json: { status: 401, data: {}, meta: { is_authenticated: false } } }),
  )
  await page.route(PROVIDER_TOKEN_URL, (route) =>
    route.fulfill({ json: { status: 401, data: {}, meta: { is_authenticated: false } } }),
  )
  await stubGoogleIdentityScript(page)

  await page.goto('/login')
  await page.getByRole('button', { name: 'Entrar com Google (stub)' }).click()

  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('alert')).toContainText('Acesso não autorizado')
})
