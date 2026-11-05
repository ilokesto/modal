import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

async function wheelBackground(page: Page) {
  await page.evaluate(() => {
    document.documentElement.dataset.wheelProcessed = 'pending';
    window.addEventListener('wheel', () => {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        document.documentElement.dataset.wheelProcessed = 'done';
      }));
    }, { once: true });
  });

  await page.mouse.move(4, 4);
  await page.mouse.wheel(0, 500);

  await expect(page.locator('html')).toHaveAttribute('data-wheel-processed', 'done');
}

for (const transport of ['inline', 'top-layer'] as const) {
  for (const candidate of [
    'hidden',
    'hidden-ancestor',
    'inert',
    'inert-ancestor',
    'display-none',
    'display-none-ancestor',
    'visibility-hidden',
    'visibility-hidden-ancestor',
    'visibility-collapse',
    'content-visibility-hidden',
    'negative-tabindex',
    'other-negative-tabindex',
    'hidden-input',
    'disabled',
    'disabled-fieldset',
  ]) {
    test(`${transport} focus candidates: ${candidate} -> eligible autofocus, keyboard navigation and restoration`, async ({ page }) => {
      await page.goto(`/?candidate=${candidate}`);
      const opener = page.getByRole('button', { name: `Open ${transport} focus candidates` });
      const dialog = page.getByRole('dialog', { name: 'Focus candidates' });
      const first = dialog.getByRole('button', { name: 'First eligible' });
      const last = dialog.getByRole('button', { name: 'Last eligible' });

      await opener.click();

      await expect(first).toBeFocused();
      for (const control of [
        dialog.getByRole('link', { name: 'Eligible link' }),
        dialog.getByRole('textbox', { name: 'Eligible input', exact: true }),
        dialog.getByRole('combobox', { name: 'Eligible select' }),
        dialog.getByRole('textbox', { name: 'Eligible textarea' }),
        dialog.getByText('Eligible tabindex', { exact: true }),
        last,
      ]) {
        await page.keyboard.press('Tab');
        await expect(control).toBeFocused();
      }
      if (transport === 'inline') {
        await page.keyboard.press('Tab');
        await expect(first).toBeFocused();
        await page.keyboard.press('Shift+Tab');
        await expect(last).toBeFocused();
      } else {
        // Native dialog owns boundary traversal; do not impose the inline trap.
        await page.keyboard.press('Shift+Tab');
        await expect(dialog.getByText('Eligible tabindex', { exact: true })).toBeFocused();
      }
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
      await expect(opener).toBeFocused();
    });
  }
}

