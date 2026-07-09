import { test, expect } from '@playwright/test';
import { createExampleRegistry, helloPrompt, generateCase } from '../../src/prompts/example';

/**
 * 快照契约测试（参考 OpenClaw 的 prompt 漂移锁）：
 * 任何对示例提示词文本的改动都会触发快照差异，强制作者在本次变更中同步快照。
 */
test('hello prompt renders to a stable snapshot', () => {
  const reg = createExampleRegistry();
  const result = reg.render(helloPrompt, { name: '世界' });
  expect(result.text).toMatchSnapshot();
});

test('generateCase (zh) renders partials + body to a stable snapshot', () => {
  const reg = createExampleRegistry();
  const result = reg.render(
    generateCase,
    {
      pageUrl: 'https://example.com/login',
      usernameSelector: '#username',
      passwordSelector: '#password',
      submitSelector: '#submit',
    },
    { lang: 'zh' },
  );
  expect(result.text).toMatchSnapshot();
});

test('generateCase (en) renders lang variant to a stable snapshot', () => {
  const reg = createExampleRegistry();
  const result = reg.render(
    generateCase,
    {
      pageUrl: 'https://example.com/login',
      usernameSelector: '#username',
      passwordSelector: '#password',
      submitSelector: '#submit',
    },
    { lang: 'en' },
  );
  expect(result.text).toMatchSnapshot();
});
