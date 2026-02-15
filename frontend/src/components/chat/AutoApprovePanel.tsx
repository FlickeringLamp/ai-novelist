import { useState } from 'react';

const AutoApprovePanel = () => {
  const [enabled, setEnabled] = useState(false);

  return (
    <div className="relative flex flex-1 box-border items-center justify-center">
      <div
        className="relative group"
        title="自动批准"
      >
        <div
          className={`w-12 h-6 rounded-full cursor-pointer transition-all duration-300 ${
            enabled ? 'bg-theme-green' : 'bg-theme-gray2'
          }`}
          onClick={() => setEnabled(!enabled)}
        >
          <div
            className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-300 shadow-md ${
              enabled ? 'left-7' : 'left-1'
            }`}
          />
        </div>
      </div>
    </div>
  );
};

export default AutoApprovePanel;
