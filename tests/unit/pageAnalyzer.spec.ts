import { test, expect } from '@playwright/test';
import { PageAnalyzer } from '../../src/core/PageAnalyzer';

test('PageAnalyzer extracts nav, headings and actions', async ({ page }) => {
  await page.setContent(`
    <nav>
      <a href="/home">首页</a>
      <a href="/about">关于</a>
      <a href="/home">首页</a>
    </nav>
    <main>
      <h1>标题</h1>
      <h2>小节</h2>
      <button id="btn1">提交</button>
      <a href="/docs">文档</a>
    </main>
  `);
  const analyzer = new PageAnalyzer();
  const structure = await analyzer.analyze(page);

  // nav:去重后 2 项
  expect(structure.nav.length).toBe(2);
  expect(structure.nav.some((n) => n.text === '首页' && n.href?.includes('/home'))).toBe(true);

  // headings
  expect(structure.headings).toEqual([
    { level: 1, text: '标题' },
    { level: 2, text: '小节' },
  ]);

  // actions:nav 内的链接被排除;含按钮与文档链接
  expect(structure.actions.some((a) => a.kind === 'button' && a.selector === 'button#btn1')).toBe(true);
  expect(structure.actions.some((a) => a.kind === 'link' && a.text === '文档')).toBe(true);
  expect(structure.actions.some((a) => a.text === '首页')).toBe(false);
});

test('PageAnalyzer captures SPA menu items as nav with selector', async ({ page }) => {
  await page.setContent(`
    <ul class="ant-menu">
      <li class="ant-menu-item">工作台</li>
      <li class="ant-menu-item">主机管理</li>
    </ul>
  `);
  const analyzer = new PageAnalyzer();
  const structure = await analyzer.analyze(page);
  const host = structure.nav.find((n) => n.text === '主机管理');
  expect(host).toBeTruthy();
  expect(host?.selector).toBe('li:has-text("主机管理")');
  expect(host?.href).toBeUndefined();
});

test('PageAnalyzer caps actions', async ({ page }) => {
  const buttons = Array.from({ length: 25 }, (_, i) => `<button id="b${i}">按钮${i}</button>`).join('');
  await page.setContent(`<main>${buttons}</main>`);
  const analyzer = new PageAnalyzer();
  const structure = await analyzer.analyze(page);
  expect(structure.actions.length).toBe(20);
});
