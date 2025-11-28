interface RecordingButtonProps {
  isRecording: boolean;
  onClick: () => void;
}

export function RecordingButton({ isRecording, onClick }: RecordingButtonProps) {
  return (
    <button 
      onClick={onClick}
      className="absolute left-[546px] top-[94px] size-[36px] rounded-[19.5px] cursor-pointer transition-colors flex items-center justify-center"
      style={{
        backgroundColor: isRecording ? 'rgba(222,145,255,0.2)' : 'rgba(193,127,255,0.15)',
        border: '1px solid #c17fff'
      }}
    >
      {isRecording ? (
        // 等待状态 - 方块
        <div className="bg-[#c17fff] rounded-[3px] size-[12px]" />
      ) : (
        // 回答状态 - 三条竖线
        <div className="relative w-[12px] h-[15.273px]">
          <div className="bg-[#c17fff] h-[15.273px] absolute left-[4.8px] rounded-[2px] top-0 w-[2.4px]" />
          <div className="bg-[#c17fff] h-[10.573px] absolute left-0 rounded-[2px] top-[2.35px] w-[2.4px]" />
          <div className="bg-[#c17fff] h-[10.573px] absolute left-[9.6px] rounded-[2px] top-[2.35px] w-[2.4px]" />
        </div>
      )}
    </button>
  );
}

