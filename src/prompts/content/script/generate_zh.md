---
id: script/generate
version: 1.0.0
lang: zh
title: 用例生成
---
根据以下发现的表单，生成一个登录测试用例（JSON 格式）。

目标页面：{{pageUrl}}
用户名字段选择器：{{usernameSelector}}
密码字段选择器：{{passwordSelector}}
提交按钮选择器：{{submitSelector}}

要求：先 goto 目标页面，填充用户名与密码，点击提交，并断言登录后页面可见。
