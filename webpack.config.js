const path = require('path');
const packagejson = require('./package.json');

const dashLibraryName = packagejson.name.replace(/-/g, '_');
const WebpackDashDynamicImport = require('@plotly/webpack-dash-dynamic-import');
const { EsbuildPlugin } = require('esbuild-loader');

// Externalized react/jsx-runtime.
// Newer Dash versions provide window.ReactJSXRuntime for React 19 compatability.
// The fallback keeps this bundle compatible with older Dash versions.
const jsxRuntimeExternal = `var (window.ReactJSXRuntime || (window.ReactJSXRuntime = (function (React) {
    function jsx(type, config, maybeKey) {
        var props = {};
        var children = null;

        if (config != null) {
            if (config.key !== undefined) {
                props.key = '' + config.key;
            }

            for (var propName in config) {
                if (
                    Object.prototype.hasOwnProperty.call(config, propName) &&
                    propName !== 'key' &&
                    propName !== '__self' &&
                    propName !== '__source'
                ) {
                    if (propName === 'children') {
                        children = config[propName];
                    } else {
                        props[propName] = config[propName];
                    }
                }
            }
        }

        if (maybeKey !== undefined) {
            props.key = '' + maybeKey;
        }

        if (children === null || children === undefined) {
            return React.createElement(type, props);
        }

        return Array.isArray(children)
            ? React.createElement.apply(React, [type, props].concat(children))
            : React.createElement(type, props, children);
    }

    return {
        jsx: jsx,
        jsxs: jsx,
        jsxDEV: jsx,
        Fragment: React.Fragment
    };
})(window.React)))`;

module.exports = (env, argv) => {

    let mode;

    const overrides = module.exports || {};

    // if user specified mode flag take that value
    if (argv && argv.mode) {
        mode = argv.mode;
    }

    // else if configuration object is already set (module.exports) use that value
    else if (overrides.mode) {
        mode = overrides.mode;
    }

    // else take webpack default (production)
    else {
        mode = 'production';
    }

    let filename = (overrides.output || {}).filename;
    if(!filename) {
        const modeSuffix = mode === 'development' ? 'dev' : 'min';
        filename = `${dashLibraryName}.${modeSuffix}.js`;
    }

    const entry = overrides.entry || {main: './src/lib/index.js'};

    const devtool = overrides.devtool || 'source-map';

    const externals = ('externals' in overrides) ? overrides.externals : ({
        react: 'React',
        'react-dom': 'ReactDOM',
        'plotly.js': 'Plotly',
        'prop-types': 'PropTypes',
        'react/jsx-runtime': jsxRuntimeExternal,
        'react/jsx-dev-runtime': jsxRuntimeExternal,
    });

    return {
        mode,
        entry,
        output: {
            path: path.resolve(__dirname, dashLibraryName),
            chunkFilename: '[name].js',
            filename,
            library: dashLibraryName,
            libraryTarget: 'window',
        },
        devtool,
        externals,
        module: {
            rules: [
                {
                    exclude: /node_modules/,
                    test: /\.jsx?$/,
                    use: {
                        loader: 'esbuild-loader',
                        options: {
                            // JavaScript version to compile to
                            target: 'es2017',
                            loader: 'jsx'
                        }
                    },
                },
                {
                    test: /\.css$/,
                    use: ['style-loader', 'css-loader'],
                },
            ],
        },
        optimization: {
            minimizer: [
                 new EsbuildPlugin({
                     target: 'es2017'  // Syntax to compile
                  })
            ],
            splitChunks: {
                name: '[name].js',
                cacheGroups: {
                    async: {
                        chunks: 'async',
                        minSize: 0,
                        name(module, chunks, cacheGroupKey) {
                            return `${cacheGroupKey}-${chunks[0].name}`;
                        }
                    }
                }
            }
        },
        plugins: [
            new WebpackDashDynamicImport()
        ]
    }
};