test('top-layer focus candidates: inert provider ancestor -> modal controls remain eligible', async ({ page }) => {
  await page.goto('/?candidate=negative-tabindex');
  await page.locator('main').evaluate((element) => element.setAttribute('inert', ''));

  await page.getByRole('button', { name: 'Open top-layer focus candidates' }).dispatchEvent('click');

  const dialog = page.getByRole('dialog', { name: 'Focus candidates' });
  await expect(dialog.getByRole('button', { name: 'First eligible' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('link', { name: 'Eligible link' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('inline modal resolves with scoped close and restores focus', async ({ page }) => {
  await page.goto('/');

  const opener = page.getByRole('button', { name: 'Open inline confirm' });
  await opener.click();

  await expect(page.getByRole('dialog', { name: 'Delete item?' })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Delete item?' })).toHaveAccessibleDescription(
    'This action cannot be undone.'
  );

  await page.getByRole('button', { name: 'Delete' }).click();

  await expect(page.getByText('Inline result: true')).toBeVisible();
  await expect(opener).toBeFocused();
});

test('stacked inline modals only dismiss the top modal on Escape', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'Open stacked modals' }).click();
  await expect(page.getByRole('dialog', { name: 'Outer modal' })).toBeVisible();

  await page.getByRole('button', { name: 'Open inner modal' }).click();
  await expect(page.getByRole('dialog', { name: 'Inner modal' })).toBeVisible();

  await page.keyboard.press('Escape');

  await expect(page.getByRole('dialog', { name: 'Inner modal' })).toBeHidden();
  await expect(page.getByRole('dialog', { name: 'Outer modal' })).toBeVisible();
});

test('top-layer dialog opens and resolves in a real browser', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'Open top-layer settings' }).click();

  await expect(page.getByRole('dialog', { name: 'Settings dialog' })).toBeVisible();
  await page.getByRole('button', { name: 'Save settings' }).click();

  await expect(page.getByText('Top-layer result: true')).toBeVisible();
});

for (const [button, result, closeValue] of [
  ['Submit native form', 'undefined', 'undefined'],
  ['Close native directly', 'undefined', 'undefined'],
  ['Close scoped', 'true', 'true'],
  ['Close scoped then native', 'true', 'true'],
  ['Reject then native', 'rejected:native-rejection', 'undefined'],
]) {
  test(`top-layer native close: ${button} -> settles once and restores focus`, async ({ page }) => {
    await page.goto('/');
    const opener = page.getByRole('button', { name: 'Open native close demo' });
    const dialog = page.getByRole('dialog', { name: 'Native close demo', exact: true });
    await opener.click();

    await dialog.getByRole('button', { name: button, exact: true }).click();

    await expect(dialog).toHaveCount(0);
    await expect(page.getByText(`Native close result: ${result}`, { exact: true })).toBeVisible();
    await expect(page.getByText('Native close count: 1', { exact: true })).toBeVisible();
    await expect(page.getByText(`Native close values: ${closeValue}`, { exact: true })).toBeVisible();
    await expect(page.getByText('Native dismiss count: 0', { exact: true })).toBeVisible();
    await expect(opener).toBeFocused();

    await opener.click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Submit native form', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText('Native close count: 2', { exact: true })).toBeVisible();
  });
}

test('top-layer native child close: form submission -> parent keeps focus and Escape ownership', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Open native close demo' }).click();
  const parent = page.getByRole('dialog', { name: 'Native close demo', exact: true });
  const childOpener = parent.getByRole('button', { name: 'Open native child' });
  await childOpener.click();
  const child = page.getByRole('dialog', { name: 'Native child form', exact: true });

  await child.getByRole('button', { name: 'Submit child form' }).click();

  await expect(child).toHaveCount(0);
  await expect(parent).toBeVisible();
  await expect(childOpener).toBeFocused();
  await expect(page.getByText('Native child result: undefined', { exact: true })).toBeVisible();
  await expect(page.getByText('Native close count: 0', { exact: true })).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(parent).toHaveCount(0);
  await expect(page.getByText('Native close count: 1', { exact: true })).toBeVisible();
  await expect(page.getByText('Native dismiss count: 1', { exact: true })).toBeVisible();
});

for (const [parentTransport, childTransport, providers] of [
  ['top-layer', 'default', 'same'],
  ['top-layer', 'inline', 'same'],
  ['inline', 'top-layer', 'same'],
  ['top-layer', 'default', 'separate'],
  ['top-layer', 'inline', 'separate'],
]) {
  test(`mixed transports: ${parentTransport}/${childTransport}/${providers} -> child is operable and parent state survives`, async ({ page }) => {
    await page.goto(`/?parentTransport=${parentTransport}&childTransport=${childTransport}&providers=${providers}`);
    const opener = page.getByRole('button', { name: 'Open mixed parent', exact: true });
    await opener.click();
    const parent = page.getByRole('dialog', { name: 'Mixed parent', exact: true });
    await parent.getByRole('textbox', { name: 'Parent draft' }).fill('keep parent input');
    const childOpener = parent.getByRole('button', { name: 'Open mixed child', exact: true });
    await childOpener.click();
    const child = page.getByRole('dialog', { name: 'Mixed child', exact: true });
    const input = child.getByRole('textbox', { name: 'Child draft' });

    await expect(input).toBeFocused();
    await input.fill('child input');
    await child.getByRole('button', { name: 'Child action', exact: true }).click();
    await expect(child.getByText('Child actions: 1', { exact: true })).toBeVisible();
    await expect(page.locator('.mixed-child-panel')).toHaveCSS('border-top-width', '3px');
    if (childTransport !== 'top-layer') {
      await expect(child.locator('.mixed-child-backdrop')).toHaveCSS('background-color', 'rgba(0, 30, 60, 0.6)');
      await input.focus();
      await page.keyboard.press('Shift+Tab');
      await expect(child.getByRole('button', { name: 'Close mixed child', exact: true })).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(input).toBeFocused();
    }
    await child.getByRole('button', { name: 'Close mixed child', exact: true }).click();

    await expect(child).toHaveCount(0);
    await expect(childOpener).toBeFocused();
    await expect(parent.getByRole('textbox', { name: 'Parent draft' })).toHaveValue('keep parent input');
    await expect(page.getByText('Mixed child result: child-value', { exact: true })).toBeVisible();
    await expect(page.getByText('Mixed child closes: 1', { exact: true })).toBeVisible();

    await childOpener.click();
    await expect(input).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(child).toHaveCount(0);
    await expect(childOpener).toBeFocused();
    await expect(page.getByText('Mixed child closes: 2', { exact: true })).toBeVisible();
    await expect(page.getByText('Mixed child dismisses: 1', { exact: true })).toBeVisible();
    await expect(page.getByText('Mixed parent dismisses: 0', { exact: true })).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(parent).toHaveCount(0);
    await expect(opener).toBeFocused();
  });
}

