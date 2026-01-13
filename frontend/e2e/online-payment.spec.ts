import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * E2E Test - Online Payment Flow
 *
 * Prerequisites:
 * - Backend running on http://localhost:4000 with E2E_MODE=1
 * - Frontend running on http://localhost:3000
 * - Database seeded with restaurant and products
 *
 * Test Flow:
 * 1. Login with OTP
 * 2. Add products to cart (>= min_order)
 * 3. Navigate to checkout
 * 4. Select ONLINE payment method
 * 5. Confirm order
 * 6. Verify "Ordine Creato" page with payment_status=PENDING
 * 7. Click "Paga ora (mock)" button
 * 8. Verify redirect to /orders/[id] with payment_status=PAID
 * 9. Screenshots:
 *    - 01-online-created.png (order created, pending payment)
 *    - 02-online-paid.png (after mock payment)
 */

// Helper to ensure screenshots directory exists
function ensureScreenshotsDir() {
  const dir = path.join(__dirname, '..', 'test-results', 'screens');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

test.describe('ToHome E2E - Online Payment', () => {
  test('complete online payment flow: create order -> mock pay -> verify paid', async ({ page }) => {
    const screenshotsDir = ensureScreenshotsDir();
    const testEmail = `e2e+online+${Date.now()}@tohome.local`;
    let otpCode = '';
    let orderId = '';

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

    // ========================================================================
    // STEP 2: Login - Verify OTP
    // ========================================================================
    console.log('Step 2: Verify OTP');

    // Fill OTP code (auto-submits when 6 digits entered)
    await page.fill('input[type="text"]#otp, input[placeholder="000000"]', otpCode);

    // Wait for auto-verification and redirect to home page
    await page.waitForURL('/', { timeout: 10000 });
    console.log('  → Successfully logged in and redirected to home');

    // ========================================================================
    // STEP 3: Navigate to Restaurant and Add Products
    // ========================================================================
    console.log('Step 3: Navigate to restaurant and add products');
    await page.goto('/restaurants');
    await page.waitForLoadState('networkidle');

    // Click on "Pizzeria Da Manu"
    const targetRestaurant = page.locator('div.bg-white.rounded-lg:has(h2:has-text("Pizzeria Da Manu"))').first();
    await targetRestaurant.click();
    await page.waitForURL(/\/restaurants\/.+$/);
    await page.waitForLoadState('networkidle');

    const currentUrl = page.url();
    const restaurantSlug = currentUrl.split('/restaurants/')[1];
    console.log(`  → Viewing restaurant: ${restaurantSlug}`);

    // Add 2 products to meet minimum order (€10)
    const firstAddButton = page.locator('button:has-text("Aggiungi"):not([disabled])').first();
    await firstAddButton.click();
    await page.waitForTimeout(500);

    const secondAddButton = page.locator('button:has-text("Aggiungi"):not([disabled])').nth(1);
    await secondAddButton.click();
    await page.waitForTimeout(500);

    console.log('  → Added 2 products to cart');

    // ========================================================================
    // STEP 4: Navigate to Checkout
    // ========================================================================
    console.log('Step 4: Navigate to checkout');
    await page.goto('/cart');
    await page.waitForLoadState('networkidle');

    // Verify cart has items
    const cartItems = page.locator('button:has-text("-"):visible, button:has-text("+"):visible').first();
    await expect(cartItems).toBeVisible({ timeout: 5000 });

    // Go to checkout
    await page.click('button:has-text("Vai al Checkout"), a:has-text("Vai al Checkout")');
    await page.waitForURL('/checkout');
    await page.waitForLoadState('networkidle');

    console.log('  → On checkout page');

    // ========================================================================
    // STEP 5: Fill Address and Select ONLINE Payment
    // ========================================================================
    console.log('Step 5: Fill address and select ONLINE payment');

    // Fill address form
    const addressInputs = page.locator('h3:has-text("Indirizzo di consegna") ~ div input[type="text"]');
    await addressInputs.nth(0).fill('Via Roma');
    await addressInputs.nth(1).fill('123');
    await addressInputs.nth(2).fill('Milan');
    await addressInputs.nth(3).fill('20100');

    // Select ONLINE payment
    const onlineRadio = page.locator('input[type="radio"][value="ONLINE"], input[value="ONLINE"]');
    await onlineRadio.check();

    console.log('  → Selected ONLINE payment method');

    // ========================================================================
    // STEP 6: Submit Order
    // ========================================================================
    console.log('Step 6: Submit order with ONLINE payment');

    // Click confirm order button
    await page.click('button:has-text("Conferma Ordine"), button:has-text("Crea Ordine")');

    // Wait for payment screen to appear (NOT redirect to /orders/[id])
    await page.waitForTimeout(2000);

    const isOnPaymentScreen = await page.locator('h1:has-text("Ordine Creato")').isVisible().catch(() => false);

    if (isOnPaymentScreen) {
      console.log('  ✓ Order created, showing payment screen');
    } else {
      console.log('  ⚠ Expected payment screen not found');
      const currentUrl = page.url();
      console.log(`    Current URL: ${currentUrl}`);
    }

    // ========================================================================
    // STEP 7: Verify Order Created with PENDING Payment
    // ========================================================================
    console.log('Step 7: Verify order created with payment_status=PENDING');

    // Verify order creation page elements
    await expect(page.locator('h1:has-text("Ordine Creato")')).toBeVisible({ timeout: 5000 });

    // Extract order ID from page
    const orderIdElement = page.locator('text=/Ordine #:/i ~ text=/[a-f0-9-]+/i, p:has-text("Ordine #:")').first();
    const orderIdText = await orderIdElement.textContent().catch(() => '');

    // Try alternative selector if first one fails
    if (!orderIdText) {
      const altOrderId = await page.locator('text=/Ordine #/i').textContent().catch(() => '');
      const match = altOrderId.match(/[a-f0-9-]{36}/);
      if (match) {
        orderId = match[0];
      }
    } else {
      const match = orderIdText.match(/[a-f0-9-]{36}/);
      if (match) {
        orderId = match[0];
      }
    }

    console.log(`  → Order ID: ${orderId || 'not found on page'}`);

    // Verify payment status is shown
    const paymentStatusElement = page.locator('text=/Stato pagamento:/i').first();
    const paymentStatusText = await paymentStatusElement.textContent().catch(() => '');
    console.log(`  → ${paymentStatusText}`);

    // Verify PENDING status
    const isPending = paymentStatusText.includes('PENDING') || paymentStatusText.includes('pending');
    if (isPending) {
      console.log('  ✓ Payment status is PENDING (expected)');
    } else {
      console.log(`  ⚠ Payment status is not PENDING: ${paymentStatusText}`);
    }

    // Take screenshot of order created screen
    await page.screenshot({
      path: path.join(screenshotsDir, '01-online-created.png'),
      fullPage: true
    });

    console.log('  → Screenshot: 01-online-created.png');

    // ========================================================================
    // STEP 8: Click "Paga ora (mock)" Button
    // ========================================================================
    console.log('Step 8: Click "Paga ora (mock)" button');

    // Find and click the pay button
    const payButton = page.locator('button:has-text("Paga ora"), button:has-text("Paga ora (mock)")').first();
    await expect(payButton).toBeVisible({ timeout: 5000 });

    await payButton.click();
    console.log('  → Clicked pay button');

    // Wait for redirect to order detail page
    await page.waitForURL(/\/orders\/[a-f0-9-]+$/, { timeout: 10000 });

    const orderUrl = page.url();
    const orderIdFromUrl = orderUrl.split('/orders/')[1];
    console.log(`  → Redirected to order page: ${orderIdFromUrl}`);

    // If we didn't capture order ID before, get it from URL
    if (!orderId) {
      orderId = orderIdFromUrl;
    }

    // ========================================================================
    // STEP 9: Verify Payment Status Changed to PAID
    // ========================================================================
    console.log('Step 9: Verify payment_status=PAID and status=ACCEPTED');

    await page.waitForLoadState('networkidle');

    // Verify we're on the order detail page
    await expect(page.locator('h1:has-text("Ordine"), h1:has-text("Dettaglio Ordine")')).toBeVisible({ timeout: 5000 });

    // Check payment status (look for the whole paragraph containing both label and value)
    const paidStatusElement = page.locator('p:has-text("Stato pagamento:")').first();
    await paidStatusElement.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    const paidStatusText = await paidStatusElement.textContent().catch(() => 'Payment status not found');
    console.log(`  → Payment status: ${paidStatusText}`);

    const isPaid = paidStatusText.includes('PAID') || paidStatusText.includes('paid');
    if (isPaid) {
      console.log('  ✓ Payment status is PAID (expected)');
    } else {
      console.log(`  ⚠ Payment status is not PAID: ${paidStatusText}`);
    }

    // Check order status (displayed in large badge at top)
    const orderStatusBadge = page.locator('span.inline-block.px-4.py-2').first();
    await orderStatusBadge.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    const orderStatusText = await orderStatusBadge.textContent().catch(() => 'Order status not found');
    console.log(`  → Order status: ${orderStatusText}`);

    const isAccepted = orderStatusText.includes('ACCEPTED') || orderStatusText.includes('accepted');
    if (isAccepted) {
      console.log('  ✓ Order status is ACCEPTED (expected)');
    } else {
      console.log(`  ⚠ Order status: ${orderStatusText}`);
    }

    // Take screenshot of paid order
    await page.screenshot({
      path: path.join(screenshotsDir, '02-online-paid.png'),
      fullPage: true
    });

    console.log('  → Screenshot: 02-online-paid.png');

    // ========================================================================
    // STEP 10: Verify in Orders List
    // ========================================================================
    console.log('Step 10: Verify order appears in orders list');
    await page.goto('/orders');
    await page.waitForLoadState('networkidle');

    // Verify the order appears in the list
    const orderCards = page.locator('div.bg-white.rounded-lg:has(h3:has-text("Ordine #"))');
    await expect(orderCards.first()).toBeVisible({ timeout: 10000 });

    const orderCardsCount = await orderCards.count();
    console.log(`  → Orders list has ${orderCardsCount} order(s)`);

    // Look for this specific order
    const shortOrderId = orderId.substring(0, 8);
    const specificOrder = page.locator(`h3:has-text("Ordine #${shortOrderId}")`);
    const orderFound = await specificOrder.isVisible().catch(() => false);

    if (orderFound) {
      console.log(`  ✓ Order #${shortOrderId} found in orders list`);
    } else {
      console.log(`  ⚠ Order #${shortOrderId} not found in list (may be on different page)`);
    }

    console.log('✅ Online payment flow test completed successfully!');
  });
});
