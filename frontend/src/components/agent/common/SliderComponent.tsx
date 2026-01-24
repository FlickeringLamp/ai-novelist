import { useEffect, useRef } from 'react';

/**
 * 统一的滑动条组件
 * 支持自定义范围、步长、标签和描述
 */
interface SliderComponentProps {
  label?: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange?: (value: number) => void;
  description?: string;
  className?: string;
  showValue?: boolean;
  valueFormatter?: (val: number) => string | number;
  type?: 'default' | 'parameter' | 'context';
}

const SliderComponent = ({
  label,
  value,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  description,
  className = '',
  showValue = true,
  valueFormatter = (val: number) => val,
  type = 'default' // 'default' | 'parameter' | 'context'
}: SliderComponentProps) => {
  const sliderRef = useRef<HTMLInputElement>(null);

  // 更新滑动条进度样式
  useEffect(() => {
    const updateSliderProgress = () => {
      if (sliderRef.current) {
        const slider = sliderRef.current;
        const progress = ((value - min) / (max - min)) * 100;
        slider.style.setProperty('--slider-progress', `${progress}%`);
      }
    };

    updateSliderProgress();
  }, [value, min, max]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(e.target.value);
    if (onChange) {
      onChange(newValue);
    }
  };

  return (
    <div className={`mb-5 ${className}`}>
      {label && (
        <label className="block mb-2 font-medium text-theme-white">
          {label}
        </label>
      )}

      <div className="flex items-center gap-4 mb-1">
        <input
          ref={sliderRef}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={handleChange}
          className="slider-input flex-1 h-1.5 rounded-sm bg-theme-gray1 outline-none appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, var(--color-green) var(--slider-progress, 50%), var(--color-gray) var(--slider-progress, 50%))`
          }}
        />

        {showValue && (
          <span className="min-w-10 text-center font-medium text-theme-green text-sm">
            {valueFormatter(value)}
          </span>
        )}
      </div>

      {description && (
        <div className="text-xs text-theme-white mt-1 leading-relaxed">
          {description}
        </div>
      )}
    </div>
  );
};

export default SliderComponent;
