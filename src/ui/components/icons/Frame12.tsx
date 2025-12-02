import React from "react";
import svgPaths from "../../imports/svg-apdjujtony";

interface Frame12Props {
  onClick: () => void;
}

export function Frame12({ onClick }: Frame12Props) {
  return (
    <button
      onClick={onClick}
      className="relative overflow-clip size-[20px] cursor-pointer bg-transparent border-none p-0"
      data-name="Frame"
    >
      <div className="absolute left-0 size-[16px] top-0">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16 16">
          <g id="Frame">
            <path d={svgPaths.p35006f00} fill="var(--fill-0, white)" id="Vector" />
          </g>
        </svg>
      </div>
      <div className="absolute left-[-1px] overflow-clip size-[22px] top-[-3px]">
        <div className="absolute left-0 size-[16px] top-0" />
      </div>
    </button>
  );
}

