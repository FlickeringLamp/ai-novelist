// 主要用来测试文件操作功能是否正常
import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('http://localhost:3000/');
  await page.locator('.new-file-button').click();
  await page.getByText('新建文件').click({
    button: 'right'
  });
  await page.getByText('删除').click();
  await page.getByRole('button', { name: '确定' }).click();
});