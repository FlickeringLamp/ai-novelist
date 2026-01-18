import { useState, useEffect } from 'react';
import SliderComponent from '../common/SliderComponent';
import InputComponent from '../common/InputComponent';
import SettingGroup from '../common/SettingGroup';

/**
 * 高级设置组件 - 管理AI参数
 * 统一管理temperature、top_p、n、max_tokens等参数
 */
const AdvancedSettings = ({
  aiParameters = {},
  onParametersChange,
  mode = 'outline'
}) => {
  // 本地状态管理
  const [localParameters, setLocalParameters] = useState({});

  // 初始化AI参数
  useEffect(() => {
    console.log(`[AdvancedSettings] 初始化模式 ${mode} 的参数:`, aiParameters);

    let modeParameters;
    if (aiParameters && aiParameters[mode]) {
      modeParameters = aiParameters[mode];
      console.log(`[AdvancedSettings] 模式 ${mode} 的详细参数:`, modeParameters);
    } else {
      modeParameters = {
        temperature: 0.7,
        top_p: 0.7,
        n: 1,
        max_tokens: 4000
      };
    }

    setLocalParameters(modeParameters);
  }, [aiParameters, mode]);

  // 处理AI参数变化
  const handleParameterChange = (parameter, value) => {
    const newParameters = {
      ...localParameters,
      [parameter]: value
    };
    setLocalParameters(newParameters);

    // 通知父组件参数已变化
    if (onParametersChange) {
      onParametersChange(mode, newParameters);
    }
  };

  // 重置参数为默认值
  const handleReset = () => {
    const defaultParameters = {
      temperature: 0.7,
      top_p: 0.7,
      n: 1,
      max_tokens: mode === 'outline' ? 4000 : mode === 'writing' ? 8000 : 2000
    };

    setLocalParameters(defaultParameters);

    // 通知父组件参数已重置
    if (onParametersChange) {
      onParametersChange(mode, defaultParameters);
    }
  };

  // 更新滑动条进度样式（仅用于AI参数滑动条）
  useEffect(() => {
    const updateSliderProgress = () => {
      const sliders = document.querySelectorAll('.parameter-slider');
      sliders.forEach(slider => {
        const value = parseFloat(slider.value);
        const min = parseFloat(slider.min);
        const max = parseFloat(slider.max);
        const progress = ((value - min) / (max - min)) * 100;
        slider.style.setProperty('--slider-progress', `${progress}%`);
      });
    };

    // 初始更新
    updateSliderProgress();

    // 监听滑动条变化
    const sliders = document.querySelectorAll('.parameter-slider');
    sliders.forEach(slider => {
      slider.addEventListener('input', updateSliderProgress);
    });

    return () => {
      sliders.forEach(slider => {
        slider.removeEventListener('input', updateSliderProgress);
      });
    };
  }, [localParameters]);

  return (
    <div className="p-5 bg-theme-black text-theme-white">
      {/* AI参数设置 */}
      <SettingGroup
        title="AI参数设置"
        description="调整AI模型的生成参数，控制输出的随机性和多样性"
      >
        <SliderComponent
          label="Temperature (温度)"
          value={localParameters.temperature ?? 0.7}
          min={0}
          max={2}
          step={0.1}
          onChange={(value) => handleParameterChange('temperature', value)}
          description="控制输出的随机性 (0-2)，值越高输出越随机"
          type="parameter"
        />

        <SliderComponent
          label="Top P (核采样)"
          value={localParameters.top_p ?? 0.7}
          min={0}
          max={1}
          step={0.1}
          onChange={(value) => handleParameterChange('top_p', value)}
          description="控制词汇选择的概率分布 (0-1)，值越小输出越集中"
          type="parameter"
        />

        <SliderComponent
          label="N (生成数量)"
          value={localParameters.n ?? 1}
          min={1}
          max={5}
          step={1}
          onChange={(value) => handleParameterChange('n', value)}
          description="每次生成多少个候选响应 (1-5)"
          type="parameter"
        />

        <InputComponent
          label="最大上下文长度"
          value={localParameters.max_tokens || 4000}
          onChange={(value) => handleParameterChange('max_tokens', value)}
          description="控制对话历史的最大token数，默认4000 tokens。若要自行配置，请不要超过模型本身最大上下文！"
          type="number"
          placeholder="4000"
          min={1000}
        />

        <div className="mt-5 flex gap-2.5">
          <button
            className="px-4 py-2 bg-theme-gray1 text-theme-green border border-theme-green rounded-small cursor-pointer text-sm transition-all hover:bg-theme-green hover:text-theme-black disabled:bg-theme-gray1/50 disabled:text-theme-gray1 disabled:border-theme-gray1 disabled:cursor-not-allowed"
            onClick={handleReset}
          >
            重置默认值
          </button>
        </div>
      </SettingGroup>
    </div>
  );
};

export default AdvancedSettings;
