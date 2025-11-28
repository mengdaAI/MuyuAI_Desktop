interface ScreenshotPanelProps {
  showAnswer: boolean;
  onAnswer: () => void;
}

export function ScreenshotPanel({ showAnswer, onAnswer }: ScreenshotPanelProps) {
  return (
    <>
      {/* 截图面板状态 */}
      {!showAnswer ? (
        <>
          <button 
            onClick={onAnswer}
            className="absolute bg-[rgba(193,127,255,0.15)] h-[39px] left-[180px] rounded-[22px] top-[16px] w-[98px] flex items-center justify-center border border-[#c17fff] border-solid cursor-pointer hover:bg-[rgba(193,127,255,0.25)] transition-colors"
          >
            <span className="font-['PingFang_SC:Semibold',sans-serif] not-italic text-[#c17fff] text-[16px]">截屏回答</span>
          </button>
          
          <p className="absolute font-['PingFang_SC:Semibold',sans-serif] leading-[normal] left-[22px] not-italic text-[#999999] text-[14px] top-[71px] w-[295px]">此处将展示生成的回答...</p>
        </>
      ) : (
        <>
          {/* 显示截屏回答内容 */}
          <button 
            className="absolute bg-[rgba(193,127,255,0.15)] h-[39px] left-[180px] rounded-[22px] top-[16px] w-[98px] flex items-center justify-center border border-[#c17fff] border-solid cursor-default"
          >
            <span className="font-['PingFang_SC:Semibold',sans-serif] not-italic text-[#c17fff] text-[16px]">截屏回答</span>
          </button>
          
          <p className="absolute font-['PingFang_SC:Semibold',sans-serif] leading-[normal] left-[22px] not-italic text-[#999999] text-[14px] top-[71px] w-[295px]">AI回答</p>
          <p className="absolute font-['PingFang_SC:Regular',sans-serif] leading-[26px] left-[22px] not-italic text-[16px] text-white top-[96px] w-[414px]">
            在本次项目中，我主要承担了跨团队沟通与资源协调的工作。为了确保进度一致，我会在每个阶段主动同步需求、明确责任，并将复杂信息拆解成易于理解的任务，让设计、研发、运营都能快速对齐。过程中我也会提前预判风险，比如资源冲突、排期延误等，并通过拉群沟通、短会同步等方式推动问题尽快解决。
          </p>
        </>
      )}
    </>
  );
}

