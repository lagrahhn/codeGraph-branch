# Git 提交身份验证完全指南

## 概述

本文档详细讲解 Git 提交的身份验证机制，包括如何修改提交作者、如何伪造提交信息，以及如何防止伪造。

## 目录

1. [Git 身份验证的本质](#git-身份验证的本质)
2. [修改提交作者的方法](#修改提交作者的方法)
3. [伪造提交的示例](#伪造提交的示例)
4. [真正的身份验证机制](#真正的身份验证机制)
5. [防止伪造的方法](#防止伪造的方法)
6. [最佳实践](#最佳实践)

---

## Git 身份验证的本质

### 用户信息完全可自定义

Git 的用户信息（Author/Committer）可以设置为任何内容：

```bash
# 设置任何名字和邮箱
git config user.name "任何名字"
git config user.email "任何邮箱@example.com"

# 一次性提交时指定
git commit --author="假名字 <假邮箱@fake.com>" -m "提交信息"
```

**验证示例：**

```bash
# 查看提交信息
git show --format="%H%nAuthor: %an <%ae>%nCommit: %cn <%ce>" --no-patch

# 输出：
# d32c4ce64941dc8a92b14654d7ae1f42b2ac1dec
# Author: 假名字 <假邮箱@fake.com>
# Commit: 另一个假名字 <另一个假邮箱@fake.com>
```

### 提交信息完全可自定义

```bash
# 可以写任何内容
git commit -m "这是假的提交信息"

# 修改已提交的信息
git commit --amend -m "修改后的提交信息"
```

### Git 的设计哲学

Git 是一个**分布式版本控制系统**，设计时就没有内置身份验证：

```
Git 的核心功能：
✓ 版本控制（记录代码变化）
✓ 分支管理
✓ 协作开发

Git 不负责：
✗ 身份验证
✗ 权限控制
✗ 真实性验证
```

### 信任模型

```
本地 Git（完全信任）→ 远程仓库（需要验证）

本地：你可以做任何事情
远程：需要 SSH 密钥/HTTPS 密码
```

---

## 修改提交作者的方法

### 方法 1：修改最近一次提交（最常用）

```bash
git commit --amend --author="Author Name <email@example.com>"
```

**原理：**
- `--amend` 会修改最近一次提交
- `--author` 指定新的作者信息
- 提交者（Committer）保持为当前 git 配置的用户

**示例：**

```bash
# 将最近一次提交的作者改为 lagrahhn
git commit --amend --author="lagrahhn <lagrahhn@users.noreply.github.com>"
```

**效果：**

```
Before:
Author: shangrenwu <shangrenwu@yunke.ai>
Commit: shangrenwu <shangrenwu@yunke.ai>

After:
Author: lagrahhn <lagrahhn@users.noreply.github.com>
Commit: shangrenwu <shangrenwu@yunke.ai>
```

### 方法 2：修改多个提交（交互式 rebase）

```bash
# 修改最近 3 个提交
git rebase -i HEAD~3
```

**步骤：**

1. **启动交互式 rebase**

   ```bash
   git rebase -i HEAD~3
   ```

2. **编辑器会显示：**

   ```
   pick abc1234 第一个提交
   pick def5678 第二个提交
   pick ghi9012 第三个提交
   ```

3. **将要修改的提交的 `pick` 改为 `edit`：**

   ```
   edit abc1234 第一个提交
   edit def5678 第二个提交
   pick ghi9012 第三个提交
   ```

4. **保存并退出，Git 会依次暂停在每个 `edit` 提交**

5. **对每个提交修改作者：**

   ```bash
   git commit --amend --author="New Author <new@email.com>"
   git rebase --continue
   ```

6. **重复直到所有提交修改完成**

### 方法 3：批量修改所有提交（git filter-branch）

```bash
git filter-branch --env-filter '
if [ "$GIT_AUTHOR_EMAIL" = "old@email.com" ]; then
    export GIT_AUTHOR_NAME="New Name"
    export GIT_AUTHOR_EMAIL="new@email.com"
fi
' --tag-name-filter cat -- --branches --tags
```

**⚠️ 警告：** 这会重写所有提交历史，不推荐在共享分支上使用。

### 方法 4：使用 git filter-repo（推荐）

```bash
# 安装 git-filter-repo
pip install git-filter-repo

# 修改所有提交的作者
git filter-repo --mailmap mailmap.txt
```

**mailmap.txt 格式：**

```
New Name <new@email.com> Old Name <old@email.com>
```

---

## Author vs Committer 的区别

Git 中有两个身份信息：

```
Author: lagrahhn <lagrahhn@users.noreply.github.com>  # 代码的原始作者
Commit: shangrenwu <shangrenwu@yunke.ai>              # 执行提交操作的人
```

**场景：**
- **Author**：写代码的人（可能是同事、贡献者）
- **Committer**：执行 `git commit` 的人（可能是你自己）

**修改命令：**

```bash
# 只修改 Author
git commit --amend --author="Author <email>"

# 同时修改 Author 和 Committer
git commit --amend --author="Author <email>" --reset-author
```

---

## 伪造提交的示例

### 伪造作者

```bash
# 设置假身份
git config user.name "假名字"
git config user.email "假邮箱@fake.com"

# 提交
git commit -m "假身份提交"

# 验证
git show --format="%an <%ae>" --no-patch
# 输出: 假名字 <假邮箱@fake.com>
```

### 伪造时间戳

```bash
# 设置假的提交时间
GIT_AUTHOR_DATE="2020-01-01T00:00:00" git commit -m "假时间"

# 验证
git show --format="%ai" --no-patch
# 输出: 2020-01-01 00:00:00 +0800
```

### 修改已提交的历史

```bash
# 修改作者和时间
git commit --amend --author="假作者 <fake@email.com>" --date="2020-01-01"

# 验证
git show --format="%H%nAuthor: %an <%ae>%nDate: %ai" --no-patch
```

### 批量伪造

```bash
# 使用 filter-branch 批量修改
git filter-branch --env-filter '
export GIT_AUTHOR_NAME="假名字"
export GIT_AUTHOR_EMAIL="假邮箱@fake.com"
export GIT_COMMITTER_NAME="假名字"
export GIT_COMMITTER_EMAIL="假邮箱@fake.com"
' --tag-name-filter cat -- --branches --tags
```

---

## 真正的身份验证机制

### 1. SSH 密钥验证（推送时）

```bash
# 生成 SSH 密钥
ssh-keygen -t ed25519 -C "your_email@example.com"

# 添加到 GitHub/GitLab
# 推送时会验证密钥
git push origin main
```

**验证过程：**

```
本地提交（任何身份）
    ↓
推送时验证 SSH 密钥
    ↓
远程仓库接受/拒绝
```

### 2. GPG 签名验证（可选）

```bash
# 生成 GPG 密钥
gpg --full-generate-key

# 配置 Git 使用 GPG
git config user.signingkey YOUR_KEY_ID

# 签名提交
git commit -S -m "Signed commit"

# 验证签名
git log --show-signature
```

**效果：**

```
commit abc1234
Author: lagrahhn <lagrahhn@users.noreply.github.com>
gpg: Signature made Mon Jun 23 15:30:00 2026
gpg: using RSA key 1234567890ABCDEF
gpg: Good signature from "lagrahhn <lagrahhn@users.noreply.github.com>"
```

### 3. GitHub/GitLab 的验证

```
GitHub 验证逻辑：
1. 推送时检查 SSH 密钥/HTTPS 密码
2. 对比提交邮箱和 GitHub 账户邮箱
3. 显示 "Verified" 或 "Unverified" 标签
```

### 4. HTTPS 验证

```bash
# 使用 HTTPS 推送时需要输入用户名和密码
git push origin main

# 或者使用个人访问令牌（PAT）
git push https://<token>@github.com/user/repo.git
```

---

## 防止伪造的方法

### 1. GPG 签名（最可靠）

```bash
# 强制所有提交必须签名
git config commit.gpgsign true

# 验证签名
git log --show-signature

# GitHub 会显示 "Verified" 标签
```

**配置示例：**

```bash
# 生成 GPG 密钥
gpg --full-generate-key

# 列出 GPG 密钥
gpg --list-secret-keys --keyid-format LONG

# 配置 Git 使用 GPG
git config --global user.signingkey YOUR_KEY_ID
git config --global commit.gpgsign true

# 导出公钥并添加到 GitHub
gpg --armor --export YOUR_KEY_ID
```

### 2. SSH 密钥验证

```bash
# 只允许配置了 SSH 密钥的用户推送
# GitHub/GitLab 设置中启用
```

### 3. 提交签名要求

```bash
# 在 GitHub 仓库设置中：
# Settings → Branches → Branch protection rules
# ✓ Require signed commits
```

### 4. 代码审查

```bash
# Pull Request 流程
# 所有提交必须经过审查
# 防止恶意代码混入
```

### 5. 分支保护规则

```bash
# GitHub 仓库设置：
# Settings → Branches → Branch protection rules
# ✓ Require pull request reviews before merging
# ✓ Require status checks to pass before merging
# ✓ Require signed commits
# ✓ Include administrators
```

---

## 验证级别对比

| 验证级别 | 方法 | 可靠性 | 使用场景 |
|---------|------|--------|---------|
| 无验证 | 默认 Git | ❌ 低 | 个人项目 |
| SSH 验证 | SSH 密钥 | ✅ 中 | 团队协作 |
| GPG 签名 | GPG 密钥 | ✅ 高 | 开源项目 |
| 双因素 | 2FA + 密钥 | ✅ 很高 | 企业项目 |

---

## 最佳实践

### 1. 设置正确的用户信息

```bash
# 全局设置（推荐）
git config --global user.name "Your Real Name"
git config --global user.email "your-real-email@example.com"

# 项目级别设置
git config user.name "Project Name"
git config user.email "project@email.com"
```

### 2. 启用 GPG 签名

```bash
# 生成 GPG 密钥
gpg --full-generate-key

# 配置 Git
git config --global user.signingkey YOUR_KEY_ID
git config --global commit.gpgsign true

# 添加到 GitHub/GitLab
gpg --armor --export YOUR_KEY_ID
```

### 3. 使用 SSH 密钥

```bash
# 生成 SSH 密钥
ssh-keygen -t ed25519 -C "your_email@example.com"

# 添加到 SSH 代理
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519

# 添加到 GitHub/GitLab
cat ~/.ssh/id_ed25519.pub
```

### 4. 配置分支保护

```bash
# GitHub 仓库设置
# Settings → Branches → Branch protection rules

# 推荐配置：
# ✓ Require pull request reviews before merging
# ✓ Require status checks to pass before merging
# ✓ Require signed commits
# ✓ Include administrators
# ✓ Restrict who can push to matching branches
```

### 5. 定期审查提交历史

```bash
# 查看所有提交的作者
git log --format="%h %an <%ae> %s"

# 查看特定作者的提交
git log --author="lagrahhn" --oneline

# 检查是否有可疑的提交
git log --show-signature
```

---

## 常见问题

### Q1: 为什么 GitHub 显示 "Unverified"？

**原因：** 提交邮箱和 GitHub 账户邮箱不匹配

**解决方案：**
```bash
# 方法 1：使用 GitHub 账户邮箱
git config user.email "your-github-email@example.com"

# 方法 2：添加多个邮箱到 GitHub 账户
# GitHub → Settings → Emails → Add email address

# 方法 3：启用 GPG 签名
git config commit.gpgsign true
```

### Q2: 如何验证提交是否被篡改？

```bash
# 检查提交哈希
git log --oneline

# 检查 GPG 签名
git log --show-signature

# 检查提交时间
git log --format="%h %ai %an %s"
```

### Q3: 如何撤销已推送的伪造提交？

```bash
# 方法 1： revert（推荐，保留历史）
git revert <commit-hash>

# 方法 2： reset（危险，重写历史）
git reset --hard <commit-hash>
git push --force-with-lease

# 方法 3： filter-branch（批量修改）
git filter-branch --env-filter '...'
git push --force-with-lease
```

### Q4: 如何防止团队成员伪造提交？

```bash
# 1. 启用分支保护规则
# 2. 要求 GPG 签名
# 3. 要求代码审查
# 4. 启用状态检查
# 5. 定期审查提交历史
```

---

## 工具推荐

### 1. git-filter-repo

```bash
# 安装
pip install git-filter-repo

# 使用 mailmap 批量修改作者
git filter-repo --mailmap mailmap.txt
```

### 2. git-crypt

```bash
# 安装
brew install git-crypt

# 加密敏感文件
git-crypt init
git-crypt add-gpg-user USER_ID
```

### 3. pre-commit

```bash
# 安装
pip install pre-commit

# 配置提交前检查
cat > .pre-commit-config.yaml << EOF
repos:
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.0.1
    hooks:
      - id: trailing-whitespace
      - id: end-of-file-fixer
      - id: check-yaml
EOF

# 安装钩子
pre-commit install
```

---

## 总结

**Git 的身份系统是基于"信任"而非"验证"：**

```
本地 Git：
✓ 可以设置任何名字和邮箱
✓ 可以修改已提交的历史
✓ 可以伪造时间戳
✓ 没有内置验证机制

远程仓库（GitHub/GitLab）：
✓ 需要 SSH 密钥/HTTPS 密码验证
✓ 可以启用 GPG 签名要求
✓ 可以显示 "Verified" 标签
✓ 可以设置分支保护规则
```

**关键点：**
1. **Git 本身不验证身份** - 完全依赖配置
2. **真正的验证在远程仓库** - SSH/GPG/2FA
3. **GPG 签名是最可靠的** - 防止伪造
4. **代码审查是最后防线** - PR 流程

**建议：**
1. 使用真实的身份信息
2. 启用 GPG 签名
3. 配置分支保护规则
4. 定期审查提交历史
5. 使用 SSH 密钥进行身份验证

---

## 参考资料

- [Git 官方文档 - 配置](https://git-scm.com/book/en/v2/Customizing-Git-Git-Configuration)
- [Git 官方文档 - 签名提交](https://git-scm.com/book/en/v2/Git-Tools-Signing-Your-Work)
- [GitHub 文档 - GPG 签名](https://docs.github.com/en/authentication/managing-commit-signature-verification)
- [GitLab 文档 - SSH 密钥](https://docs.gitlab.com/ee/user/ssh.html)

---

**最后更新：** 2026-06-23
**作者：** CodeGraph Team
