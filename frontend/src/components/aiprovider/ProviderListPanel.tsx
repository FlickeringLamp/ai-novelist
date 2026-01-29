import { Panel } from 'react-resizable-panels';

interface ProviderListPanelProps {
  providers: string[];
  selectedProviderId: string | null;
  onProviderClick: (providerId: string) => void;
  onContextMenu: (e: React.MouseEvent, providerId: string) => void;
  onAddCustomProvider: () => void;
}

const ProviderListPanel = ({
  providers,
  selectedProviderId,
  onProviderClick,
  onContextMenu,
  onAddCustomProvider
}: ProviderListPanelProps) => {
  return (
    <Panel defaultSize={25} minSize={0} maxSize={100} className="border border-theme-gray1 flex flex-col h-[932px]">
      <div className="overflow-y-auto flex-1 p-1.25">
        {providers.map((provider, index) => (
          <div
            key={index}
            className={`m-2.5 p-2.5 text-center cursor-pointer bg-theme-gray1 ${selectedProviderId === provider ? 'border border-theme-green text-theme-green' : ''}`}
            onClick={() => onProviderClick(provider)}
            onContextMenu={(e) => onContextMenu(e, provider)}
          >
            {provider}
          </div>
        ))}
        {/* 自定义提供商按钮 */}
        <div className="m-2.5 p-2.5 text-center cursor-pointer bg-theme-gray1 hover:bg-theme-gray1" onClick={onAddCustomProvider}>
          + 自定义提供商
        </div>
      </div>
    </Panel>
  );
};

export default ProviderListPanel;
