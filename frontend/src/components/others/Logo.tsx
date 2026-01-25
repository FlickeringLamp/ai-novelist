import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFire, faHexagon } from '@fortawesome/free-solid-svg-icons';
import './Logo.css';

// 这里使用Tailwind会有诡异抽动，故选择使用css实现
const EditorLogo = () => {
  return (
    <div className="flex items-center justify-center h-full bg-theme-gray1">
      <div className="relative">
        <div className="relative flex items-center justify-center auto-rotate1">
          <FontAwesomeIcon
            icon={faHexagon}
            className='text-[15vw] text-theme-green'
          />
            <div className="absolute inset-0 flex items-center justify-center auto-rotate3">
              <FontAwesomeIcon
                icon={faHexagon}
                className='text-[14.9vw] text-theme-gray1'
              />
              <div className="absolute inset-0 flex items-center justify-center auto-rotate1">
                <FontAwesomeIcon
                  icon={faFire}
                  className="text-[6.5vw] text-theme-green float-animation1"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <FontAwesomeIcon
                    icon={faFire}
                    className="text-[6.3vw] text-theme-gray1 float-animation2"
                  />
                </div>
              </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default EditorLogo;
