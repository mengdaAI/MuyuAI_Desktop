import { useState, useCallback, useEffect } from "react";
import svgPathsSettings from "../../imports/svg-fg17hkisy3";

interface SettingsPanelProps {
  onClose: () => void;
  onExitInterview: () => void;
}

export function SettingsPanel({ onClose, onExitInterview }: SettingsPanelProps) {
  const [isContentProtectionOn, setIsContentProtectionOn] = useState(false);

  // 初始化时获取当前状态
  useEffect(() => {
    const settingsApi = (window as any).api?.settingsView;
    if (settingsApi?.getContentProtectionStatus) {
      settingsApi.getContentProtectionStatus().then((status: boolean) => {
        setIsContentProtectionOn(status);
      });
    }
  }, []);

  const handleToggleInvisibility = useCallback(async () => {
    console.log('Toggle Invisibility clicked');
    const settingsApi = (window as any).api?.settingsView;
    if (settingsApi?.toggleContentProtection) {
      const newStatus = await settingsApi.toggleContentProtection();
      setIsContentProtectionOn(newStatus);
    }
  }, []);
  return (
    <div className="absolute h-[393px] left-[530px] top-0 w-[298px] z-[10000]" style={{ transition: 'none' }}>
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 298 393">
        <g id="Rectangle 3">
          <path d={svgPathsSettings.p3ef3cc80} fill="#030010" fillOpacity="0.75" />
          <path d={svgPathsSettings.p3b41a00} stroke="white" strokeOpacity="0.2" />
        </g>
      </svg>

      {/* 关闭按钮 */}
      <button
        onClick={onClose}
        className="absolute left-[268px] top-[16px] size-[20px] cursor-pointer bg-transparent border-none p-0"
      >
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20 20">
          <path d={svgPathsSettings.p3be22e00} fill="var(--fill-0, white)" fillOpacity="0.2" />
        </svg>
      </button>

      {/* 幕语提词器 Logo */}
      <div className="absolute h-[17.029px] left-[92px] top-[16px] w-[117px]">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 117 18">
          <g id="Frame 1618868608">
            <g clipPath="url(#clip0_34_1358)" id="Frame">
              <path d={svgPathsSettings.pdfa9d30} fill="var(--fill-0, white)" />
              <path d={svgPathsSettings.p263c0c80} fill="var(--fill-0, white)" />
              <path d={svgPathsSettings.p1e44ca00} fill="var(--fill-0, white)" />
            </g>
            <g id="幕语提词器">
              <path d={svgPathsSettings.p1ec58f80} fill="var(--fill-0, white)" />
              <path d={svgPathsSettings.p268e4aa0} fill="var(--fill-0, white)" />
              <path d={svgPathsSettings.p36870500} fill="var(--fill-0, white)" />
              <path d={svgPathsSettings.p4388300} fill="var(--fill-0, white)" />
              <path d={svgPathsSettings.p4b75e00} fill="var(--fill-0, white)" />
            </g>
          </g>
          <defs>
            <clipPath id="clip0_34_1358">
              <rect fill="white" height="16.7736" transform="matrix(-1 -8.74228e-08 -8.74228e-08 1 23.1638 0.127728)" width="23.1636" />
            </clipPath>
          </defs>
        </svg>
      </div>

      {/* 快捷键标题 */}
      <p className="absolute font-['PingFang_SC:Semibold',sans-serif] leading-[normal] left-[16px] not-italic text-[#999999] text-[14px] top-[53px] w-[76px]">快捷键</p>

      {/* 四个快捷键项 */}
      <p className="absolute font-['PingFang_SC:Regular',sans-serif] leading-[26px] left-[16px] not-italic text-[14px] text-white top-[86px] w-[144px]">展示/隐藏整个窗口</p>
      <p className="absolute font-['PingFang_SC:Semibold',sans-serif] leading-[26px] left-[227px] not-italic text-[14px] text-white top-[86px] w-[51px]">Cmd+\</p>

      <p className="absolute font-['PingFang_SC:Regular',sans-serif] leading-[26px] left-[16px] not-italic text-[14px] text-white top-[118px] w-[144px]">展示/隐藏提问面板</p>
      <p className="absolute font-['PingFang_SC:Semibold',sans-serif] leading-[26px] left-[226px] not-italic text-[14px] text-white top-[118px] w-[51px]">Cmd+\</p>

      <p className="absolute font-['PingFang_SC:Regular',sans-serif] leading-[26px] left-[16px] not-italic text-[14px] text-white top-[152px] w-[144px]">展示/隐藏截图面板</p>
      <p className="absolute font-['PingFang_SC:Semibold',sans-serif] leading-[26px] left-[226px] not-italic text-[14px] text-white top-[152px] w-[51px]">Cmd+\</p>

      <p className="absolute font-['PingFang_SC:Regular',sans-serif] leading-[26px] left-[16px] not-italic text-[14px] text-white top-[186px] w-[144px]">展示/隐藏对话面板</p>
      <p className="absolute font-['PingFang_SC:Semibold',sans-serif] leading-[26px] left-[226px] not-italic text-[14px] text-white top-[186px] w-[51px]">Cmd+\</p>
      
      {/* Disable Invisibility 按钮 */}
      <button 
        onClick={handleToggleInvisibility}
        className="absolute h-[39px] left-[16px] rounded-[22px] top-[240px] w-[266px] flex items-center justify-center border border-solid cursor-pointer transition-colors"
        style={{
          backgroundColor: isContentProtectionOn ? 'rgba(193,127,255,0.15)' : 'rgba(100,100,100,0.15)',
          borderColor: isContentProtectionOn ? '#c17fff' : '#666666'
        }}
      >
        <span 
          className="font-['PingFang_SC:Semibold',sans-serif] not-italic text-[15px]"
          style={{ color: isContentProtectionOn ? '#c17fff' : '#999999' }}
        >
          {isContentProtectionOn ? '隐身模式已开启' : '隐身模式已关闭'}
        </span>
      </button>
      
      {/* 退出面试按钮 */}
      <button
        onClick={onExitInterview}
        className="absolute bg-[rgba(187,46,48,0.15)] h-[39px] left-[96px] rounded-[22px] top-[334px] w-[109px] flex items-center justify-center border border-[#bb0003] border-solid cursor-pointer hover:bg-[rgba(187,46,48,0.25)] transition-colors"
      >
        <span className="font-['PingFang_SC:Semibold',sans-serif] not-italic text-[#d10003] text-[15px]">退出面试</span>
      </button>
    </div>
  );
}

