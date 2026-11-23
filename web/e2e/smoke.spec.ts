import { expect, test } from '@playwright/test'

const PASSWORD = 'correct-horse-battery'
const uniqueEmail = () => `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`

test('register, manage todos, persist across reload, log out and back in', async ({ page }) => {
  const email = uniqueEmail()

  // Signed out: the app is behind login.
  await page.goto('/')
  await expect(page).toHaveURL(/\/login$/)

  // Register -> lands in the app.
  await page.getByRole('link', { name: 'Create an account' }).click()
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByRole('heading', { name: 'Todos' })).toBeVisible()
  await expect(page.getByText(email)).toBeVisible()
  await expect(page.getByText(/Add your first todo/)).toBeVisible()

  // Add two todos; newest first.
  await page.getByLabel('New todo').fill('Write the plan')
  await page.getByRole('button', { name: 'Add' }).click()
  await page.getByLabel('New todo').fill('Build the app')
  await page.getByRole('button', { name: 'Add' }).click()
  const rows = page.getByRole('list', { name: 'Todos' }).getByRole('listitem')
  await expect(rows).toHaveCount(2)
  await expect(rows.first()).toContainText('Build the app')
  await expect(page.getByText('2 items left')).toBeVisible()

  // Complete one. click() + an auto-retrying assertion, not check(): the checkbox is controlled and
  // the optimistic update lands a tick after the click, which check()'s instant read would miss.
  await page.getByRole('checkbox', { name: /Write the plan/ }).click()
  await expect(page.getByRole('checkbox', { name: /Write the plan/ })).toBeChecked()
  await expect(page.getByText('1 item left')).toBeVisible()

  // Edit the other, with notes.
  await page.getByRole('button', { name: /Edit “Build the app”/ }).click()
  await page.getByLabel('Title').fill('Build the whole app')
  await page.getByLabel('Notes').fill('API first, then web')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Build the whole app')).toBeVisible()
  await expect(page.getByText('API first, then web')).toBeVisible()

  // Everything survives a reload (it came from the database, not browser memory).
  await page.reload()
  await expect(rows).toHaveCount(2)
  await expect(page.getByRole('checkbox', { name: /Write the plan/ })).toBeChecked()
  await expect(page.getByText('API first, then web')).toBeVisible()

  // Filters.
  await page.getByRole('button', { name: /^Completed/ }).click()
  await expect(rows).toHaveCount(1)
  await expect(rows.first()).toContainText('Write the plan')
  await page.getByRole('button', { name: /^All/ }).click()

  // Log out: back to login, and the app is closed off again.
  await page.getByRole('button', { name: 'Log out' }).click()
  await expect(page).toHaveURL(/\/login$/)
  await page.goto('/')
  await expect(page).toHaveURL(/\/login$/)

  // Wrong password is rejected; the right one restores the data.
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('not-the-password')
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page.getByRole('alert')).toContainText('Invalid email or password.')
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(rows).toHaveCount(2)

  // Clear completed.
  await page.getByRole('button', { name: 'Clear completed' }).click()
  await expect(rows).toHaveCount(1)
  await expect(page.getByText('Write the plan')).toHaveCount(0)
})

test('one person cannot see another person’s todos', async ({ browser }) => {
  const alice = await (await browser.newContext()).newPage()
  const bob = await (await browser.newContext()).newPage()

  async function register(page: typeof alice, email: string) {
    await page.goto('/register')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill(PASSWORD)
    await page.getByRole('button', { name: 'Create account' }).click()
    await expect(page.getByRole('heading', { name: 'Todos' })).toBeVisible()
  }

  await register(alice, uniqueEmail())
  await alice.getByLabel('New todo').fill('Alice’s private todo')
  await alice.getByRole('button', { name: 'Add' }).click()
  await expect(alice.getByText('Alice’s private todo')).toBeVisible()

  await register(bob, uniqueEmail())
  await expect(bob.getByText(/Add your first todo/)).toBeVisible()
  await expect(bob.getByText('Alice’s private todo')).toHaveCount(0)
})
