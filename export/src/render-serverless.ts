import puppeteer, { Page } from 'puppeteer';

import { getModules } from './data';
import config from './config';
import type { PageData } from './types';

// Arbitrarily high number - just make sure it doesn't clip the timetable
const VIEWPORT_HEIGHT = 2000;

export interface ViewportOptions {
  pixelRatio?: number;
  width?: number;
  height?: number;
}

async function setViewport(page: Page, options: ViewportOptions = {}) {
  await page.setViewport({
    deviceScaleFactor: options.pixelRatio || 1,
    width: options.width || config.pageWidth,
    height: options.height || VIEWPORT_HEIGHT,
  });
}

export async function open(url: string) {
  // const executablePath = await chromium.executablePath;

  // console.log(`Chromium executable path: ${executablePath}`);

  const browser = await puppeteer.launch({
    // devtools: !!process.env.DEVTOOLS, // TODO: Query string && NODE_ENV === 'development'?
    headless:true,
    args: [
      // '--headless',
      '--disable-gpu',
      '--disable-software-rasterizer',
      '--disable-dev-shm-usage',
    ],
  });

  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'load' , timeout: 10000});
  await setViewport(page);

  return page;
}

async function injectData(page: Page, data: PageData) {
  const moduleCodes = Object.keys(data.timetable);
  const modules = await getModules(moduleCodes);

  await page.evaluate(`
    new Promise((resolve) =>
      window.setData(${JSON.stringify(modules)}, ${JSON.stringify(data)}, resolve)
    )
  `);

  // Calculate element height to get bounding box for screenshot
  const appEle = await page.$('#timetable-only');
  if (!appEle) throw new Error('#timetable-only element not found');

  return (await appEle.boundingBox()) || undefined;
}

export async function image(page: Page, data: PageData, options: ViewportOptions = {}) {
  if (options.pixelRatio || (options.height && options.width)) {
    await setViewport(page, options);
  }

  const boundingBox = await injectData(page, data);
  return await page.screenshot({
    clip: boundingBox,
  });
}

export async function pdf(page: Page, data: PageData) {
  await injectData(page, data);
  await page.emulateMediaType('screen');

  return await page.pdf({
    printBackground: true,
    format: 'a4',
    landscape: data.theme.timetableOrientation === 'HORIZONTAL',
  });
}
