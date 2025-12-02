import React from "react";
import svgPaths from "../../imports/svg-apdjujtony";

export function Group4() {
  return (
    <div className="h-[393px] w-[524px]">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 524 393">
        <g id="Group 53">
          <g id="Rectangle 1">
            {/* 背景矩形 - 使用更明显的颜色和更高的不透明度 */}
            <path
              d={svgPaths.p2929800}
              fill="#030010"
              fillOpacity="0.85"
            />
            {/* 边框 - 使用更明显的颜色 */}
            <path
              d={svgPaths.p1a204880}
              stroke="rgba(255, 255, 255, 0.15)"
              strokeWidth="1"
              fill="none"
            />
          </g>
          {/* 分隔线 - 使用更明显的颜色 */}
          <line
            id="Line 1"
            stroke="rgba(255, 255, 255, 0.15)"
            strokeWidth="1"
            x1="462.5"
            x2="462.5"
            y1="1"
            y2="392"
          />
        </g>
      </svg>
    </div>
  );
}

