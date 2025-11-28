import svgPaths from "./svg-7hkh1j06cm";
import imgImage13 from "figma:asset/7c459ec8c39a4498f06e28a46c47eeabf6b8a31b.png";

function Group7() {
  return (
    <div className="absolute contents left-[672px] top-[271px]">
      <div className="absolute bg-[rgba(193,127,255,0.1)] h-[44px] left-[672px] rounded-[12px] top-[271px] w-[385px]">
        <div aria-hidden="true" className="absolute border border-[#c17fff] border-solid inset-0 pointer-events-none rounded-[12px]" />
      </div>
      <p className="absolute font-['PingFang_SC:Regular',sans-serif] leading-[normal] left-[864.5px] not-italic text-[#c17fff] text-[15px] text-center top-[283px] translate-x-[-50%] w-[85px]">XXXXXXXX</p>
    </div>
  );
}

function Group() {
  return (
    <div className="absolute contents left-[672px] top-[271px]">
      <Group7 />
    </div>
  );
}

function Group1() {
  return (
    <div className="absolute contents left-[672px] top-[271px]">
      <Group />
    </div>
  );
}

function Group6() {
  return (
    <div className="absolute contents left-[672px] top-[327px]">
      <div className="absolute bg-[rgba(255,255,255,0.3)] h-[44px] left-[672px] rounded-[22px] top-[327px] w-[385px]" />
      <p className="absolute font-['PingFang_SC:Semibold',sans-serif] h-[20px] leading-[normal] left-[834px] not-italic text-[15px] text-white top-[339px] w-[60px]">开始面试</p>
    </div>
  );
}

function Group2() {
  return (
    <div className="absolute contents left-1/2 top-[105px] translate-x-[-50%]">
      <div className="absolute bg-[rgba(3,0,16,0.7)] h-[311px] left-1/2 rounded-[19px] top-[105px] translate-x-[-50%] w-[455px]">
        <div aria-hidden="true" className="absolute border border-[rgba(255,255,255,0.2)] border-solid inset-0 pointer-events-none rounded-[19px]" />
      </div>
      <Group1 />
      <Group6 />
      <div className="absolute inset-[10.74%_37.77%_87.47%_61.08%]" data-name="Vector">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20 20">
          <path d={svgPaths.p3be22e00} fill="var(--fill-0, white)" fillOpacity="0.2" id="Vector" />
        </svg>
      </div>
    </div>
  );
}

function Group3() {
  return (
    <div className="absolute contents left-[863.5px] top-[223px]">
      <p className="absolute font-['PingFang_SC:Regular',sans-serif] leading-[normal] left-[863.5px] not-italic text-[#c17fff] text-[15px] top-[223px] w-[61.839px]">创建面试</p>
      <div className="absolute flex inset-[20.41%_46.02%_78.69%_53.69%] items-center justify-center">
        <div className="flex-none h-[10px] rotate-[180deg] w-[4.987px]">
          <div className="relative size-full" data-name="Vector">
            <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 5 10">
              <path d={svgPaths.p2640da00} fill="var(--fill-0, #C17FFF)" id="Vector" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

function Group5() {
  return (
    <div className="absolute contents left-[672px] top-[202px]">
      <p className="absolute font-['PingFang_SC:Regular',sans-serif] leading-[normal] left-[672px] not-italic text-[15px] text-white top-[202px] w-[385px]">请在工作台创建面试，获得8位字母数字面试码后下方输入。验证成功后将开启面试。</p>
      <Group3 />
    </div>
  );
}

function Group8() {
  return (
    <div className="absolute contents left-[672px] top-[202px]">
      <Group5 />
    </div>
  );
}

function Group4() {
  return (
    <div className="absolute contents left-1/2 top-[105px] translate-x-[-50%]">
      <Group2 />
      <Group8 />
    </div>
  );
}

function Frame1() {
  return (
    <div className="absolute h-[25.762px] left-[776px] top-[150px] w-[177px]">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 177 26">
        <g id="Frame 1618868608">
          <g id="Frame">
            <path d={svgPaths.p2d759280} fill="var(--fill-0, white)" id="Vector" />
            <path d={svgPaths.p114cea00} fill="var(--fill-0, white)" id="Vector_2" />
            <path d={svgPaths.p315f7640} fill="var(--fill-0, white)" id="Vector_3" />
          </g>
          <g id="å¹è¯­æè¯å¨">
            <path d={svgPaths.p932a200} fill="var(--fill-0, white)" />
            <path d={svgPaths.p7655000} fill="var(--fill-0, white)" />
            <path d={svgPaths.p1cfd3500} fill="var(--fill-0, white)" />
            <path d={svgPaths.p33681900} fill="var(--fill-0, white)" />
            <path d={svgPaths.p35222710} fill="var(--fill-0, white)" />
          </g>
        </g>
      </svg>
    </div>
  );
}

export default function Frame() {
  return (
    <div className="bg-white relative size-full">
      <div className="absolute h-[1117px] left-0 top-0 w-[1728px]" data-name="image 13">
        <img alt="" className="absolute inset-0 max-w-none object-50%-50% object-cover pointer-events-none size-full" src={imgImage13} />
      </div>
      <Group4 />
      <Frame1 />
    </div>
  );
}