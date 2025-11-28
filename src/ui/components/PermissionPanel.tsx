import React, { useState, useEffect } from "react";
import svgPathsPermission from "../imports/svg-nskm8ew5pp";
import svgPathsStartup from "../imports/svg-7hkh1j06cm";
import { MuyuLogo } from "./MuyuLogo";

interface PermissionPanelProps {
  onComplete: () => void;
  onClose: () => void;
}

export default function PermissionPanel({ onComplete, onClose }: PermissionPanelProps) {
  const [micPermission, setMicPermission] = useState(false);
  const [screenPermission, setScreenPermission] = useState(false);

  const handleMicPermission = () => {
    setMicPermission(true);
  };

  const handleScreenPermission = () => {
    setScreenPermission(true);
  };

  // 检查是否可以开始
  const canStart = micPermission && screenPermission;

  // 当两个权限都开启后,自动跳转到主界面
  useEffect(() => {
    if (canStart) {
      // 延迟 500ms 让用户看到"已开启"状态,然后自动跳转
      const timer = setTimeout(() => {
        onComplete();
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [canStart, onComplete]);

  return (
    <div className="absolute h-[308px] left-1/2 top-[106px] translate-x-[-50%] w-[455px]">
      {/* 背景 */}
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 455 308">
        <g id="Group 3">
          <g id="Rectangle 1">
            <rect fill="var(--fill-0, #030010)" fillOpacity="0.7" height="308" rx="19" width="455" />
            <rect height="307" rx="18.5" stroke={canStart ? "var(--stroke-0, #C17FFF)" : "var(--stroke-0, white)"} strokeOpacity="0.2" width="454" x="0.5" y="0.5" />
          </g>
        </g>
      </svg>

      {/* 关闭按钮 */}
      <button
        onClick={onClose}
        className="absolute left-[425px] top-[12px] size-[20px] cursor-pointer bg-transparent border-none p-0 z-10"
      >
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20 20">
          <path d={svgPathsStartup.p3be22e00} fill="var(--fill-0, white)" fillOpacity="0.2" />
        </svg>
      </button>

      {/* Logo */}
      <MuyuLogo svgPaths={svgPathsPermission} />

      {/* 说明文字 */}
      <p className="absolute font-['PingFang_SC:Regular',sans-serif] h-[21px] leading-[normal] left-[48px] not-italic text-[15px] text-white top-[88px] w-[360px]">
        请为幕语提词器开启麦克风与屏幕获取权限后开始使用
      </p>

      {/* 麦克风权限 */}
      <div className="absolute left-[35px] top-[152px] flex items-center h-[39px]">
        {/* 麦克风图标 */}
        <div className="size-[35px] flex items-center justify-center">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 35 35">
            <g id="Frame">
              <path d={svgPathsPermission.p28290880} fill="var(--fill-0, white)" fillOpacity="0.8" />
              <path d={svgPathsPermission.p3e227e00} fill="var(--fill-0, white)" fillOpacity="0.8" />
              <path d={svgPathsPermission.p72a380} fill="var(--fill-0, white)" fillOpacity="0.8" />
            </g>
          </svg>
        </div>

        {/* 麦克风文字 */}
        <p className="font-['PingFang_SC:Semibold',sans-serif] leading-[normal] ml-[6px] not-italic text-[18px] text-white">
          麦克风
        </p>

        {/* 麦克风按钮 */}
        <button
          onClick={micPermission ? undefined : handleMicPermission}
          disabled={micPermission}
          className={`absolute h-[39px] left-[276px] rounded-[22px] top-0 w-[109px] flex items-center justify-center border border-solid ${micPermission ? 'cursor-default' : 'cursor-pointer hover:bg-[rgba(193,127,255,0.25)]'
            } transition-colors`}
          style={{
            backgroundColor: 'rgba(193,127,255,0.15)',
            borderColor: micPermission ? 'rgba(193,127,255,0.4)' : '#c17fff'
          }}
        >
          <span
            className="font-['PingFang_SC:Semibold',sans-serif] not-italic text-[15px]"
            style={{
              color: micPermission ? 'rgba(220,185,255,0.4)' : '#dcb9ff'
            }}
          >
            {micPermission ? '已开启' : '开启权限'}
          </span>
        </button>
      </div>

      {/* 屏幕权限 */}
      <div className="absolute left-[35px] top-[216px] flex items-center h-[39px]">
        {/* 屏幕图标 */}
        <div className="w-[35px] h-[35px] flex items-center justify-center">
          <svg className="block w-[20px] h-[20px]" fill="none" preserveAspectRatio="none" viewBox="0 0 20 20">
            <path d={svgPathsPermission.pc2bf780} fill="var(--fill-0, white)" fillOpacity="0.8" />
          </svg>
        </div>

        {/* 屏幕文字 */}
        <p className="font-['PingFang_SC:Semibold',sans-serif] leading-[normal] ml-[6px] not-italic text-[18px] text-white">
          屏幕
        </p>

        {/* 屏幕按钮 */}
        <button
          onClick={screenPermission ? undefined : handleScreenPermission}
          disabled={screenPermission}
          className={`absolute h-[39px] left-[276px] rounded-[22px] top-0 w-[109px] flex items-center justify-center border border-solid ${screenPermission ? 'cursor-default' : 'cursor-pointer hover:bg-[rgba(193,127,255,0.25)]'
            } transition-colors`}
          style={{
            backgroundColor: 'rgba(193,127,255,0.15)',
            borderColor: screenPermission ? 'rgba(193,127,255,0.4)' : '#c17fff'
          }}
        >
          <span
            className="font-['PingFang_SC:Semibold',sans-serif] not-italic text-[15px]"
            style={{
              color: screenPermission ? 'rgba(220,185,255,0.4)' : '#dcb9ff'
            }}
          >
            {screenPermission ? '已开启' : '开启权限'}
          </span>
        </button>
      </div>
    </div>
  );
}