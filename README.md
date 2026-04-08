# insider-killer-web

内幕杀手网站版源码。

这个仓库只包含网站前端和本地 API 聚合服务，不包含 SDK 打包和 npm 发布逻辑。

## 技术栈

- React
- Vite
- Python 本地 API 聚合层

## 本地运行

```bash
git clone <your-repo-url>
cd insider-killer-web
npm install
npm run dev
```

默认启动：

- 前端：`http://localhost:5173`
- 本地 API：`http://127.0.0.1:8787`

## 构建

```bash
npm run build
```

## 生产启动

```bash
npm start
```

## 项目结构

- `src/` 前端页面与逻辑
- `public/` 静态资源
- `server.py` 本地 API 聚合与静态资源服务
- `vite.config.ts` 前端开发配置
