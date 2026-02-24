# 尝试：
1. 
下载语言包
microsoft-main.i18n.json
vite-plugin-monaco-editor-nls插件

2. 
从官方下载中文语言包（但是好像没找对位置）
Invoke-WebRequest -Uri "https://cdn.jsdelivr.net/npm/monaco-editor@0.36.1/min/vs/nls/zh-cn.js" -OutFile "static/monaco/vs/nls/zh-cn.js"


# 解决方案：

在@monaco-editor/react的Readme文档中，发现汉化的方案：
通过 loader 配置
在应用入口文件（如 App.js 或 index.js）中，引入 loader 并配置中文语言：

```js
import { loader } from '@monaco-editor/react';

// 配置 Monaco Editor 使用中文界面
loader.config({
  'vs/nls': {
    availableLanguages: {
      '*': 'zh-cn'  // 设置为简体中文
    }
  }
});

// 然后再使用 Editor 组件
import Editor from '@monaco-editor/react';

function App() {
  return (
    <Editor
      height="90vh"
      defaultLanguage="javascript"
      defaultValue="// 现在编辑器界面应该是中文了"
    />
  );
}
```

然后在前端观察网络信息
得知CDN地址与需要的文件

下载到本地

发现simpleWorker.nls.js从localhost:8000/static/mona/vs/base/common/worker目录加载，而不是monaco以下的路径
于是创建路径并移动文件