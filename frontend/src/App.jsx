import './App.css';
import { ThemeProvider } from './context/ThemeContext';
import LayoutComponent from './components/LayoutComponent';
import EditorPanel from './components/editor/EditorPanel';
import ChatPanel from './components/chat/ChatPanel';
import ChapterTreePanel from './components/chapter/ChapterTreePanel';

function App() {
  return (
    <ThemeProvider>
      <div className="bg-theme-black text-theme-white h-screen overflow-hidden flex flex-col">
        <LayoutComponent
          chapterPanel={<ChapterTreePanel />}
          editorPanel={<EditorPanel />}
          chatPanel={<ChatPanel />}
        />
      </div>
    </ThemeProvider>
  );
}

export default App;
