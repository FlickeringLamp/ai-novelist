遇到问题：
重复渲染

Selector unknown returned a different result when called with the same parameters. This can lead to unnecessary rerenders.
Selectors that return a new reference (such as an object or an array) should be memoized: https://redux.js.org/usage/deriving-data-selectors#optimizing-selectors-with-memoization

直接在具体组件使用useSelector
不要自作聪明，从chat.ts导出Selector