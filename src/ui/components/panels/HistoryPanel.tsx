export function HistoryPanel() {
  return (
    <>
      {/* 历史对话面板 */}
      <div className="absolute bg-[rgba(194,132,255,0.3)] h-[36px] left-[30px] rounded-br-[10px] rounded-tl-[10px] rounded-tr-[10px] top-[18px] w-[200px]" />
      <p className="absolute font-['PingFang_SC:Regular',sans-serif] leading-[20px] left-[42px] not-italic text-[14px] text-white top-[26px] w-[180px]">你在项目中的职责是什么？</p>
      
      <div className="absolute flex h-[166px] items-center justify-center left-[30px] top-[62px] w-[390px]">
        <div className="flex-none rotate-[180deg] scale-y-[-100%]">
          <div className="bg-[rgba(255,255,255,0.1)] h-[166px] rounded-br-[10px] rounded-tl-[10px] rounded-tr-[10px] w-[390px]" />
        </div>
      </div>
      <p className="absolute font-['PingFang_SC:Regular',sans-serif] leading-[22px] left-[42px] not-italic text-[14px] text-white top-[72px] w-[366px]">在本次项目中，我主要承担了跨团队沟通与资源协调的工作。为了确保进度一致，我会在每个阶段主动同步需求、明确责任，并将复杂信息拆解成易于理解的任务，让设计、研发、运营都能快速对齐。过程中我也会提前预判风险，比如资源冲突、排期延误等，并通过拉群沟通、会同步等方推动问题尽快解决。</p>
      
      <div className="absolute bg-[rgba(194,132,255,0.3)] h-[36px] left-[30px] rounded-br-[10px] rounded-tl-[10px] rounded-tr-[10px] top-[238px] w-[270px]" />
      <p className="absolute font-['PingFang_SC:Regular',sans-serif] leading-[20px] left-[42px] not-italic text-[14px] text-white top-[246px] w-[250px]">在这个过程中遇到的最大困难是什么？</p>
    </>
  );
}

