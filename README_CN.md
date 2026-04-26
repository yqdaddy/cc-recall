<p align="center">
  <img src="assets/hero.png" alt="recall">
</p>

# recall

[![CI](https://github.com/yqdaddy/cc-recall/actions/workflows/ci.yml/badge.svg)](https://github.com/yqdaddy/cc-recall/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/yqdaddy/cc-recall/graph/badge.svg)](https://codecov.io/gh/yqdaddy/cc-recall)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Bun](https://img.shields.io/badge/Bun-%23000000.svg?logo=bun&logoColor=white)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

**[English](README.md)** | **[中文](README_CN.md)**

**recall** 是一个 CLI 工具，用于索引 Claude Code 会话记录，支持搜索历史命令和对话内容。

```
"上周那个 docker 命令是什么？"
"我们之前讨论数据库设计时说了什么？"
```

```bash
$ recall search docker --limit 4

[ok] docker build --no-cache --platform linux/amd64 -t myapp:latest .
     构建生产镜像
     1/15/2026, 3:42 PM | ~/projects/myapp

[ok] docker run --rm myapp:test npm run test
     在容器中运行测试
     1/15/2026, 3:45 PM | ~/projects/myapp
```

```bash
$ recall chat search "数据库设计"

[text]
  users 表需要添加 created_at 时间戳列。让我现在添加。
  1/10/2026, 2:30 PM | ~/projects/myapp | session: abc12345...

[thinking]
  迁移脚本需要处理已有数据行，设置默认值...
  1/10/2026, 2:31 PM | ~/projects/myapp | session: abc12345...

2 messages
```

Claude Code 将所有 bash 命令和对话内容存储在 `~/.claude/projects/` 目录下的会话文件中。**recall** 将这些内容索引到 SQLite 数据库，让你可以找到上周的命令、回顾之前的讨论决策，避免重复犯错。

## 功能特点

- **命令搜索** - 按子串或正则搜索 bash 命令，按热度排序
- **对话搜索** - 搜索助手回复和思考内容
- **会话时间线** - 查看完整会话历史（消息 + 命令）
- **智能排序** - 热度算法（频率 + 时间衰减）让常用命令排在前面
- **匹配高亮** - 搜索关键词在终端中高亮显示
- **自动同步** - 搜索前自动更新索引
- **候选提取** - 识别高价值内容供知识库使用

## 安装

```bash
curl -fsSL https://raw.githubusercontent.com/yqdaddy/cc-recall/main/install.sh | bash
```

或使用 Bun：

```bash
bun add -g cc-recall
```

<details>
<summary>其他安装方式</summary>

**手动下载**：从 [releases](https://github.com/yqdaddy/cc-recall/releases) 获取二进制文件

**从源码构建**：
```bash
git clone https://github.com/yqdaddy/cc-recall
cd cc-recall
bun install && bun run build
```
</details>

## 使用方法

### 命令搜索

```bash
# 搜索包含 "docker" 的命令
recall search docker

# 使用正则表达式
recall search "git commit.*fix" --regex

# 按项目目录过滤
recall search npm --cwd ~/projects/myapp

# 按当前目录过滤
recall search npm --here

# 按时间排序（而非热度）
recall search npm --sort time

# 列出最近命令
recall list
recall list --limit 50

# 只显示当前项目的命令
recall list --here

# 手动同步（通常自动执行）
recall sync
recall sync --force  # 强制重建全部索引
```

### 对话搜索

```bash
# 搜索对话内容
recall chat search "部署"

# 只搜索思考内容
recall chat search "架构" --type thinking

# 搜索所有内容类型
recall chat search "error" --type all

# 查看完整会话时间线
recall chat session <session_id>
```

### 候选提取

```bash
# 提取高价值内容供知识库使用
recall ingest --candidates

# 按会话过滤
recall ingest --candidates --session <session_id>

# 设置最低价值分数阈值
recall ingest --candidates --min-score 70

# 输出 JSON 格式（用于脚本/钩子）
recall ingest --candidates --format json
```

## 命令详解

### `recall search <pattern>`

按子串或正则搜索命令历史。

| 参数 | 说明 |
|------|------|
| `--regex`, `-r` | 将搜索模式视为正则表达式 |
| `--cwd <path>` | 按工作目录过滤 |
| `--here`, `-H` | 按当前目录过滤 |
| `--limit`, `-n <N>` | 限制结果数量 |
| `--sort <mode>` | 排序方式：`frecency`（默认）、`time` |
| `--no-sync` | 搜索前跳过自动同步 |

### `recall list`

列出最近命令，默认按热度排序。

| 参数 | 说明 |
|------|------|
| `--limit`, `-n <N>` | 命令数量（默认 20） |
| `--here`, `-H` | 按当前目录过滤 |
| `--sort <mode>` | 排序方式：`frecency`（默认）、`time` |
| `--no-sync` | 列出前跳过自动同步 |

### `recall chat search <pattern>`

搜索对话内容（文本、思考、工具交互）。

| 参数 | 说明 |
|------|------|
| `--type <type>` | 过滤类型：`text`、`thinking`、`all`（默认） |
| `--cwd <path>` | 按工作目录过滤 |

### `recall chat session <session_id>`

查看完整会话时间线，包含所有消息和命令。

### `recall ingest --candidates`

提取高价值内容候选供知识库使用。

| 参数 | 说明 |
|------|------|
| `--session <id>` | 按会话 ID 过滤 |
| `--min-score <N>` | 最低价值分数（默认 50） |
| `--format <format>` | 输出格式：`text`（默认）、`json` |

### `recall sync`

索引 Claude Code 会话中的新命令和消息。

| 参数 | 说明 |
|------|------|
| `--force`, `-f` | 从头重建全部索引 |

## 排序算法

命令按 **热度（Frecency）** 排序：

```
分数 = (1 + log10(频率)) × 时间权重
```

- **频率**：使用 log10 缩放，避免热门命令过度占优
- **时间**：衰减权重（4小时内=100，24小时内=70，7天内=50，30天内=30）

常用且最近的命令排在最前。使用 `--sort time` 可按时间戳排序。

## 价值评分

候选内容按以下规则评分（0-100）：

- **内容类型**：思考内容基础分更高（70）
- **字数**：内容越长分数越高（最高 +30）
- **关键词**：包含 "solve|fix|implement|design|error|important"（+15）

## 工作原理

Claude Code 将对话数据存储在 `~/.claude/projects/` 目录，每个会话是一个 JSONL 文件。

**recall** 扫描这些文件并提取：

- **Bash 工具调用** → `commands` 表
- **助手文本/思考** → `messages` 表
- **高价值内容** → `candidates` 表

所有数据本地存储在 SQLite 数据库 `~/.cc-recall/history.db`。

**自动同步**：`search` 和 `list` 在返回结果前自动同步。使用 `--no-sync` 可加快查询速度。

**隐私保护**：只读、本地存储。不修改 Claude 会话文件，不上传任何数据。

## 数据模型

### commands 表

| 字段 | 说明 |
|------|------|
| `command` | 执行的 bash 命令 |
| `description` | Claude 对命令的说明 |
| `cwd` | 工作目录 |
| `timestamp` | 执行时间 |
| `is_error` | 是否执行失败 |
| `stdout` | 命令输出 |
| `stderr` | 错误输出 |
| `session_id` | 来源会话 |

### messages 表

| 字段 | 说明 |
|------|------|
| `uuid` | 消息唯一 ID |
| `session_id` | 来源会话 |
| `type` | `user` 或 `assistant` |
| `content_type` | `text`、`thinking`、`tool_use`、`tool_result` |
| `content` | 消息内容 |
| `timestamp` | 发送时间 |
| `cwd` | 工作目录 |

### candidates 表

| 字段 | 说明 |
|------|------|
| `session_id` | 来源会话 |
| `content_type` | 内容类型 |
| `content` | 候选内容 |
| `value_score` | 质量分数（0-100） |
| `timestamp` | 提取时间 |

## 常用场景

| 场景 | 命令 |
|------|------|
| 找上次部署命令 | `recall search deploy` |
| 查看当前项目历史 | `recall list --here` |
| 回忆之前的讨论 | `recall chat search "关键词"` |
| 查看失败的命令 | 搜索结果中的 `[error]` 标记 |
| 找特定 git 操作 | `recall search "git push" --cwd ~/projects/myapp` |

## 给 AI Agent 使用

运行 `recall onboard` 将使用说明添加到 `~/.claude/CLAUDE.md`：

```bash
recall onboard
```

这会添加 `recall search`、`recall list` 和 `recall chat search` 的使用指南。

### 何时使用 recall

- 用户问"之前/上周做了什么命令"
- 用户问"上次怎么部署/配置的"
- 用户想回忆之前的讨论决策

### 何时不使用 recall

- 查找文件 → 用 `Glob`
- 搜索文件内容 → 用 `Grep`
- 查看当前对话 → 已在上下文中

## SessionEnd 钩子集成

在 Claude Code 的 SessionEnd 钩子中使用 `recall ingest --candidates --format json`：

```bash
#!/bin/bash
SESSION_ID="${CLAUDE_SESSION_ID:-}"
recall ingest --candidates --session "$SESSION_ID" --min-score 50 --format json
```

输出格式：

```json
{
  "hookSpecificOutput": {
    "hookEventName": "RecallCandidates",
    "candidates": [
      {
        "type": "thinking",
        "content": "...",
        "score": 75,
        "session": "..."
      }
    ]
  }
}
```

## 开发

```bash
bun install
bun run src/index.ts search docker
bun run src/index.ts chat search "deployment"
bun test
bun test --coverage
bun run build
```

## 关于名字

**recall** - Claude Code 历史回溯。搜索和检索过去的命令与对话。

---

MIT License