const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: './src/game.ts',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
    publicPath: '/'
  },
  module: {
    rules: [
      { test: /face-api.esm.js/, type: 'javascript/esm' },
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/
      },
      {
        test: /\.tflite$/,
        use: [
          {
            loader: 'file-loader',
            options: {
              outputPath: 'models',
              name: '[name].[ext]',
            },
          },
        ],
      },
      {
        test: /\.(json|bin)$/,
        type: 'asset/resource',
        generator: {
          filename: 'models/[name][ext]'
        }
      }
    ]
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/index.html'
    }),
    new CopyWebpackPlugin({
      patterns: [
        { from: 'public/models', to: 'models' }
      ]
    })
  ],
  devServer: {
    static: {
      directory: path.join(__dirname, 'dist'),
    },
    host: 'localhost',
    port: 3000,
    hot: true,
    open: true,
    historyApiFallback: true
  },
  devtool: 'inline-source-map'
};
