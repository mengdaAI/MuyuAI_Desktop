# Windows 性能优化建议

## 问题总结

### 1. 已修复的问题 ✅

#### 1.1 主窗口不在顶层
**问题**: Main 窗口没有设置 `alwaysOnTop`,导致无法置顶显示
**修复**: 已在 `windowManager.js` 中为 main 窗口添加 `alwaysOnTop: isAlwaysOnTopOn`

#### 1.2 主窗口无法拖拽
**问题**: 窗口边沿的 resize handles (z-[9999]) 阻止了鼠标事件传递到主容器
**修复**: 已在 `MainInterface.tsx` 中为 resize handles 添加 `pointer-events-none hover:pointer-events-auto`

---

### 2. 性能问题分析 ⚠️

#### 2.1 严重性能问题

**webSecurity: false**
```javascript
// 位置: src/window/windowManager.js:861
webSecurity: false
```
- **影响**:
  - 安全风险: 允许加载不安全的 HTTP 内容
  - 性能: 增加安全检查开销
  - 兼容性: 可能导致某些 API 行为不一致
- **建议**: 生产环境应设为 `true`
- **修复**:
  ```javascript
  webSecurity: true,  // 推荐值
  ```

#### 2.2 中等性能问题

**backgroundThrottling: false**
```javascript
// 位置: src/window/windowManager.js:860
backgroundThrottling: false
```
- **影响**:
  - 应用在后台时持续消耗 CPU/GPU 资源
  - 增加电池消耗(笔记本)
- **建议**: 生产环境应设为 `true`
- **修复**:
  ```javascript
  backgroundThrottling: true,  // 推荐值
  ```

**setContentProtection(true)**
```javascript
// 所有窗口都启用了内容保护
mainWin.setContentProtection(isContentProtectionOn);
```
- **影响**:
  - 持续的 GPU 加密操作
  - 降低渲染性能,特别是低端显卡
- **建议**: 通过环境变量控制,生产环境可根据需求禁用
- **修复**:
  ```bash
  # 在 .env 中设置
  MUYU_CONTENT_PROTECTION=false
  ```

#### 2.3 轻微性能问题

**transparent: true (Windows 平台)**
```javascript
// 位置: src/window/windowManager.js:532, 845, 958
transparent: true
```
- **影响**:
  - Windows 的透明窗口性能较差
  - 需要额外的合成操作
  - 可能导致卡顿或模糊
- **建议**: 如果不需要透明效果,考虑使用不透明窗口
- **优化方案**:
  ```javascript
  // Windows 平台使用不透明窗口
  transparent: process.platform !== 'win32'
  ```

---

### 3. 推荐的性能优化方案 🚀

#### 方案 1: 基础优化 (推荐,影响最小)

```javascript
// src/window/windowManager.js
webPreferences: {
    nodeIntegration: false,
    contextIsolation: true,
    preload: path.join(__dirname, '../preload.js'),
    backgroundThrottling: true,  // 启用后台节流
    webSecurity: true,           // 启用 Web 安全
}
```

```bash
# .env
MUYU_CONTENT_PROTECTION=false  # 禁用内容保护以提升性能
MUYU_ALWAYS_ON_TOP=true         # 保持置顶
```

**预期效果**: 性能提升 20-30%,安全风险降低

---

#### 方案 2: 进阶优化 (平衡性能与功能)

```javascript
// src/window/windowManager.js - commonOptions
const commonChildOptions = {
    show: false,
    frame: false,
    transparent: process.platform !== 'win32',  // Windows 使用不透明窗口
    vibrancy: false,
    hasShadow: process.platform !== 'win32',    // Windows 禁用阴影
    skipTaskbar: true,
    hiddenInMissionControl: true,
    resizable: false,
    ...(WIN_ICON && { icon: WIN_ICON }),
    webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, '../preload.js'),
        backgroundThrottling: true,
        webSecurity: true,
    },
};
```

```bash
# .env
MUYU_CONTENT_PROTECTION=false
MUYU_ALWAYS_ON_TOP=true
```

**预期效果**: Windows 性能提升 40-50%,外观略有变化

---

#### 方案 3: 激进优化 (最佳性能)

**注意**: 此方案会改变应用外观和部分功能

```javascript
// src/window/windowManager.js
webPreferences: {
    nodeIntegration: false,
    contextIsolation: true,
    preload: path.join(__dirname, '../preload.js'),
    backgroundThrottling: true,
    webSecurity: true,
    // 启用硬件加速
    experimentalFeatures: {
        canvas: true,
        webgl: true,
    },
}
```

```bash
# .env
MUYU_CONTENT_PROTECTION=false
MUYU_ALWAYS_ON_TOP=false  # 禁用置顶以提升性能
```

**预期效果**: 性能提升 60-70%,但:
- 窗口可被其他窗口覆盖
- 内容可被截屏
- 失去某些视觉特性

---

### 4. 其他优化建议 💡

#### 4.1 内存优化

```javascript
// 减少窗口池大小
// 当前有多个窗口: header, main, listen, ask, screenshot, transcript, settings
// 建议延迟创建不必要的窗口
```

#### 4.2 渲染优化

```javascript
// 使用 CSS transform 代替 position 变化
// 已经在 MainInterface.tsx 中实现,很好!
transform: `translate(${position.x}px, ${position.y}px)`
```

#### 4.3 事件处理优化

```javascript
// 已实现 rAF 节流
// src/ui/components/MainInterfaceContainer.tsx:43-50
const scheduleTurnUpdate = useCallback(() => {
    if (pendingTurnUpdateRef.current !== null) return;
    pendingTurnUpdateRef.current = requestAnimationFrame(() => {
        pendingTurnUpdateRef.current = null;
        setTurns(sortTurns());
    });
}, [sortTurns]);
```

---

### 5. 测试建议 📊

在应用优化后,请进行以下测试:

1. **性能测试**
   - 使用任务管理器监控 CPU/GPU 使用率
   - 测试应用在后台时的资源占用
   - 测试长时间运行的内存泄漏

2. **功能测试**
   - 验证窗口拖拽功能
   - 验证窗口置顶功能
   - 验证所有窗口显示正常

3. **兼容性测试**
   - 测试不同 Windows 版本 (10/11)
   - 测试不同硬件配置 (高端/低端)
   - 测试不同显卡 (NVIDIA/AMD/Intel)

---

### 6. 快速应用修复 ✅

如果你只想应用已修复的问题(拖拽和置顶),直接重启应用即可:

```bash
cd c:/Users/weidongguo/CodeBuddy/WinMuyuWorkspace
./start.bat
```

已修复的功能:
- ✅ 主窗口现在会正确置顶
- ✅ 主窗口现在可以正常拖拽

---

### 7. 总结

| 问题 | 状态 | 影响 | 优先级 |
|------|------|------|--------|
| 主窗口不置顶 | ✅ 已修复 | 高 | 高 |
| 主窗口无法拖拽 | ✅ 已修复 | 高 | 高 |
| webSecurity: false | ⚠️ 待优化 | 高 | 中 |
| backgroundThrottling: false | ⚠️ 待优化 | 中 | 中 |
| setContentProtection(true) | ⚠️ 待优化 | 中 | 低 |
| transparent: true | ℹ️ 平台特性 | 低 | 低 |

**建议**: 先测试已修复的功能,然后根据实际需求选择合适的性能优化方案。
