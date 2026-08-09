import { Component, type ReactNode } from 'react'
import { View, Text } from '@tarojs/components'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * 页面级错误边界：NutUI 组件在小程序端偶发运行时异常时，
 * 显示友好提示而非整页白屏，并输出可定位的错误信息。
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: unknown): void {
    // 完整错误信息（含组件栈）输出到 console，便于在开发者工具定位
    // eslint-disable-next-line no-console
    console.error('[天机] 页面渲染异常:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <View className='page-pad' style={{ paddingTop: 120 }}>
          <View className='card text-center'>
            <Text className='card-title'>页面渲染出错了</Text>
            <Text className='card-body' style={{ marginTop: 12 }}>
              {String(this.state.error?.message ?? this.state.error).slice(0, 120)}
            </Text>
            <View style={{ marginTop: 24 }}>
              <Text className='link' onClick={() => this.setState({ error: null })}>点击重试</Text>
            </View>
          </View>
        </View>
      )
    }
    return this.props.children
  }
}
