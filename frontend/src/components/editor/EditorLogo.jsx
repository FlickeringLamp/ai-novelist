import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFire, faHexagon } from '@fortawesome/free-solid-svg-icons';
import './EditorLogo.css';

// 这里使用Tailwind会有诡异抽动，故选择使用css实现
const EditorLogo = () => {
  return (
    <div className="flex items-center justify-center h-full bg-theme-gray1">
      <div className="relative">
        <div className="relative flex items-center justify-center auto-rotate1">
          <FontAwesomeIcon
            icon={faHexagon}
            className='text-[300px] text-theme-green'
          />
            <div className="absolute inset-0 flex items-center justify-center auto-rotate3">
              <FontAwesomeIcon
                icon={faHexagon}
                className='text-[299px] text-theme-gray1'
              />
              <div className="absolute inset-0 flex items-center justify-center auto-rotate1">
                <FontAwesomeIcon
                  icon={faFire}
                  className="text-[150px] text-theme-green float-animation"
                />
              </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default EditorLogo;
