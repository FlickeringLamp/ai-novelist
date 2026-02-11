import BaseListPanel from "./BaseListPanel";
import DetailPanel from "./DetailPanel";

const KnowledgeBasePanel = () => {
  return (
    <div className="w-full h-full flex">
      {/* 左侧：知识库列表 */}
      <BaseListPanel />

      {/* 右侧：详情面板 */}
      <DetailPanel />
    </div>
  );
};

export default KnowledgeBasePanel;
