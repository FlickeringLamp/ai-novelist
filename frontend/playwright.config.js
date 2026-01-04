// @ts-check
import { defineConfig, devices } from '@playwright/test';

/**
 * 从文件读取环境变量。
 * https://github.com/motdotla/dotenv
 */
// import dotenv from 'dotenv';
// import path from 'path';
// dotenv.config({ path: path.resolve(__dirname, '.env') await page.getByTitle('新建文件', { exact: true }).click();});

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './e2e',
  /* 并行运行文件中的测试 */
  fullyParallel: true,
  /* 如果在源代码中意外留下 test.only，则在 CI 上使构建失败。 */
  forbidOnly: !!process.env.CI,
  /* 仅在 CI 上重试 */
  retries: process.env.CI ? 2 : 0,
  /* 在 CI 上禁用并行测试。 */
  workers: process.env.CI ? 1 : undefined,
  /* 要使用的报告器。参见 https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* 以下所有项目的共享设置。参见 https://playwright.dev/docs/api/class-testoptions。 */
  use: {
    /* 在 `await page.goto('')` 等操作中使用的基础 URL。 */
    baseURL: 'http://localhost:3000',

    /* 重试失败的测试时收集跟踪信息。参见 https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },

  /* 为主要浏览器配置项目 */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    /* 针对移动端视口进行测试。 */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },

    /* 针对品牌浏览器进行测试。 */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* 在开始测试之前运行本地开发服务器 */
  // webServer: {
  //   command: 'npm run start',
  //   url: 'http://localhost:3000',
  //   reuseExistingServer: !process.env.CI,
  // },
});

