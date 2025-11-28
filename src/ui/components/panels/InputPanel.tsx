import svgPaths from "../../imports/svg-apdjujtony";

interface InputPanelProps {
  inputValue: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
}

export function InputPanel({ inputValue, onInputChange, onSend }: InputPanelProps) {
  return (
    <>
      {/* 输入框面板状态 */}
      <p className="absolute font-['PingFang_SC:Semibold',sans-serif] leading-[normal] left-[22px] not-italic text-[#999999] text-[14px] top-[76px] w-[295px]">此处将展示生成的回答...</p>
      <div className="absolute bg-[rgba(193,127,255,0.1)] h-[44px] left-[22px] rounded-[14px] top-[16px] w-[414px]">
        <div aria-hidden="true" className="absolute border border-[#c17fff] border-solid inset-0 pointer-events-none rounded-[14px]" />
      </div>
      <div className="absolute flex flex-col font-['PingFang_SC:Regular',sans-serif] h-[22px] justify-center leading-[0] left-[40px] not-italic text-[15px] text-white top-[38px] translate-y-[-50%] w-[340px]">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && inputValue.trim() && onSend()}
          className="bg-transparent border-none outline-none leading-[normal] text-white w-full placeholder:text-white placeholder:opacity-50"
          placeholder="输入你想问的任何问题"
        />
      </div>
      {/* 只在有输入内容时显示发送按钮 */}
      {inputValue.trim() && (
        <button 
          onClick={onSend}
          className="absolute left-[401px] top-[27px] size-[21px] cursor-pointer bg-transparent border-none p-0" 
          data-name="Vector"
        >
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 21 21">
            <path d={svgPaths.p1d306b00} fill="var(--fill-0, #C17FFF)" id="Vector" />
          </svg>
        </button>
      )}
    </>
  );
}

