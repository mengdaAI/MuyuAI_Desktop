import { useState } from "react";
import { Group3 } from "../icons/Group3";
import svgPathsTooltip from "../../imports/svg-9mojr1x5i6";

interface HideWindowButtonProps {
  onClick?: () => void;
}

export function HideWindowButton({ onClick }: HideWindowButtonProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div
      className="absolute left-[554px] top-[394px] cursor-pointer"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onClick={onClick}
    >
      <div className="overflow-clip size-[22px]" data-name="Frame">
        <Group3 />
      </div>

      {/* Tooltip - 在按钮右侧，水平居中对齐 */}
      {showTooltip && (
        <div className="absolute left-[42px] top-[-4px] z-[99999]">
          <div className="absolute bg-[rgba(3,0,16,0.9)] h-[30px] left-[6.65px] rounded-[9px] top-0 w-[75.351px]" />
          <div className="absolute flex h-[15.556px] items-center justify-center left-0 top-[6.67px] w-[15.514px]">
            <div className="flex-none rotate-[270deg]">
              <div className="h-[15.514px] relative w-[15.556px]">
                <div className="absolute bottom-1/4 left-[11.41%] right-[11.41%] top-[6.42%]">
                  <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 12 11">
                    <path d={svgPathsTooltip.p9bc04f0} fill="var(--fill-0, #110F28)" id="Polygon 1" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
          <p className="absolute font-['PingFang_SC:Medium',sans-serif] h-[20px] leading-[normal] left-[17px] not-italic text-[14px] text-white top-[5px] w-[57px]">隐藏窗口</p>
        </div>
      )}
    </div>
  );
}

