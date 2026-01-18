import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faGear,
  faBook,
  faRobot,
  faPencil
} from '@fortawesome/free-solid-svg-icons';

const SidebarComponent = ({ activePanel, setActivePanel }) => {
  // 侧边栏项目配置
  const sidebarItems = [
    {
      id: 'home',
      icon: faPencil,
      label: '首页',
      panelId: null
    },
    {
      id: 'api',
      icon: faGear,
      label: 'API设置',
      panelId: 'api'
    },
    {
      id: 'rag',
      icon: faBook,
      label: 'RAG知识库',
      panelId: 'rag'
    },
    {
      id: 'agent',
      icon: faRobot,
      label: 'Agent设置',
      panelId: 'agent'
    }
  ];

  const handleItemClick = (item) => {
    // 如果点击的是当前活跃的面板，则关闭它
    if (activePanel === item.panelId) {
      setActivePanel(null);
    } else {
      // 否则切换到新面板
      setActivePanel(item.panelId);
    }
  };

  return (
    <div className="w-[50px] h-full bg-theme-black flex flex-col">
      {/* 侧边栏项目列表 */}
      <div className="flex-1 py-[10px] flex flex-col gap-2">
        {sidebarItems.map((item) => (
          <div
            key={item.id}
            className={`flex items-center justify-center p-3 cursor-pointer border-l-[3px] border-transparent relative ${activePanel === item.panelId ? 'border-l-theme-green' : ''}`}
            onClick={() => handleItemClick(item)}
            title={item.label}
          >
            <FontAwesomeIcon 
              icon={item.icon} 
              className={`text-[18px] ${activePanel === item.panelId ? 'text-theme-green' : 'text-theme-white hover:text-theme-green'}`} 
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default SidebarComponent;
