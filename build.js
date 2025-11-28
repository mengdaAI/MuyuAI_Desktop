const esbuild = require('esbuild');
const path = require('path');
const { execSync } = require('child_process');
const fs = require('fs');

const baseConfig = {
    bundle: true,
    platform: 'browser',
    format: 'esm',
    loader: { 
        '.js': 'jsx',
        '.ts': 'tsx',
        '.tsx': 'tsx',
    },
    sourcemap: true,
    external: ['electron'],
    define: {
        'process.env.NODE_ENV': `"${process.env.NODE_ENV || 'development'}"`,
    },
    jsx: 'automatic', // 使用新的 JSX 转换
};

const entryPoints = [
    { in: 'src/ui/app/headerApp.tsx', out: 'public/build/header' },
    { in: 'src/ui/app/MuyuApp.js', out: 'public/build/content' },
];

// 确保 public/build 目录存在
if (!fs.existsSync('public/build')) {
    fs.mkdirSync('public/build', { recursive: true });
}

async function buildTailwind() {
    try {
        console.log('Building Tailwind CSS...');
        // 使用 tailwindcss 的 Node.js API
        const tailwindcss = require('tailwindcss');
        const postcss = require('postcss');
        const fs = require('fs');
        
        const inputPath = path.join(__dirname, 'src/ui/styles/tailwind.css');
        const outputPath = path.join(__dirname, 'public/build/tailwind.css');
        const input = fs.readFileSync(inputPath, 'utf8');
        
        const result = await postcss([
            tailwindcss(require('./tailwind.config.js')),
            require('autoprefixer')
        ]).process(input, { from: inputPath, to: outputPath });
        
        fs.writeFileSync(outputPath, result.css);
        console.log('✅ Tailwind CSS build successful!');
    } catch (e) {
        console.warn('⚠️  Tailwind CSS build failed, continuing without it:', e.message);
    }
}

async function build() {
    try {
        // 先构建 Tailwind CSS
        await buildTailwind();
        
        console.log('Building renderer process code...');
        await Promise.all(entryPoints.map(point => esbuild.build({
            ...baseConfig,
            entryPoints: [point.in],
            outfile: `${point.out}.js`,
        })));
        console.log('✅ Renderer builds successful!');
    } catch (e) {
        console.error('Renderer build failed:', e);
        process.exit(1);
    }
}

async function watch() {
    try {
        // 先构建一次 Tailwind CSS
        await buildTailwind();
        
        const contexts = await Promise.all(entryPoints.map(point => esbuild.context({
            ...baseConfig,
            entryPoints: [point.in],
            outfile: `${point.out}.js`,
        })));

        console.log('Watching for changes...');
        
        // 监听 Tailwind CSS 文件变化
        const chokidar = require('chokidar');
        const tailwindWatcher = chokidar.watch('src/ui/**/*.{js,jsx,ts,tsx,html}', {
            ignored: /node_modules/,
            persistent: true
        });
        
        tailwindWatcher.on('change', async () => {
            console.log('Files changed, rebuilding Tailwind CSS...');
            await buildTailwind();
        });
        
        await Promise.all(contexts.map(context => context.watch()));

    } catch (e) {
        console.error('Watch mode failed:', e);
        process.exit(1);
    }
}

if (process.argv.includes('--watch')) {
    watch();
} else {
    build();
} 