test('mixed transports: closing inline host -> repeated Escape cannot dismiss the native parent', async ({ page }) => {
  await page.goto('/?slowChild=1');
  await page.getByRole('button', { name: 'Open mixed parent', exact: true }).click();
  await page.getByRole('button', { name: 'Open mixed child', exact: true }).click();
  const child = page.getByRole('dialog', { name: 'Mixed child', exact: true });
  await child.getByRole('button', { name: 'Close mixed child', exact: true }).click();

  await page.keyboard.press('Escape');

  await expect(child).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: 'Mixed parent', exact: true })).toBeVisible();
  await expect(page.getByText('Mixed parent dismisses: 0', { exact: true })).toBeVisible();
});

test('mixed transports: parent and default child open in one event -> child owns the actual top layer', async ({ page }) => {
  await page.goto('/?batchOpen=1');

  await page.getByRole('button', { name: 'Open mixed parent', exact: true }).click();

  const child = page.getByRole('dialog', { name: 'Mixed child', exact: true });
  await expect(child.getByRole('textbox', { name: 'Child draft' })).toBeFocused();
  await child.getByRole('button', { name: 'Child action', exact: true }).click();
  await expect(child.getByText('Child actions: 1', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(child).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: 'Mixed parent', exact: true })).toBeVisible();
});

test('mixed transports: inert provider ancestor -> hosted controls remain focusable and operable', async ({ page }) => {
  await page.goto('/');
  await page.locator('main').evaluate((element) => element.setAttribute('inert', ''));
  await page.getByRole('button', { name: 'Open mixed parent', exact: true }).dispatchEvent('click');

  await page.getByRole('button', { name: 'Open mixed child', exact: true }).click();

  const child = page.getByRole('dialog', { name: 'Mixed child', exact: true });
  await expect(child.getByRole('textbox', { name: 'Child draft' })).toBeFocused();
  await child.getByRole('button', { name: 'Child action', exact: true }).click();
  await expect(child.getByText('Child actions: 1', { exact: true })).toBeVisible();
});

test('mixed transports: non-dismissible hosted child -> native Escape and backdrop keep it open', async ({ page }) => {
  await page.goto('/?fixedChild=1');
  await page.getByRole('button', { name: 'Open mixed parent', exact: true }).click();
  await page.getByRole('button', { name: 'Open mixed child', exact: true }).click();
  const child = page.getByRole('dialog', { name: 'Mixed child', exact: true });

  await page.keyboard.press('Escape');
  await child.locator('.mixed-child-backdrop').click({ position: { x: 8, y: 8 } });

  await expect(child).toBeVisible();
  await expect(page.getByText('Mixed child dismisses: 0', { exact: true })).toBeVisible();
  await expect(page.getByText('Mixed child closes: 0', { exact: true })).toBeVisible();
  await child.getByRole('button', { name: 'Close mixed child', exact: true }).click();
  await expect(child).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: 'Mixed parent', exact: true })).toBeVisible();
});

