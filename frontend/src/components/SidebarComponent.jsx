import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faGear,
  faBook,
  faRobot,
  faPencil
} from '@fortawesome/free-solid-svg-icons';
import './SidebarComponent.css';

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
    <div className="sidebar">
      {/* 侧边栏项目列表 */}
      <div className="sidebar-items">
        {sidebarItems.map((item) => (
          <div
            key={item.id}
            className={`sidebar-item ${activePanel === item.panelId ? 'active' : ''}`}
            onClick={() => handleItemClick(item)}
            title={item.label}
          >
            <FontAwesomeIcon icon={item.icon} className="item-icon" />
          </div>
        ))}
      </div>
    </div>
  );
};

export default SidebarComponent;
