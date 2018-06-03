import './require-hook';
import { existsSync } from 'fs';
import { resolve } from 'path';
import Koa from 'koa';
import serve from 'koa-static';
import middleware from 'koa-webpack';
import webpack from 'webpack';
import React from 'react';
import ReactDOM from 'react-dom/server';
import { StaticRouter } from 'react-router';
import Helmet from 'react-helmet';
import { Provider } from 'react-redux';
import { createStore } from 'redux';
import serialize from 'serialize-javascript';
import webpackConfig from '../webpack/dev.config.babel';
import App from './components/App';
import test from './reducers';
import { addUser } from './actions';

const IS_DEV = process.env.NODE_ENV === 'local';
const host = 'localhost';
const port = '3000';

const app = new Koa();

if (IS_DEV) {
  const dev = { serverSideRender: true };
  const compiler = webpack(webpackConfig);
  app.use(middleware({ compiler, dev }));
} else {
  app.use(serve(resolve('dist')));
}

const store = createStore(test, {
  users: [{ name: 'Joe'}]
});
store.dispatch(addUser('xxx'));
// store.dispatch(addTodo('Learn about actions'))
// 从 store 中获得初始 state
const preloadedState = store.getState();

app.use(async (ctx) => {
  const getWebpackStats = () => {
    const assetManifest = resolve('./webpack-stats.json');
    if (IS_DEV) {
      return ctx.state.webpackStats.toJson();
    } else if (existsSync(assetManifest)) {
      return require(assetManifest);
    } else {
      throw new Error(`找不到文件：${assetManifest}，请先运行 \`npm run build\``);
    }
  }
  const { publicPath, assetsByChunkName } = getWebpackStats(); // IS_DEV ? ctx.state.webpackStats.toJson() : require('../asset-manifest.json');

  const renderChunks = (extension, chunks) => {
    const getTagByFilename = filename => filename.endsWith('js') ?
      <script src={publicPath + filename} key={filename}></script> :
      <link rel="stylesheet" href={publicPath + filename} key={filename} />;

    return Object.keys(chunks).reduce((context, key) => {
      if (Array.isArray(chunks[key])) {
        chunks[key]
          .filter(item => !/\.hot-update\./.test(item)) // 过滤掉 HMR 包
          .filter(item => item.endsWith(extension))
          .forEach((item) => {
            context.push(getTagByFilename(item));
          });
      } else if (chunks[key].endsWith(extension)) {
        context.push(getTagByFilename(chunks[key]));
      }
      return context;
    }, [])
  };

  // 下面的代码被拆分成两个 renderToString 的原因：
  // 因为 Helmet 服务器端渲染时，需要在 `renderStatic` 之前执行包含 <Helmet/>
  // 组件的 renderToString，
  // 以便于 renderStatic 收集组件中设置的 title 等信息
  const content = ReactDOM.renderToString(
    <Provider store={store} key="provider">
      <StaticRouter location={ctx.url} context={ctx}>
        <App/>
      </StaticRouter>
    </Provider>
  );

  // 收集上一次 renderToString 中组件包含的 helmet 信息
  const helmet = Helmet.renderStatic();
  const htmlAttrs = helmet.htmlAttributes.toComponent();
  const bodyAttrs = helmet.bodyAttributes.toComponent();

  // 此时完整输出整个页面
  const html = ReactDOM.renderToString(
    <html {...htmlAttrs}>
      <head>
        { helmet.title.toComponent() }
        { helmet.meta.toComponent() }
        { helmet.link.toComponent() }
        { renderChunks('css', assetsByChunkName) }
        <script dangerouslySetInnerHTML={{ __html: `window.__INITIAL_STATE__=${serialize(preloadedState)};` }} charSet="UTF-8" />
      </head>
      <body {...bodyAttrs}>
        <div id="app" dangerouslySetInnerHTML={{ __html: content }} />
        <div>{JSON.stringify(assetsByChunkName)}</div>
        { renderChunks('js', assetsByChunkName) }
      </body>
    </html>
  );
  ctx.body = `<!DOCTYPE html>${html}`;
});

app.listen(port, (err) => {
  if (err) {
    console.error(`==> 😭  OMG!!! ${err}`);
  } else {
    console.info(`==> 💻  http://${host}:${port}`);
  }
});