test('top-layer descendant and padding clicks keep the dialog open', async ({ page }) => {
  // Given
  await page.goto('/');
  await page.getByRole('button', { name: 'Open top-layer settings' }).click();
  const dialog = page.getByRole('dialog', { name: 'Settings dialog' });
  await expect(dialog).toHaveAccessibleDescription('Configure your modal preferences.');
  const dialogBox = await dialog.boundingBox();
  if (dialogBox === null) {
    throw new TypeError('Visible top-layer dialog has no bounding box.');
  }
  const contentBox = await page.getByRole('region', { name: 'Settings content' }).boundingBox();
  if (contentBox === null) {
    throw new TypeError('Visible top-layer content has no bounding box.');
  }
  const descendantBox = await page.getByRole('button', { name: 'Keep settings open' }).boundingBox();
  if (descendantBox === null) {
    throw new TypeError('Visible top-layer descendant has no bounding box.');
  }
  const paddingX = dialogBox.x + 16;
  const paddingY = dialogBox.y + 16;
  expect(paddingX).toBeGreaterThan(dialogBox.x);
  expect(paddingX).toBeLessThan(dialogBox.x + dialogBox.width);
  expect(paddingY).toBeGreaterThan(dialogBox.y);
  expect(paddingY).toBeLessThan(dialogBox.y + dialogBox.height);
  expect(paddingX).toBeLessThan(contentBox.x);
  expect(paddingY).toBeLessThan(contentBox.y);

  // When
  await page.mouse.click(
    descendantBox.x + descendantBox.width / 2,
    descendantBox.y + descendantBox.height / 2
  );
  await page.mouse.click(paddingX, paddingY);

  // Then
  await expect(dialog).toBeVisible();
  await expect(page.getByText('Top-layer dismiss count: 0')).toBeVisible();
  await expect(page.getByText('Top-layer result: pending')).toBeVisible();
});

test('physical top-layer backdrop click dismisses exactly once', async ({ page }) => {
  // Given
  await page.goto('/');
  await page.getByRole('button', { name: 'Open top-layer settings' }).click();
  const dialog = page.getByRole('dialog', { name: 'Settings dialog' });
  const dialogBox = await dialog.boundingBox();
  if (dialogBox === null) {
    throw new TypeError('Visible top-layer dialog has no bounding box.');
  }

  // When
  await page.mouse.click(dialogBox.x - 16, dialogBox.y + dialogBox.height / 2);

  // Then
  await expect(dialog).toBeHidden();
  await expect(page.getByText('Top-layer dismiss count: 1')).toBeVisible();
  await expect(page.getByText('Top-layer result: undefined')).toBeVisible();
});

test('reduced motion disables modal animation on first render', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');

  await page.getByRole('button', { name: 'Open inline confirm' }).click();

  const animationDuration = await page
    .getByRole('dialog', { name: 'Delete item?' })
    .evaluate((element) => getComputedStyle(element).animationDuration);

  expect(animationDuration).toBe('0s');
});

test('inline backdrop and z-index stay local to each provider', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Open first provider inline' }).click();
  await page.getByRole('button', { name: 'Open second provider inline' }).dispatchEvent('click');

  const firstDialog = page.getByRole('dialog', { name: 'First provider inline modal' });
  const secondDialog = page.getByRole('dialog', { name: 'Second provider inline modal' });
  const firstWrapper = page.locator('.ilokesto-modal-inline-wrapper').filter({ has: firstDialog });
  const secondWrapper = page.locator('.ilokesto-modal-inline-wrapper').filter({ has: secondDialog });

  await expect(firstWrapper).toHaveCSS('z-index', '10000');
  await expect(secondWrapper).toHaveCSS('z-index', '10000');

  await firstWrapper.getByRole('button', { name: 'Dismiss modal' }).dispatchEvent('click');

  await expect(firstDialog).toBeHidden();
  await expect(secondDialog).toBeVisible();
});

test('Escape dismisses the top inline modal in each provider', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Open first provider inline' }).click();
  await page.getByRole('button', { name: 'Open second provider inline' }).dispatchEvent('click');

  const firstDialog = page.getByRole('dialog', { name: 'First provider inline modal' });
  const secondDialog = page.getByRole('dialog', { name: 'Second provider inline modal' });

  await page.keyboard.press('Escape');

  await expect(firstDialog).toBeHidden();
  await expect(secondDialog).toBeHidden();
});

test('focus wrapping remains inside the selected provider modal', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Open first provider inline' }).click();
  await page.getByRole('button', { name: 'Open second provider inline' }).dispatchEvent('click');

  await page.getByRole('button', { name: 'First end' }).focus();
  await page.keyboard.press('Tab');

  await expect(page.getByRole('button', { name: 'First start' })).toBeFocused();
});

test('top-layer cancel only dismisses the provider that owns the dialog', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Open first provider top layer' }).click();
  await page.getByRole('button', { name: 'Open second provider top layer' }).dispatchEvent('click');

  const firstDialog = page.getByRole('dialog', { name: 'First provider top-layer modal' });
  const secondDialog = page.getByRole('dialog', { name: 'Second provider top-layer modal' });

  await firstDialog.dispatchEvent('cancel');

  await expect(firstDialog).toBeHidden();
  await expect(secondDialog).toBeVisible();
});

