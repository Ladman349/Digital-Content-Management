import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

/**
 * The CMS from an empty installation to two clients who cannot see each other, told as one story
 * in order. The API is real and its database is new for every run (see playwright.config.ts).
 *
 * Setup that is not the subject of a test goes through the API; whatever the test is about goes
 * through the browser, the way a person would do it.
 */

const API = "http://127.0.0.1:8010/api/v1";
const OWNER = { name: "Olivia Owner", email: "owner@e2e.test", password: "owner-password-1" };
const ANN = { name: "Ann of Acme", email: "ann@acme.e2e.test", password: "acme-password-1" };
const BOB = { name: "Bob of Bolt", email: "bob@bolt.e2e.test", password: "bolt-password-1" };

// 1x1 PNG
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGBgAAAABQABVKJPXQAAAABJRU5ErkJggg==", "base64");

const world: { ownerToken?: string; acmeId?: string; boltId?: string; lobbyTv?: string; boltTv?: string; playlistId?: string } = {};

test.describe.configure({ mode: "serial" });

async function signIn(page: Page, who: { email: string; password: string }) {
  await page.goto("/");
  await page.getByRole("textbox", { name: "Email" }).fill(who.email);
  await page.getByRole("textbox", { name: "Password", exact: true }).fill(who.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page.getByRole("button", { name: "Account" })).toBeVisible();
}

async function signOut(page: Page) {
  await page.getByRole("button", { name: "Account" }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
}

function as(token: string | undefined) {
  return { headers: { Authorization: `Bearer ${token}` } };
}

async function registerTv(request: APIRequestContext, name: string, androidId: string): Promise<string> {
  const res = await request.post(`${API}/devices/register`, { data: { name, resolution: "1920x1080", androidId } });
  expect(res.ok()).toBeTruthy();
  return (await res.json()).deviceId;
}

test("an empty installation is open, and creating the first administrator turns sign-in on", async ({ page }) => {
  await page.goto("/accounts");
  await expect(page.getByText("Sign-in is off")).toBeVisible();

  await page.getByRole("button", { name: "Create administrator" }).click();
  await page.getByLabel("Name").fill(OWNER.name);
  await page.getByLabel("Email").fill(OWNER.email);
  await page.getByLabel("Password", { exact: true }).fill(OWNER.password);
  await page.getByRole("button", { name: "Create user" }).click();

  // The moment the account exists the CMS is behind the sign-in screen.
  await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
});

test("a wrong password is refused without saying which part was wrong", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("textbox", { name: "Email" }).fill(OWNER.email);
  await page.getByRole("textbox", { name: "Password", exact: true }).fill("not-the-password");
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page.getByRole("alert").filter({ hasText: /do not match/i })).toBeVisible();
  await expect(page.getByRole("button", { name: "Account" })).toHaveCount(0);
});

test("the administrator signs in and sets up two clients", async ({ page, request }) => {
  await signIn(page, OWNER);
  world.ownerToken = await page.evaluate(() => localStorage.getItem("signage.session") ?? undefined);
  expect(world.ownerToken).toBeTruthy();

  // Clients through the browser.
  await page.goto("/accounts");
  await page.getByRole("tab", { name: /clients/i }).click();
  for (const name of ["Acme", "Bolt"]) {
    await page.getByRole("button", { name: "New client" }).first().click();
    await page.getByLabel("Client name").fill(name);
    await page.getByRole("button", { name: "Add client" }).click();
    await expect(page.getByText("Client added")).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }

  const clients: { id: string; name: string }[] = await (await request.get(`${API}/clients`, as(world.ownerToken))).json();
  world.acmeId = clients.find((c) => c.name === "Acme")!.id;
  world.boltId = clients.find((c) => c.name === "Bolt")!.id;

  // Their users, two screens and some content through the API: none of it is this test's subject.
  for (const [user, clientId] of [[ANN, world.acmeId], [BOB, world.boltId]] as const) {
    const res = await request.post(`${API}/users`, { ...as(world.ownerToken), data: { ...user, role: "client", clientId } });
    expect(res.status()).toBe(201);
  }
  world.lobbyTv = await registerTv(request, "Lobby TV", "e2e-lobby");
  world.boltTv = await registerTv(request, "Bolt Counter TV", "e2e-bolt");

  const media = await request.post(`${API}/media/upload`, { ...as(world.ownerToken), multipart: { file: { name: "lobby-poster.png", mimeType: "image/png", buffer: PNG } } });
  expect(media.status()).toBe(201);
  const playlist = await request.post(`${API}/playlists`, {
    ...as(world.ownerToken),
    data: { name: "Lobby loop", description: "", status: "Published", totalDuration: 10, updatedAt: 0, items: [{ id: `item-${Date.now()}`, mediaId: (await media.json()).id, duration: 10 }], assignedDeviceIds: [world.lobbyTv] },
  });
  expect(playlist.status()).toBe(201);
  world.playlistId = (await playlist.json()).id;
  await request.put(`${API}/devices/${world.boltTv}`, { ...as(world.ownerToken), data: { clientId: world.boltId } });
});

