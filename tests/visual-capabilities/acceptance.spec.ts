import { test, expect } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const fixture = resolve(__dirname, '../../fixtures/visual-acceptance/paired-cards.html');
const key = JSON.parse(readFileSync(resolve(__dirname, '../../fixtures/visual-acceptance/answer-key.json'), 'utf8'));
const sourceHash = createHash('sha256').update(readFileSync(fixture)).digest('hex');
const contrast = (foreground: string, background: string) => {
  const luminance = (rgb: string) => rgb.match(/\d+/g)!.slice(0, 3).map(Number).map(value => {
    const channel = value / 255;
    return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
  }).reduce((sum, channel, index) => sum + channel * [.2126, .7152, .0722][index], 0);
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + .05) / (values[1] + .05);
};

for (const variant of ['balanced', 'mismatch', 'featured']) {
  for (const width of [1440, 768, 390]) {
    for (const theme of ['light', 'dark'] as const) {
      for (const content of ['normal', 'long']) {
        test(`${variant} ${width} ${theme} ${content}`, async ({ page, browser }, info) => {
          expect(sourceHash).toBe(key.provenance.source_revision);
          await page.setViewportSize({ width, height: 900 });
          await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
          await page.goto(pathToFileURL(fixture).href);
          await page.locator('body').evaluate((body, value) => { body.dataset.variant = value; }, variant);
          if (content === 'long') await page.locator('.description').last().evaluate(element => {
            element.textContent = 'Detailed project notes with unusually long titles, translated descriptions and meaningful status information. '.repeat(8);
          });
          await page.evaluate(() => document.fonts.ready);
          const observed = await page.evaluate(() => {
            const cards = [...document.querySelectorAll('article')].map(element => {
              const { x, y, width, height } = element.getBoundingClientRect(); return { x, y, width, height };
            });
            const style = getComputedStyle(document.documentElement);
            return { cards, overflow: document.documentElement.scrollWidth > innerWidth + 1, fonts: document.fonts.status,
              foreground: style.color, background: style.backgroundColor,
              animation: getComputedStyle(document.querySelector('#marker')!).animationName };
          });
          const [left, right] = observed.cards;
          const sameRow = Math.abs(left.y - right.y) <= 1;
          const equalRequired = variant !== 'featured';
          const layoutFailure = observed.overflow || (equalRequired && (Math.abs(left.width - right.width) > 1 || (sameRow && Math.abs(left.height - right.height) > 1)));
          expect(layoutFailure).toBe(key.layout_failure[variant]);
          if (variant === 'mismatch' && sameRow) {
            expect(Math.abs(left.width - right.width)).toBeGreaterThan(1);
            expect(Math.abs(left.height - right.height)).toBeGreaterThan(1);
          }
          if (variant === 'featured' && sameRow) expect(left.width).toBeGreaterThan(right.width * 1.9);
          expect(observed.fonts).toBe('loaded');
          expect(observed.animation).toBe('none');
          expect(contrast(observed.foreground, observed.background)).toBeGreaterThanOrEqual(4.5);
          const focusResults = [];
          for (const name of ['Read field notes', 'Explore new horizons', 'Show project details']) {
            await page.keyboard.press('Tab');
            const focused = page.locator(':focus');
            await expect(focused).toHaveAccessibleName(name);
            const outline = await focused.evaluate(element => {
              const style = getComputedStyle(element); return { style: style.outlineStyle, width: parseFloat(style.outlineWidth), color: style.outlineColor };
            });
            expect(outline.style).not.toBe('none');
            expect(outline.width).toBeGreaterThanOrEqual(2);
            expect(contrast(outline.color, observed.background)).toBeGreaterThanOrEqual(3);
            focusResults.push({ name, outline });
          }
          await page.keyboard.press('Enter');
          await expect(page.getByRole('button', { name: 'Show project details' })).toHaveAttribute('aria-expanded', 'true');
          await expect(page.locator('#details')).toBeVisible();
          await page.screenshot({ path: info.outputPath('context.png'), fullPage: true });
          await page.locator('.cards').screenshot({ path: info.outputPath('component.png') });
          writeFileSync(info.outputPath('observations.json'), JSON.stringify({ source_sha256: sourceHash, browser: browser.version(), width, theme, content, variant, ...observed, layoutFailure, focusResults, contrast: contrast(observed.foreground, observed.background), limits: ['System font only', 'No axe scan or screen-reader testing', 'Seeded browser checks, not model trials'] }, null, 2));
          await info.attach('observations', { path: info.outputPath('observations.json'), contentType: 'application/json' });
        });
      }
    }
  }
}

for (const mode of ['text-200', 'reflow-320']) {
  test(mode, async ({ page }, info) => {
    await page.setViewportSize({ width: mode === 'reflow-320' ? 320 : 1280, height: 900 });
    await page.goto(pathToFileURL(fixture).href);
    if (mode === 'text-200') await page.locator('html').evaluate(element => { element.style.fontSize = '32px'; });
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    for (const control of await page.locator('a,button').all()) {
      await expect(control).toBeVisible();
      expect(await control.evaluate(element => element.scrollWidth <= element.clientWidth + 1 || getComputedStyle(element).display === 'inline')).toBe(true);
    }
    await page.screenshot({ path: info.outputPath('context.png'), fullPage: true });
    writeFileSync(info.outputPath('observations.json'), JSON.stringify({source_sha256: sourceHash, mode, overflow: false, limits: 'CSS text enlargement and narrow viewport reflow probes; not an actual browser-zoom or screen-reader test.'}, null, 2));
  });
}

test.afterAll(async ({}, info) => { console.log('Visual evidence:', info.project.outputDir); });
