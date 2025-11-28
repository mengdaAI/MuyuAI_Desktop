import React from 'react';
import { createRoot } from 'react-dom/client';
import { HeaderController } from './HeaderControllerReact';

// 导入 Web Components（暂时保留，用于 apikey、permission、main header）
import './ApiKeyHeader.js';
import './PermissionHeader.js';
import './MainHeader.js';

// 扩展 Window 接口
declare global {
    interface Window {
        __interviewStartTimestamp?: number;
    }
}

function App() {
    const containerRef = React.useRef<HTMLDivElement>(null);

    return (
        <div id="header-container" ref={containerRef} style={{ width: '100%', height: '100%' }}>
            <HeaderController containerRef={containerRef} />
        </div>
    );
}

// 初始化 React 应用
window.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('header-container');
    if (!container) {
        console.error('[HeaderApp] Container not found');
        return;
    }

    const root = createRoot(container);
    root.render(React.createElement(App));

    // 处理 glass 参数
    const params = new URLSearchParams(window.location.search);
    if (params.get('glass') === 'true') {
        document.body.classList.add('has-glass');
    }
});