test("media can be uploaded from the Media page", async ({ page }) => {
  await signIn(page, OWNER);
  await page.goto("/media");
  await page.getByRole("button", { name: "Upload" }).first().click();
  await page.locator('input[type="file"]').first().setInputFiles({ name: "window-offer.png", mimeType: "image/png", buffer: PNG });
  const start = page.getByRole("button", { name: /^upload( 1 file)?$/i }).last();
  if (await start.isVisible().catch(() => false)) await start.click();
  await expect(page.getByText("window-offer.png").first()).toBeVisible({ timeout: 20_000 });
});

test("handing a screen over shows what travels with it, and then does it", async ({ page }) => {
  await signIn(page, OWNER);
  await page.goto(`/devices?select=${world.lobbyTv}`);

  await page.getByLabel("Belongs to").click();
  await page.getByRole("option", { name: "Acme" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: /hand over lobby tv/i })).toBeVisible();
  await expect(dialog.getByText("Goes to Acme")).toBeVisible();
  await expect(dialog.getByText("Lobby loop")).toBeVisible();
  await expect(dialog.getByText("lobby-poster.png")).toBeVisible();

  await dialog.getByRole("button", { name: "Hand over" }).click();
  await expect(page.getByText(/now with Acme/)).toBeVisible();
});

test("a client sees only their own screens and content, and no operator pages", async ({ page }) => {
  await signIn(page, ANN);

  await page.goto("/devices");
  await expect(page.getByText("Lobby TV").first()).toBeVisible();
  await expect(page.getByText("Bolt Counter TV")).toHaveCount(0);

  await page.goto("/playlists");
  await expect(page.getByText("Lobby loop").first()).toBeVisible();
  await page.goto("/media");
  await expect(page.getByText("lobby-poster.png").first()).toBeVisible();
  // Uploaded by the operator and never handed over.
  await expect(page.getByText("window-offer.png")).toHaveCount(0);

  const nav = page.getByRole("navigation").first();
  await expect(nav.getByText("Reports")).toBeVisible();
  await expect(nav.getByText("Accounts")).toHaveCount(0);
  await expect(nav.getByText("Updates")).toHaveCount(0);
  // Typing the address does not get round it.
  await page.goto("/accounts");
  await expect(page).toHaveURL(/\/$/);
});

test("another client's screen cannot be opened by its address", async ({ page }) => {
  await signIn(page, ANN);
  await page.goto(`/devices?select=${world.boltTv}`);
  await expect(page.getByText("Lobby TV").first()).toBeVisible();
  await expect(page.getByText("Bolt Counter TV")).toHaveCount(0);
});

test("the activity log tells a client who handed them their screen", async ({ page }) => {
  await signIn(page, ANN);
  await page.goto("/activity");
  const row = page.getByText("handed over").first();
  await expect(row).toBeVisible();
  await expect(page.getByText(OWNER.name).first()).toBeVisible();
  await expect(page.getByText(/to Acme, with 2 item/)).toBeVisible();
  // Accounts are not a client's to read.
  await expect(page.getByText(BOB.email)).toHaveCount(0);
});

test("reports open for a client and say why they are empty", async ({ page }) => {
  await signIn(page, ANN);
  await page.goto("/reports");
  await expect(page.getByText("No plays reported in this period")).toBeVisible();
  await expect(page.getByRole("button", { name: /export csv/i })).toBeDisabled();
});

test("signed-in devices lists sessions and can sign another one out", async ({ page, browser }) => {
  // A second browser, standing in for a phone the login was left on.
  const phone = await browser.newContext();
  const phonePage = await phone.newPage();
  await signIn(phonePage, BOB);

  await signIn(page, BOB);
  await page.getByRole("button", { name: "Account" }).click();
  await page.getByRole("menuitem", { name: "Signed-in devices" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Current")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Sign out", exact: true })).toHaveCount(1);
  await dialog.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.getByText("Signed out on that device")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Sign out", exact: true })).toHaveCount(0);

  // The other browser is back at the sign-in screen the next time it asks for anything.
  await phonePage.goto("/devices");
  await expect(phonePage.getByRole("button", { name: /sign in/i })).toBeVisible();
  await phone.close();
});

test("signing out returns to the sign-in screen and the session no longer works", async ({ page, request }) => {
  await signIn(page, OWNER);
  const token = await page.evaluate(() => localStorage.getItem("signage.session"));
  await signOut(page);
  expect((await request.get(`${API}/devices`, as(token ?? ""))).status()).toBe(401);
});
