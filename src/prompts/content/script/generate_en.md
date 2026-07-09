---
id: script/generate
version: 1.0.0
lang: en
title: Case Generation
---
Given the discovered form below, generate a login test case (JSON).

Target page: {{pageUrl}}
Username selector: {{usernameSelector}}
Password selector: {{passwordSelector}}
Submit selector: {{submitSelector}}

Requirements: goto the target page, fill username and password, click submit, then assert the post-login page is visible.
