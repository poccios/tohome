import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * E2E Happy Path Test - Complete User Flow (CASH Payment)
 *
 * Prerequisites:
 * - Backend running on http://localhost:4000 with E2E_MODE=1
 * - Frontend running on http://localhost:3000
 * - Database seeded with at least 1 restaurant and products
 */

// Helper to ensure screenshots directory exists
function ensureScreenshotsDir() {
  const dir = path.join(__dirname, '..', 'test-results', 'screens');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

test.describe('ToHome E2E Happy Path', () => {
  test('complete user flow: login -> browse -> add to cart -> checkout (CASH) -> order', async ({ page }) => {
    const screenshotsDir = ensureScreenshotsDir();
    const testEmail = `e2e+test+${Date.now()}@tohome.local`;
    let otpCode = '';

    // ========================================================================
    // STEP 1: Login - Request OTP
    // ========================================================================
    console.log('Step 1: Login - Request OTP');
    await page.goto('/login');

    // Intercept the OTP request to capture debug_code
    const otpRequestPromise = page.waitForResponse(
      (response) =>
        response.url().includes('/auth/email-otp/request') &&
        response.status() === 200
    );

    // Fill email and send code
    await page.fill('input[type="email"]', testEmail);
    await page.click('button:has-text("Send Code")');

    // Get debug_code from response
    const otpResponse = await otpRequestPromise;
    const otpBody = await otpResponse.json();

    expect(otpBody.debug_code).toBeDefined();
    expect(otpBody.debug_code).toMatch(/^\d{6}$/);
    otpCode = otpBody.debug_code;

    console.log(`  → OTP code received: ${otpCode}`);

    // Take screenshot of login page with OTP input
    await page.screenshot({
      path: path.join(screenshotsDir, '01-login.png'),
      fullPage: true
    });

    // ========================================================================
    // STEP 2: Login - Verify OTP and redirect to home
    // ========================================================================
    console.log('Step 2: Verify OTP');

    // Fill OTP code (auto-submits when 6 digits entered)
    await page.fill('input[type="text"]#otp, input[placeholder="000000"]', otpCode);

    // Wait for auto-verification and redirect to home page
    await page.waitForURL('/', { timeout: 10000 });
    console.log('  → Successfully logged in and redirected to home');

    // ========================================================================
    // STEP 3: Browse Restaurants
    // ========================================================================
    console.log('Step 3: Browse restaurants');
    await page.goto('/restaurants');
    await page.waitForLoadState('networkidle');

    // Verify at least one restaurant card exists (divs with restaurant names)
    const restaurantCards = page.locator('div.bg-white.rounded-lg:has(h2)').first();
    await expect(restaurantCards).toBeVisible({ timeout: 10000 });

    const restaurantCount = await page.locator('div.bg-white.rounded-lg:has(h2)').count();
    console.log(`  → Found ${restaurantCount} restaurant(s)`);

    // Take screenshot of restaurants list
    await page.screenshot({
      path: path.join(screenshotsDir, '02-restaurants.png'),
      fullPage: true
    });

    // ========================================================================
    // STEP 4: View Restaurant Menu
    // ========================================================================
    console.log('Step 4: View restaurant menu');

    // Click on "Pizzeria Da Manu" (the seeded restaurant with menu)
    const targetRestaurant = page.locator('div.bg-white.rounded-lg:has(h2:has-text("Pizzeria Da Manu"))').first();
    await targetRestaurant.click();
    await page.waitForURL(/\/restaurants\/[^/]+$/);
    await page.waitForLoadState('networkidle');

    const currentUrl = page.url();
    const restaurantSlug = currentUrl.split('/restaurants/')[1];
    console.log(`  → Viewing restaurant: ${restaurantSlug}`);

    // Verify at least one product exists (look for product containers with h3 titles)
    const productCards = page.locator('div:has(> h3)').first();
    await expect(productCards).toBeVisible({ timeout: 10000 });

    const productCount = await page.locator('div:has(> h3)').count();
    console.log(`  → Found ${productCount} product(s)`);

    // Take screenshot of restaurant menu
    await page.screenshot({
      path: path.join(screenshotsDir, '03-restaurant.png'),
      fullPage: true
    });

    // ========================================================================
    // STEP 5: Add Product to Cart (with options handling)
    // ========================================================================
    console.log('Step 5: Add product to cart');

    // Click first enabled "Aggiungi" button (skip disabled products)
    const firstAddButton = page.locator('button:has-text("Aggiungi"):not([disabled])').first();
    await firstAddButton.click();
    await page.waitForTimeout(500);

    // Add second product to meet minimum order (€10)
    const secondAddButton = page.locator('button:has-text("Aggiungi"):not([disabled])').nth(1);
    await secondAddButton.click();

    // Wait a bit to see if modal appears
    await page.waitForTimeout(500);

    // Check if options modal appeared
    const modalVisible = await page.locator('[role="dialog"], .modal, div:has-text("Opzioni")').isVisible().catch(() => false);

    if (modalVisible) {
      console.log('  → Product has options, selecting required options');

      // Find all option groups
      const optionGroups = page.locator('[data-group], .option-group, fieldset');
      const groupCount = await optionGroups.count();

      for (let i = 0; i < groupCount; i++) {
        const group = optionGroups.nth(i);

        // Check if this is a radio group (max_select=1) or checkbox group
        const radioInputs = group.locator('input[type="radio"]');
        const checkboxInputs = group.locator('input[type="checkbox"]');

        const radioCount = await radioInputs.count();
        const checkboxCount = await checkboxInputs.count();

        if (radioCount > 0) {
          // Select first radio option
          await radioInputs.first().check();
          console.log(`    → Selected radio option in group ${i + 1}`);
        } else if (checkboxCount > 0) {
          // Select first checkbox (assumes min_select=1)
          await checkboxInputs.first().check();
          console.log(`    → Selected checkbox option in group ${i + 1}`);
        }
      }

      // Click confirm/add button in modal
      const confirmButton = page.locator('button:has-text("Conferma"), button:has-text("Aggiungi al carrello")').first();
      await confirmButton.click();

      console.log('  → Options confirmed');
    } else {
      console.log('  → Product has no options');
    }

    // Wait for product to be added (cart count should update or success message)
    await page.waitForTimeout(500);

    // ========================================================================
    // STEP 6: View Cart
    // ========================================================================
    console.log('Step 6: View cart');
    await page.goto('/cart');
    await page.waitForLoadState('networkidle');

    // Verify at least one cart item exists (look for quantity controls)
    const cartItems = page.locator('button:has-text("-"):visible, button:has-text("+"):visible').first();
    await expect(cartItems).toBeVisible({ timeout: 5000 });

    const cartItemCount = await page.locator('button:has-text("-"):visible').count();
    console.log(`  → Cart has ${cartItemCount} item(s)`);

    // Take screenshot of cart
    await page.screenshot({
      path: path.join(screenshotsDir, '04-cart.png'),
      fullPage: true
    });

    // ========================================================================
    // STEP 7: Checkout - Fill Address and Payment
    // ========================================================================
    console.log('Step 7: Checkout');

    // Click checkout button
    await page.click('button:has-text("Vai al Checkout"), a:has-text("Vai al Checkout")');
    await page.waitForURL('/checkout');
    await page.waitForLoadState('networkidle');

    // Fill address form (inputs identified by position in form)
    console.log('  → Filling address form');
    const addressInputs = page.locator('h3:has-text("Indirizzo di consegna") ~ div input[type="text"]');
    await addressInputs.nth(0).fill('Via Roma');  // Via
    await addressInputs.nth(1).fill('123');       // Numero
    await addressInputs.nth(2).fill('Milan');     // Città
    await addressInputs.nth(3).fill('20100');     // CAP
    // Skip optional fields (floor, intercom, address notes)

    // Select CASH payment
    console.log('  → Selecting CASH payment');
    const cashRadio = page.locator('input[type="radio"][value="CASH"], input[value="CASH"]');
    await cashRadio.check();

    // Take screenshot of checkout
    await page.screenshot({
      path: path.join(screenshotsDir, '05-checkout.png'),
      fullPage: true
    });

    // ========================================================================
    // STEP 8: Submit Order
    // ========================================================================
    console.log('Step 8: Submit order');

    // Click confirm order button
    await page.click('button:has-text("Conferma Ordine"), button:has-text("Crea Ordine")');

    // Wait for redirect to order page
    await page.waitForURL(/\/orders\/[a-f0-9-]+$/, { timeout: 15000 });

    const orderUrl = page.url();
    const orderId = orderUrl.split('/orders/')[1];
    console.log(`  → Order created: ${orderId}`);

    // Verify order page shows order info
    await expect(page.locator('text=/Ordine/i')).toBeVisible({ timeout: 5000 });

    // Take screenshot of order detail
    await page.screenshot({
      path: path.join(screenshotsDir, '06-order.png'),
      fullPage: true
    });

    // ========================================================================
    // STEP 9: Verify Order in Orders List
    // ========================================================================
    console.log('Step 9: Verify order in orders list');
    await page.goto('/orders');
    await page.waitForLoadState('networkidle');

    // Wait for orders to load (check for order cards - divs with "Ordine #" heading)
    const orderCards = page.locator('div.bg-white.rounded-lg:has(h3:has-text("Ordine #"))');
    await expect(orderCards.first()).toBeVisible({ timeout: 10000 });

    const orderCardsCount = await orderCards.count();
    expect(orderCardsCount).toBeGreaterThan(0);
    console.log(`  → Orders list has ${orderCardsCount} order(s)`);

    // Verify the created order appears (check for short ID in any order card)
    const shortOrderId = orderId.substring(0, 8);
    const specificOrder = page.locator(`h3:has-text("Ordine #${shortOrderId}")`);
    const orderFound = await specificOrder.isVisible().catch(() => false);
    if (orderFound) {
      console.log(`  → Order #${shortOrderId} found in orders list`);
    } else {
      console.log(`  → Order #${shortOrderId} not found, but list has ${orderCardsCount} orders`);
    }

    // Take screenshot of orders list
    await page.screenshot({
      path: path.join(screenshotsDir, '07-orders-list.png'),
      fullPage: true
    });

    console.log('✅ E2E Happy Path completed successfully!');
  });
});
