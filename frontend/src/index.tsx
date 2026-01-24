import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { store } from "./store/store.ts"
import { Provider } from "react-redux"

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
    <Provider store={store}>
        <App />
    </Provider>
);
