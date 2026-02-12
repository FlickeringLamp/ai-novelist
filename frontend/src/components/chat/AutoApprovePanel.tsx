import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faAngleRight, faAngleUp } from '@fortawesome/free-solid-svg-icons';

const AutoApprovePanel = () => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="relative flex w-[50%] z-[100] box-border">
      <div 
        className="flex items-center justify-center w-full p-2 bg-theme-black border border-theme-gray1 rounded-small cursor-pointer transition-all min-h-[36px] box-border hover:border-theme-green hover:bg-theme-gray1 gap-1"
        onClick={() => setExpanded(!expanded)}
      >
        <FontAwesomeIcon icon={expanded ? faAngleUp : faAngleRight} className="text-theme-white text-[12px]" />
        <span className="text-theme-white text-[14px] font-medium whitespace-nowrap overflow-hidden text-ellipsis">自动批准已关闭</span>
      </div>
    </div>
  );
};

export default AutoApprovePanel;
