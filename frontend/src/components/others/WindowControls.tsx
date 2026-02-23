import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMinus, faExpand, faXmark } from '@fortawesome/free-solid-svg-icons';

interface WindowControlsProps {
  className?: string;
}

function WindowControls({ className = '' }: WindowControlsProps) {
  const handleMinimize = () => {
    if (window.electronAPI && window.electronAPI.windowMinimize) {
      window.electronAPI.windowMinimize();
    }
  };

  const handleMaximize = () => {
    if (window.electronAPI && window.electronAPI.windowMaximize) {
      window.electronAPI.windowMaximize();
    }
  };

  const handleClose = () => {
    if (window.electronAPI && window.electronAPI.windowClose) {
      window.electronAPI.windowClose();
    }
  };

  return (
    <div className={`flex items-center ${className}`}>
      <button
        onClick={handleMinimize}
        className="w-[3vw] h-[2vw] flex items-center justify-center hover:bg-theme-gray3 transition-colors"
        title="最小化"
        style={{ WebkitAppRegion: 'no-drag' } as any}
      >
        <FontAwesomeIcon icon={faMinus} />
      </button>
      <button
        onClick={handleMaximize}
        className="w-[3vw] h-[2vw] flex items-center justify-center hover:bg-theme-gray3 transition-colors"
        title="最大化/还原"
        style={{ WebkitAppRegion: 'no-drag' } as any}
      >
        <FontAwesomeIcon icon={faExpand} />
      </button>
      <button
        onClick={handleClose}
        className="w-[3vw] h-[2vw] flex items-center justify-center hover:bg-theme-red transition-colors"
        title="关闭"
        style={{ WebkitAppRegion: 'no-drag' } as any}
      >
        <FontAwesomeIcon icon={faXmark} />
      </button>
    </div>
  );
}

export default WindowControls;