test('physical Escape dismisses first-provider inline and second-provider top-layer modals', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Open first provider inline' }).click();
  await page.getByRole('button', { name: 'Open second provider top layer' }).dispatchEvent('click');

  const inlineDialog = page.getByRole('dialog', { name: 'First provider inline modal' });
  const topLayerDialog = page.getByRole('dialog', { name: 'Second provider top-layer modal' });

  await page.keyboard.press('Escape');

  await expect(inlineDialog).toBeHidden();
  await expect(topLayerDialog).toBeHidden();
});

test('physical Escape dismisses a hosted inline modal before the native modal in another provider', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Open first provider top layer' }).click();
  await page.getByRole('button', { name: 'Open second provider inline' }).dispatchEvent('click');

  const topLayerDialog = page.getByRole('dialog', { name: 'First provider top-layer modal' });
  const inlineDialog = page.getByRole('dialog', { name: 'Second provider inline modal' });
  await expect(inlineDialog.getByRole('button', { name: 'Second start' })).toBeFocused();
  await inlineDialog.getByRole('button', { name: 'Second end' }).click();

  await page.keyboard.press('Escape');

  await expect(inlineDialog).toBeHidden();
  await expect(topLayerDialog).toBeVisible();
  await expect(topLayerDialog.getByRole('button', { name: 'First close top layer' })).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(topLayerDialog).toBeHidden();
});

for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
  test(`scroll lock: native modal at ${viewport.width}px -> wheel stays locked until removal`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/?scrollLock=1');
    await page.evaluate(() => document.body.style.setProperty('overflow', 'auto', 'important'));
    await page.getByRole('button', { name: 'Open scroll first', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Scroll first modal', exact: true });
    await expect(dialog).toBeVisible();
    const initialScroll = await page.evaluate(() => window.scrollY);

    await wheelBackground(page);

    expect(await page.evaluate(() => window.scrollY)).toBe(initialScroll);
    await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');
    await dialog.getByRole('button', { name: 'Close scroll first', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    expect(await page.evaluate(() => document.body.style.getPropertyPriority('overflow'))).toBe('important');
    await expect(page.locator('body')).toHaveCSS('overflow', 'auto');

    await page.evaluate(() => window.scrollTo(0, 0));
    await wheelBackground(page);
    await page.waitForFunction(() => window.scrollY > 0);
  });
}

for (const firstTransport of ['inline', 'top-layer']) {
  for (const secondTransport of ['inline', 'top-layer']) {
    for (const firstToClose of ['first', 'second']) {
      test(`scroll lock: ${firstTransport}/${secondTransport}, close ${firstToClose} first -> last provider owns release`, async ({ page }) => {
        await page.goto(`/?scrollLock=1&firstTransport=${firstTransport}&secondTransport=${secondTransport}`);
        await page.evaluate(() => document.body.style.setProperty('overflow', 'auto', 'important'));
        await page.getByRole('button', { name: 'Open scroll first', exact: true }).click();
        const first = page.getByRole('dialog', { name: 'Scroll first modal', exact: true });
        await first.getByRole('button', { name: 'Open scroll second', exact: true }).click();
        const second = page.getByRole('dialog', { name: 'Scroll second modal', exact: true });
        await expect(second).toBeVisible();
        const initialScroll = await page.evaluate(() => window.scrollY);

        await wheelBackground(page);

        expect(await page.evaluate(() => window.scrollY)).toBe(initialScroll);
        await second.getByRole('button', { name: `Close scroll ${firstToClose}`, exact: true }).click();
        await expect(firstToClose === 'first' ? first : second).toHaveCount(0);
        await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');
        const remainingScroll = await page.evaluate(() => window.scrollY);
        await wheelBackground(page);
        expect(await page.evaluate(() => window.scrollY)).toBe(remainingScroll);

        const remaining = firstToClose === 'first' ? second : first;
        await remaining.getByRole('button', {
          name: firstToClose === 'first' ? 'Close scroll second' : 'Close scroll first',
          exact: true,
        }).click();
        await expect(first).toHaveCount(0);
        await expect(second).toHaveCount(0);
        await expect(page.locator('body')).toHaveCSS('overflow', 'auto');
        expect(await page.evaluate(() => document.body.style.getPropertyPriority('overflow'))).toBe('important');

        await page.evaluate(() => window.scrollTo(0, 0));
        await wheelBackground(page);
        await page.waitForFunction(() => window.scrollY > 0);
      });
    }
  }
}
