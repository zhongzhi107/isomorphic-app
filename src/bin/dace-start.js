const fs = require('fs');
const cp = require('child_process');
const program = require('commander');
const chalk = require('chalk');
const webpack = require('webpack');
const DevServer = require('webpack-dev-server-speedy');
const clearConsole = require('react-dev-utils/clearConsole');
const logger = require('../utils/logger');
const paths = require('../webpack/config/paths');
const createConfig = require('../webpack/config/createConfig');
const setPorts = require('../utils/setPorts');

program
  .option('-v, --verbose', '显示详细日志信息')
  .option('-V, --visualizer', '启用 webpack-visualizer 打包分析工具')
  .parse(process.argv);

// 启动模拟数据服务器
cp.exec('node_modules/.bin/dace mock');

process.noDeprecation = true; // 关闭告警信息，避免对进度条显示产生干扰

process.env.NODE_ENV = 'local';

// 捕获 webpack 执行过程中的错误
function compile(config) {
  let compiler;
  try {
    compiler = webpack(config);
  } catch (e) {
    console.error('Failed to compile.', e);
    process.exit(1);
  }
  return compiler;
}

function main() {
  logger.start('Compiling...');

  let dace = {};

  if (fs.existsSync(paths.appDaceConfig)) {
    try {
      dace = require(paths.appDaceConfig);
    } catch (e) {
      clearConsole();
      logger.error('Invalid dace.config.js file.', e);
      process.exit(1);
    }
  }

  const clientConfig = createConfig({ webpack, dace, target: 'web', isDev: true, program });
  const serverConfig = createConfig({ webpack, dace, target: 'node', isDev: true, program });

  // Compile our assets with webpack
  const clientCompiler = compile(clientConfig);
  const serverCompiler = compile(serverConfig);

  // 在确保浏览器端编译成功后再启动服务器端编译
  clientCompiler.plugin('done', (stats) => {
    if (stats.compilation.errors.length === 0) {
      if (program.visualizer) {
        const file = `${paths.appClientBuild}/stats.html`;
        const message = `\`webpack visualizer\` has been generated.\nOpen it ${chalk.underline(`open file://${file}`)}`;
        logger.info(message);
      }

      serverCompiler.watch({
        quiet: true,
        stats: 'none'
      }, () => {});
    }
  });

  // Create a new instance of Webpack-dev-server for our client assets.
  // This will actually run on a different port than the users app.
  const clientDevServer = new DevServer(clientCompiler, clientConfig.devServer);

  // Start Webpack-dev-server
  const devPort = (process.env.DACE_PORT && parseInt(process.env.DACE_PORT, 10) + 1) || 3001;
  clientDevServer.listen(devPort, (err) => {
    if (err) {
      logger.error(err);
    }
  });
}

// 确保服务端口可用
setPorts()
  .then(main)
  .catch(console.error);
