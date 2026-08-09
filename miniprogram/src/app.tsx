import { PropsWithChildren } from 'react'
import { useLaunch } from '@tarojs/taro'
import ErrorBoundary from './components/ErrorBoundary'

// NutUI React（Taro 版）：变量主题 + 组件样式
import '@nutui/nutui-react-taro/dist/styles/themes/default.css'
import '@nutui/nutui-react-taro/dist/style.css'

import './app.scss'

function App({ children }: PropsWithChildren<any>) {
  useLaunch(() => {
    console.log('天机 AI 小程序启动')
  })

  // children 是将要被渲染的页面；ErrorBoundary 兜底 NutUI 组件的运行时异常
  return <ErrorBoundary>{children}</ErrorBoundary>
}

export default App
