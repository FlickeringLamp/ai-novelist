import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('http://localhost:3000/');
  await page.getByRole('button', { name: '新建文件', exact: true }).click();
  await page.getByText('新建文件').click();
  await page.getByRole('button', { name: '×' }).first().click();
  await page.getByText('新建文件').click({
    button: 'right'
  });
  await page.getByText('删除').click();
  await page.getByRole('button', { name: '确定' }).click();
});