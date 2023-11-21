const HtmlWebpackPlugin = require('html-webpack-plugin');
const path = require('path');
module.exports={
    entry: './frontend/src/index.js',
    output:{
        path: path.resolve(__dirname, './frontend/dist'),
    },
    mode: 'development',
    module:{
        rules:[{
            test:/\.(js|jsx)$/,
        exclude:/node_modules/,
        use:{
            loader:"babel-loader",
            options:{
                presets: ["@babel/preset-env", "@babel/preset-react"]
            }
        }
    }
        ]
    },
    plugins:[
        new HtmlWebpackPlugin({
            template:'./frontend/src/index.html'
        })]
}