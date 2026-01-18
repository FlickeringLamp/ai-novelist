import './App.css';
import LayoutComponent from './components/LayoutComponent';
import EditorPanel from './components/editor/EditorPanel';
import ChatPanel from './components/chat/ChatPanel';
import ChapterTreePanel from './components/chapter/ChapterTreePanel';

function App() {

  return (
    <div className="App">
      <LayoutComponent
        chapterPanel={<ChapterTreePanel />}
        editorPanel={<EditorPanel />}
        chatPanel={<ChatPanel />}
      />
    </div>
  );
}

export default App;
