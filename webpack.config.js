require('babel-polyfill');
const webpack = require('webpack');
const path = require('path');

module.exports = {
    entry: {
        'script': './examples/script.js'
    },

    output: {
        filename: '[name].js',
        path: path.join(__dirname, 'public/assets'),
        publicPath: '',
        libraryTarget: 'umd'
    },

    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /node_modules/
            }
        ]
    },

    devServer: {
        contentBase: path.join(__dirname, 'examples')
    }
};
